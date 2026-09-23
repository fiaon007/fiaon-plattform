// ═══════════════════════════════════════════════════════════════════════════
// DIE FESTEN TEXTE DES LEAD-MOTORS (22.09.2026, E-210) — ENTWÜRFE ZUR FREIGABE
//
// Eine Quelle für: das Einwilligungs-Kästchen im Meta-Formular und die
// WhatsApp-Vorlagen (Phase 2). Das Steuerpult zeigt sie als Vorschau, der
// Prüfstand (scripts/pruef-lead-motor.ts) prüft jeden Satz gegen die
// Wortwand, die Wörter der Lead-Strecke, die Sie-Wand und die Emoji-Wand.
//
// ── REGELN, DIE HIER GELTEN ────────────────────────────────────────────────
// · Sie, immer. Keine Emojis, keine Sternchen (Justin 21.09.).
// · Mara gibt sich in der ERSTEN Nachricht als digitale Assistentin zu
//   erkennen (KI-Verordnung Art. 50, gilt seit 02.08.2026) und nennt den Weg
//   zum Menschen (WhatsApp-Richtlinie: Eskalation Pflicht).
// · Nie Mahnung, nie Inkasso über WhatsApp (Richtlinie: „debt collection").
// · Karte nur als Ziel — der eine Satz KARTE_SATZ (server/mail/geruest.ts).
// · Meta verbietet eine Variable am Anfang oder Ende des Textes → „Hallo {{1}},"
//   und der Text endet mit Worten. {{1}} ist der Name aus anredeChat ohne
//   „Hallo" („Maria Muster", „Frau Muster") — ohne brauchbaren Namen
//   „und willkommen" („Hallo und willkommen, …").
// · Knopftexte höchstens 25 Zeichen (Meta).
// ═══════════════════════════════════════════════════════════════════════════

/** Der Text für das Pflicht-Kästchen („Benutzerdefinierter Haftungsausschluss") im Meta-Formular. */
/**
 * Der HINWEISTEXT im Meta-Formular („Eigene Hinweise") — kein Kästchen.
 * Seit 22.09.2026 (Justin): Wer absendet, erlaubt die Kontaktaufnahme; ein
 * Pflicht-Kästchen würde nur dazu führen, dass die Hälfte der Leads nie eine
 * WhatsApp bekäme. Meta verlangt für WhatsApp lediglich, dass Firma und Kanal
 * klar genannt sind — beides steht hier.
 */
export const EINWILLIGUNG_HINWEIS =
  "Mit dem Absenden erlauben Sie der FIAON LTD, Sie zu Ihrer Anfrage und Ihrem Antrag zu kontaktieren – auch mit Erinnerungen – "
  + "per WhatsApp, SMS, E-Mail und Telefon. Sie können das jederzeit widerrufen, z. B. mit „STOPP“ auf WhatsApp oder über den "
  + "Abmeldelink in jeder E-Mail. Mehr dazu in unserer Datenschutzerklärung.";

/** Der Name für {{1}} — ohne brauchbaren Namen „und willkommen". */
export function vorlagenName(anredeChatZeile: string): string {
  const rest = anredeChatZeile.replace(/^Hallo\s*/, "").replace(/,\s*$/, "").trim();
  return rest || "und willkommen";
}

export type WaKnopf =
  | { typ: "URL"; text: string; url: string; beispiel: string }
  | { typ: "QUICK_REPLY"; text: string };

export interface WaVorlage {
  /** Name bei Meta (klein, Unterstriche). */
  name: string;
  kategorie: "UTILITY" | "MARKETING";
  /** Wofür — für das Steuerpult. */
  zweck: string;
  /** Wann sie rausgeht. */
  wann: string;
  text: string;
  /** Beispielwerte für {{1}}, {{2}} … (Meta verlangt sie bei der Einreichung). */
  beispiele: string[];
  knoepfe: WaKnopf[];
}

const LINK: WaKnopf = { typ: "URL", text: "Antrag öffnen", url: "https://fiaon.com/a/{{1}}", beispiel: "https://fiaon.com/a/Ab3dEf7hJk/w" };
const WEITER: WaKnopf = { typ: "URL", text: "Antrag fortsetzen", url: "https://fiaon.com/a/{{1}}", beispiel: "https://fiaon.com/a/Ab3dEf7hJk/w" };
const RUECKRUF: WaKnopf = { typ: "QUICK_REPLY", text: "Bitte rufen Sie mich an" };
const FRAGE: WaKnopf = { typ: "QUICK_REPLY", text: "Ich habe eine Frage" };
const STOPP: WaKnopf = { typ: "QUICK_REPLY", text: "Keine Nachrichten mehr" };

