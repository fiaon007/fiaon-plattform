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
  // `beispiel` nur bei einer URL MIT Platzhalter: Meta verlangt es dort und
  // weist es bei einer festen URL zurück (E-214).
  | { typ: "URL"; text: string; url: string; beispiel?: string }
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
// 23.09.2026 (E-214): Der Terminweg — Florentine schickt jedem, den sie nicht
// erreicht, einen Terminlink. Bisher ging das nur per E-Mail; wer keine hat,
// bekam gar nichts.
const TERMIN: WaKnopf = { typ: "URL", text: "Zeitfenster wählen", url: "https://fiaon.com/termin" };
const BEREICH: WaKnopf = { typ: "URL", text: "Meinen Bereich öffnen", url: "https://fiaon.com/login" };
const ZAHLUNG: WaKnopf = { typ: "URL", text: "Jetzt aktivieren", url: "https://fiaon.com/zahlung/{{1}}", beispiel: "https://fiaon.com/zahlung/FIAONMUE7AZ" };
const START: WaKnopf = { typ: "URL", text: "Anfrage starten", url: "https://fiaon.com/start" };
const JA: WaKnopf = { typ: "QUICK_REPLY", text: "Ja, bitte" };

// ═══════════════════════════════════════════════════════════════════════════
// DIE VORLAGEN, VIERTE FASSUNG — NUR DIE KARTE (23.09.2026, E-215)
//
// Justin, wörtlich: „Die Texte in den Vorlagen passen auch nicht, weg mit
// Bonitätsauskunft und Löschung von Dateien oder so, sondern NUR auf die
// Kreditkarte pitchen. ‚Hi, Ihr Antrag für Ihre Kreditkarte liegt am Tisch,
// jetzt abschließen, bei Annahme ist die Karte in Kürze bei Ihnen …‘"
//
// ── WAS SICH GEGENÜBER DER DRITTEN FASSUNG ÄNDERT ─────────────────────────
// Raus: Bonitätsauskunft, Prüfung von Einträgen, Schreiben an die
// Auskunfteien, „wir bringen Ihre Daten in Ordnung". Das ist unsere Arbeit,
// nicht sein Ziel — und in einer Nachricht mit vier Zeilen kostet es genau den
// Platz, an dem das Ziel stehen müsste.
// Rein: die Karte, in jedem einzelnen Satz.
//
// ── DAS WORT „KREDITKARTE" ────────────────────────────────────────────────
// Steht ab dieser Fassung drin. Es liegt auf der Worthygiene-Liste
// (§ 34c GewO); Justin hat die Grenze am 23.09. zweimal ausdrücklich
// überstimmt, nachdem ihm die Begründung vorlag. Die Ausnahme ist benannt und
// gilt NUR hier: `WHATSAPP_ERLAUBT` in shared/fiaon-lead-strecke.ts. Mails,
// Briefe und die Nachfass-Strecke sind unverändert.
//
// ── EIN SATZ, DER TROTZDEM NICHT DRINSTEHT ────────────────────────────────
// „Ihr Antrag für Ihre Kreditkarte liegt am Tisch." Der Kunde hat bei FIAON
// keinen Kartenantrag gestellt, sondern eine Anfrage; der Kartenantrag läuft
// später bei der Partnerbank. Eine falsche Tatsachenbehauptung ist kein Pitch,
// sondern ein Widerrufsgrund — und Meta weist sie bei der Prüfung ohnehin ab,
// womit die Vorlage gar nicht erst nutzbar wäre. „Ihre Anfrage für Ihre
// Kreditkarte liegt auf meinem Tisch" trägt dasselbe Gefühl und hält.
//
// Ebenso bleibt „bei Zusage der Bank" stehen. Nicht aus Vorsicht: FIAON stellt
// keine Karte aus, und ein Versprechen, das ein Dritter halten muss, ist keines.
// ═══════════════════════════════════════════════════════════════════════════
export const WA_VORLAGEN: WaVorlage[] = [
  {
    name: "fiaon_kk_anfrage",
    kategorie: "UTILITY",
    zweck: "Der erste Kontakt nach dem Formular — Karte im ersten Satz, KI-Hinweis, Weg zum Menschen.",
    wann: "Sekunden nach dem Meta-Formular — an jeden Lead mit Handynummer.",
    text: "Hallo {{1}}, hier ist Mara Lindner von FIAON — ich bin die digitale Assistentin im Team. "
      + "Ihre Anfrage für Ihre Kreditkarte liegt auf meinem Tisch, und ich würde sie gern mit Ihnen abschließen. "
      + "Ihr Antrag ist bereits vorbereitet, Ihre Angaben stehen drin — es fehlen wenige Minuten. "
      + "Danach geht es direkt zur Partnerbank: Bei Zusage ist Ihre Karte in der Regel in 2–5 Werktagen bei Ihnen, "
      + "und meist nutzen Sie sie schon vorher in der App mit Apple Pay. "
      + "Über den Knopf geht es weiter. Wenn Sie lieber mit einem Menschen sprechen, sagen Sie es mir hier.",
    beispiele: ["Frau Muster"],
    knoepfe: [LINK, RUECKRUF, FRAGE],
  },
  {
    name: "fiaon_kk_nicht_erreicht",
    kategorie: "UTILITY",
    zweck: "Nach einem Anrufversuch, der niemanden erreichte — mit Terminlink.",
    wann: "Vom Mitarbeiter per Knopf in der Akte. Florentines Fall: „Hab einen Kunden nicht erreicht und er hat keine E-Mail.“",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON — ich habe gerade versucht, Sie zu erreichen. "
      + "Es geht um Ihre Kreditkarte: Ihre Anfrage liegt bei mir, und es fehlt nur noch Ihr Ja. "
      + "Suchen Sie sich ein Zeitfenster aus, dann rufe ich Sie genau dann an und wir bringen es zu Ende.",
    beispiele: ["Frau Muster", "Florentine"],
    knoepfe: [TERMIN, { typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Nachmittags" }, { typ: "QUICK_REPLY", text: "Abends" }],
  },
  {
    name: "fiaon_kk_termin",
    kategorie: "UTILITY",
    zweck: "Terminlink ohne vorherigen Anrufversuch — wenn jemand aktiv ein Gespräch will.",
    wann: "Vom Mitarbeiter per Knopf in der Akte.",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON. Damit Ihre Kreditkarte zügig auf den Weg kommt, reicht ein kurzes Gespräch — "
      + "meist sind es fünf Minuten. Suchen Sie sich ein Zeitfenster aus, dann melde ich mich genau dann.",
    beispiele: ["Frau Muster", "Florentine"],
    knoepfe: [TERMIN, { typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Nachmittags" }, { typ: "QUICK_REPLY", text: "Abends" }],
  },
  {
    name: "fiaon_kk_antrag_offen",
    kategorie: "MARKETING",
    zweck: "Antrag begonnen, nicht beendet — zurück an dieselbe Stelle.",
    wann: "30 Minuten nach dem Abbruch.",
    text: "Hallo {{1}}, Sie waren fast durch — alles, was Sie eingetragen haben, ist gespeichert. "
      + "Zwischen Ihnen und Ihrer eigenen Kreditkarte stehen noch wenige Minuten. "
      + "Der Knopf bringt Sie genau an die Stelle zurück, an der Sie aufgehört haben.",
    beispiele: ["Frau Muster"],
    knoepfe: [WEITER, FRAGE, STOPP],
  },
  {
    name: "fiaon_kk_aktivierung",
    kategorie: "UTILITY",
    zweck: "Antrag fertig, Konto noch nicht aktiviert — die erste Zahlung startet alles.",
    wann: "NUR für die Aktivierung nach dem Antrag. NIE für eine überfällige Rate: Mahnungen über WhatsApp sind nach der Richtlinie verboten.",
    text: "Hallo {{1}}, Ihr Antrag ist angekommen — jetzt fehlt nur noch die Aktivierung. "
      + "Mit der ersten Zahlung ist Ihr Konto aktiv, und Sie bekommen direkt den fertigen Link unserer Partnerbank für Ihre Kreditkarte. "
      + "Über den Knopf sehen Sie den QR-Code für Ihre Banking-App und Ihren Verwendungszweck.",
    beispiele: ["Frau Muster"],
    knoepfe: [ZAHLUNG, FRAGE],
  },
  {
    name: "fiaon_kk_aktiviert",
    kategorie: "UTILITY",
    zweck: "Zahlung gebucht — der Moment, auf den der Kunde gewartet hat.",
    wann: "Sobald die erste Zahlung gebucht und die Einladung der Partnerbank raus ist.",
    text: "Hallo {{1}}, Ihr Konto ist aktiviert — und der Link unserer Partnerbank für Ihre Kreditkarte ist auf dem Weg zu Ihnen. "
      + "Bei Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, "
      + "und meist nutzen Sie sie schon vorher in der App der Bank mit Apple Pay.",
    beispiele: ["Frau Muster"],
    knoepfe: [BEREICH, FRAGE],
  },
  {
    name: "fiaon_kk_unterlagen",
    kategorie: "UTILITY",
    zweck: "Es fehlen Unterlagen — ohne sie steht der Weg zur Karte.",
    wann: "Vom Mitarbeiter per Knopf in der Akte.",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON. Ihre Kreditkarte ist auf dem Weg, an einer Stelle warte ich noch auf Sie: {{3}}. "
      + "In Ihrem Bereich laden Sie das in zwei Minuten hoch, dann geht es sofort weiter.",
    beispiele: ["Frau Muster", "Florentine", "Ihr Ausweis"],
    knoepfe: [BEREICH, FRAGE],
  },
  {
    name: "fiaon_kk_termin_morgen",
    kategorie: "UTILITY",
    zweck: "Erinnerung an einen gebuchten Termin.",
    wann: "Am Vortag des Termins.",
    text: "Hallo {{1}}, kurze Erinnerung: Wir sprechen {{2}} über Ihre Kreditkarte und die letzten Schritte dorthin. "
      + "Passt die Zeit noch? Eine Nachricht hier genügt, dann verschieben wir.",
    beispiele: ["Frau Muster", "morgen um 14:30 Uhr"],
    knoepfe: [{ typ: "QUICK_REPLY", text: "Passt" }, { typ: "QUICK_REPLY", text: "Bitte verschieben" }],
  },
  {
    name: "fiaon_kk_rueckfrage",
    kategorie: "UTILITY",
    zweck: "Öffnet das Gespräch neu, wenn das 24-Stunden-Fenster geschlossen ist.",
    wann: "Vom Mitarbeiter per Knopf in der Akte.",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON. Ich habe eine kurze Rückfrage zu Ihrer Kreditkarte — "
      + "antworten Sie einfach auf diese Nachricht, dann bringen wir es heute zu Ende.",
    beispiele: ["Frau Muster", "Florentine"],
    knoepfe: [],
  },
  {
    name: "fiaon_kk_empfehlung",
    kategorie: "MARKETING",
    zweck: "Weiterempfehlung — der eigene Link des Kunden.",
    wann: "Wenn ein Kunde fragt, ob es etwas für eine Empfehlung gibt (Michaela Schneider, 23.09.).",
    text: "Hallo {{1}}, Sie hatten gefragt, ob Sie FIAON weiterempfehlen können — sehr gern. "
      + "Über den Knopf öffnet sich Ihr persönlicher Link zum Weiterempfehlen. Wer ihn benutzt, ist Ihnen zugeordnet, "
      + "und wir melden uns bei Ihnen, sobald daraus etwas geworden ist.",
    beispiele: ["Frau Muster"],
    knoepfe: [{ typ: "URL", text: "Mein persönlicher Link", url: "https://fiaon.com/e/{{1}}", beispiel: "https://fiaon.com/e/Ab3dEf7h" }, FRAGE],
  },
  {
    name: "fiaon_kk_tag1",
    kategorie: "MARKETING",
    zweck: "Erste Erinnerung am Abend — Tempo als Argument.",
    wann: "Tag 1, 19 Uhr, wenn noch kein Antrag begonnen ist.",
    text: "Hallo {{1}}, hier noch einmal Mara Lindner von FIAON. Ihre Anfrage für Ihre Kreditkarte liegt weiterhin bei mir, "
      + "und Ihr Antrag ist vorbereitet — ausgefüllt bis auf wenige Angaben. "
      + "Je früher er steht, desto früher geht er zur Partnerbank.",
    beispiele: ["Frau Muster"],
    knoepfe: [WEITER, RUECKRUF, STOPP],
  },
  {
    name: "fiaon_kk_tag3",
    kategorie: "MARKETING",
    zweck: "Der Weg zur Karte in drei Schritten.",
    wann: "Tag 3.",
    text: "Hallo {{1}}, Ihr Weg zur eigenen Kreditkarte in drei Schritten: Antrag abschließen. Konto aktivieren. "
      + "Den fertigen Link unserer Partnerbank öffnen. "
      + "Bei Zusage der Bank ist Ihre Karte in der Regel in 2–5 Werktagen bei Ihnen, "
      + "und meist nutzen Sie sie schon vorher in der App mit Apple Pay. "
      + "Der erste Schritt dauert wenige Minuten — den Rest übernehmen wir.",
    beispiele: ["Frau Muster"],
    knoepfe: [WEITER, FRAGE, STOPP],
  },
  {
    name: "fiaon_kk_tag7",
    kategorie: "MARKETING",
    zweck: "Gespräch anbieten — fünf Minuten klären mehr als jede Nachricht.",
    wann: "Tag 7.",
    text: "Hallo {{1}}, fünf Minuten am Telefon klären meist alles: was Ihre Kreditkarte für Sie möglich macht, "
      + "wie der Weg dorthin aussieht und was von Ihnen dafür gebraucht wird. Suchen Sie sich ein Zeitfenster aus.",
    beispiele: ["Frau Muster"],
    knoepfe: [TERMIN, { typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Abends" }, STOPP],
  },
  {
    name: "fiaon_kk_letzte",
    kategorie: "MARKETING",
    zweck: "Die letzte WhatsApp — danach nur noch E-Mail.",
    wann: "Tag 14.",
    text: "Hallo {{1}}, Ihr Antrag ist weiterhin vorbereitet und Ihr Platz steht. "
      + "Ein Klick, ein paar Minuten, dann ist Ihre Kreditkarte in Reichweite. Soll ich ihn für Sie offenhalten?",
    beispiele: ["Frau Muster"],
    knoepfe: [WEITER, JA, STOPP],
  },
];