// ═══════════════════════════════════════════════════════════════════════════
// DIE VORLAGEN, ZWEITE FASSUNG (23.09.2026, E-212)
//
// Justin nach dem Blick in den Meta-Vorlagenmanager: „Die WhatsApp-Vorlagen
// sind sehr schlecht. Die Nachrichten müssen VIEL MEHR auf die Kreditkarte
// pitchen, auf das Limit, auf die schnelle Bearbeitung — weg mit der
// Absicherung von wegen ‚wir sind keine Bank‘."
//
// ── WAS SICH ÄNDERT ───────────────────────────────────────────────────────
// VORHER erklärte die erste Hälfte jeder Nachricht, was FIAON alles NICHT ist,
// und die Karte tauchte als vorsichtiger Nebensatz am Ende auf. NACHHER steht
// das Ziel im ersten Satz: die eigene Karte. Danach kommt, was wir dafür tun,
// und wie schnell es geht. Der Abschluss ist immer EIN Klick.
//
// ── WAS AUSDRÜCKLICH NICHT ────────────────────────────────────────────────
// Härter pitchen heißt nicht mehr versprechen. Die Bank entscheidet weiterhin
// über Zusage und Limit — das steht drin, nur nicht mehr als Entschuldigung,
// sondern als das, was es ist: der Grund, warum die Daten stimmen müssen.
// Karten-Sätze kommen unverändert aus shared/fiaon-karten-weg.ts (E-205/E-206),
// nicht aus einer zweiten Fassung hier.
//
// ── WARUM NEUE NAMEN (_v2) ────────────────────────────────────────────────
// Die acht Vorlagen der ersten Fassung stehen bei Meta auf PENDING. Eine
// Vorlage in Prüfung lässt sich nicht bearbeiten — Meta erlaubt das erst nach
// „genehmigt" oder „abgelehnt". Ein neuer Name ist deshalb kein Schönheits-
// fehler, sondern der einzige Weg, die bessere Fassung überhaupt einzureichen;
// `vorlagenEinreichen()` überspringt bestehende Namen von selbst.
// ═══════════════════════════════════════════════════════════════════════════
export const WA_VORLAGEN: WaVorlage[] = [
  {
    name: "fiaon_anfrage_eingang_v2",
    kategorie: "UTILITY",
    zweck: "Die erste Nachricht nach dem Formular — Ziel Karte, KI-Hinweis, Weg zum Menschen.",
    wann: "Sekunden nach dem Formular — an jeden Lead mit Handynummer.",
    text: "Hallo {{1}}, hier ist Mara, die digitale Assistentin von FIAON. Ihr Ziel ist die eigene Karte – Ihr Antrag dafür ist fertig vorbereitet, Ihre Angaben stehen schon drin. "
      + "Es fehlen wenige Minuten, dann starten wir: Bonitätsauskunft holen, jeden Eintrag prüfen, die Schreiben an die Auskunfteien übernehmen. "
      + "Über den Knopf geht es direkt weiter. Wenn Sie lieber mit einem Menschen sprechen, sagen Sie es mir einfach hier.",
    beispiele: ["Maria Muster"],
    knoepfe: [LINK, RUECKRUF, FRAGE],
  },
  {
    name: "fiaon_erinnerung_abend_v2",
    kategorie: "MARKETING",
    zweck: "Erste Erinnerung am Abend — Tempo als Argument.",
    wann: "Tag 1, 19 Uhr — wenn noch kein Antrag begonnen ist.",
    text: "Hallo {{1}}, Ihr Antrag liegt weiterhin bereit, ausgefüllt bis auf wenige Angaben – in ein paar Minuten erledigt. "
      + "Je früher er steht, desto früher läuft Ihre Bonitätsauskunft, und desto früher geht es Richtung eigener Karte. "
      + "Wenn etwas unklar ist, schreiben Sie es mir hier, ich gehe es mit Ihnen durch.",
    beispiele: ["Maria Muster"],
    knoepfe: [WEITER, RUECKRUF, STOPP],
  },
  {
    name: "fiaon_erinnerung_karte_v2",
    kategorie: "MARKETING",
    zweck: "Der Weg zur Karte in drei Schritten, mit Tempo und dem Thema Limit.",
    wann: "Tag 3.",
    text: "Hallo {{1}}, der Weg zur eigenen Karte in drei Schritten: Antrag abschließen, wir holen Ihre Bonitätsauskunft und erklären Ihnen jeden Eintrag, dann übernehmen wir die Schreiben an die Auskunfteien. "
      + "Sobald Ihr Account aktiviert ist, bekommen Sie direkt den fertigen Link unserer Partnerbank für Ihren Kartenantrag. "
      + "Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist nutzen Sie sie schon vorher in der App der Bank mit Apple Pay. "
      // Justin wollte hier ausdrücklich „das Limit" gepitcht haben. Das Wort
      // steht auf der Worthygiene-Liste (shared/fiaon-lead-strecke.ts) unter
      // „Kreditvermittlung / Kartenversprechen": Wer in der Kaltansprache mit
      // einer Kreditsumme wirbt, wirbt für eine erlaubnispflichtige Leistung
      // (§ 34c GewO). Die Sache steht deshalb drin, das Wort nicht — „wie viel
      // Ihnen die Bank einräumt" pitcht denselben Punkt: Ihre Daten entscheiden
      // darüber, und genau die bringen wir in Ordnung.
      + "Wie viel Ihnen die Bank am Ende einräumt, entscheidet sie anhand Ihrer Daten – und genau diese Daten bringen wir vorher in Ordnung.",
    beispiele: ["Maria Muster"],
    knoepfe: [WEITER, FRAGE, STOPP],
  },
  {
    name: "fiaon_erinnerung_gespraech_v2",
    kategorie: "MARKETING",
    zweck: "Gespräch anbieten — der Tipp auf einen Zeitraum legt die Aufgabe an.",
    wann: "Tag 7.",
    text: "Hallo {{1}}, fünf Minuten am Telefon klären meist alles: welche Einträge Sie gerade bremsen, welche davon wir angehen, und wie Ihr Weg zur Karte konkret aussieht. "
      + "Wann passt es Ihnen? Tippen Sie einfach auf einen Zeitraum.",
    beispiele: ["Maria Muster"],
    knoepfe: [{ typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Nachmittags" }, { typ: "QUICK_REPLY", text: "Abends" }, STOPP],
  },
  {
    name: "fiaon_erinnerung_offen_v2",
    kategorie: "MARKETING",
    zweck: "Die letzte WhatsApp — danach nur noch E-Mail.",
    wann: "Tag 14.",
    text: "Hallo {{1}}, Ihr Antrag ist weiterhin vorbereitet und Ihr Platz steht. Ein Klick, ein paar Minuten, dann beginnt die Bearbeitung. "
      + "Soll ich ihn für Sie offenhalten?",
    beispiele: ["Maria Muster"],
    knoepfe: [WEITER, { typ: "QUICK_REPLY", text: "Ja, bitte offenlassen" }, STOPP],
  },
  {
    name: "fiaon_antrag_weiter_v2",
    kategorie: "MARKETING",
    zweck: "Antrag begonnen, aber nicht beendet — zurück an dieselbe Stelle.",
    wann: "30 Minuten nach dem Abbruch (zusätzlich zur Mail-Kette E-023).",
    text: "Hallo {{1}}, Sie waren fast durch – alles, was Sie eingetragen haben, ist gespeichert. "
      + "Der Knopf bringt Sie genau an die Stelle zurück, an der Sie aufgehört haben, und danach geht Ihr Antrag sofort in die Bearbeitung.",
    beispiele: ["Maria Muster"],
    knoepfe: [WEITER, FRAGE, STOPP],
  },
  {
    name: "fiaon_rueckruf_verpasst_v2",
    kategorie: "UTILITY",
    zweck: "Nach einem Anrufversuch, der niemanden erreichte.",
    wann: "Vom Mitarbeiter per Knopf in der Akte.",
    text: "Hallo {{1}}, wir haben eben versucht, Sie zu erreichen – es ging um Ihren Antrag und die nächsten Schritte zu Ihrer Karte. "
      + "Wann passt es Ihnen besser? Tippen Sie auf einen Zeitraum, dann melden wir uns in diesem Zeitraum.",
    beispiele: ["Maria Muster"],
    knoepfe: [{ typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Nachmittags" }, { typ: "QUICK_REPLY", text: "Abends" }],
  },
  {
    name: "fiaon_kontakt_v2",
    kategorie: "UTILITY",
    zweck: "Öffnet das Gespräch neu, wenn das 24-Stunden-Fenster geschlossen ist.",
    wann: "Vom Mitarbeiter per Knopf in der Akte.",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON. Ich habe eine kurze Rückfrage zu Ihrem Antrag – antworten Sie einfach auf diese Nachricht, dann bringen wir ihn heute zu Ende.",
    beispiele: ["Maria Muster", "Daniel Stripling"],
    knoepfe: [],
  },
];
