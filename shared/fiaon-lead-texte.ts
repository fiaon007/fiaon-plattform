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

/**
 * Vorlagen, bei denen die Inkasso-Wand nicht greift (23.09.2026, E-222).
 *
 * Eine Zahlungserinnerung zur eigenen Rechnung ist bei Meta eine gewöhnliche
 * UTILITY-Vorlage — Justin hat das beim Meta-Support abgefragt. Die Ausnahme
 * steht hier NAMENTLICH und nicht als gelockerte Regel: Wer eine zweite
 * Vorlage mit Mahnton bauen will, muss sie hier eintragen und sich dabei
 * ansehen, was er tut.
 */
export const INKASSO_AUSNAHME = ["fiaon_kk_rechnung", "fiaon_kkb_rechnung"] as const;

/** Der Name für {{1}} — ohne brauchbaren Namen „und willkommen". */
export function vorlagenName(anredeChatZeile: string): string {
  const rest = anredeChatZeile.replace(/^Hallo\s*/, "").replace(/,\s*$/, "").trim();
  return rest || "und willkommen";
}

export type WaBild = "karte" | "antrag" | "zahlung" | "termin" | "kontakt";

/** Die öffentliche Adresse eines Kopfbilds — Meta holt es beim Senden selbst ab. */
export const waBildUrl = (b: WaBild) => `https://fiaon.com/wa/fiaon-${b}.png`;

export type WaKnopf =
  // `beispiel` nur bei einer URL MIT Platzhalter: Meta verlangt es dort und
  // weist es bei einer festen URL zurück (E-214).
  | { typ: "URL"; text: string; url: string; beispiel?: string }
  | { typ: "QUICK_REPLY"; text: string };

export interface WaVorlage {
  /** Name bei Meta (klein, Unterstriche). */
  name: string;
  /**
   * KOPFZEILE (23.09.2026, E-221) — höchstens 60 Zeichen, fett über dem Text.
   *
   * Justin, mit dem echten Chat vor Augen: „Das sieht so super billig aus."
   * Er hatte recht: Die Nachricht begann mitten im Satz, ohne Absender und
   * ohne Abschluss. Meta erlaubt für Vorlagen einen KOPF und eine FUSSZEILE;
   * wir haben beides nicht benutzt. Der Kopf ist die Zeile, die im Chat als
   * Erstes ins Auge fällt — dort gehört hin, worum es geht.
   */
  kopf?: string;
  /**
   * KOPFBILD (23.09.2026, E-229) — statt einer Textzeile ein Bild im FIAON-CI.
   * Justin: „Man kann da richtig schöne Vorlagen erstellen … perfekt formatiert,
   * passende Farben, alles super seriös mit FIAON Ltd. in unserem CI." Farbe
   * gibt es im WhatsApp-Text nicht; im Kopfbild schon. Die Bilder liegen unter
   * client/public/wa/ und werden aus scripts/wa-kopfbilder.ts erzeugt.
   */
  kopfBild?: WaBild;
  /** Bei einer Bildfassung: der Name der Textfassung, die sie ersetzt. */
  varianteVon?: string;
  /** FUSSZEILE — höchstens 60 Zeichen, klein und grau unter dem Text. */
  fuss?: string;
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
// E-230: Eigener Knopf für die Monatsrate — „Jetzt aktivieren" stimmt bei einem
// Bestandskunden nicht, sein Account ist längst aktiv.
const RATE_ZAHLUNG: WaKnopf = { typ: "URL", text: "Rate bezahlen", url: "https://fiaon.com/zahlung/{{1}}", beispiel: "https://fiaon.com/zahlung/FIAON-AB12CD-2" };
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
const WA_VORLAGEN_TEXT: WaVorlage[] = [
  {
    name: "fiaon_kk_anfrage",
    kopf: "Ihre Kreditkarte",
    fuss: "FIAON LTD · Mara Lindner",
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
    kopf: "Wir haben Sie nicht erreicht",
    fuss: "FIAON LTD · Antworten Sie jederzeit hier",
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
    kopf: "Ihr Gesprächstermin",
    fuss: "FIAON LTD · Antworten Sie jederzeit hier",
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
    kopf: "Ihr Antrag wartet",
    fuss: "FIAON LTD · Mara Lindner",
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
    kopf: "Nur noch die Aktivierung",
    fuss: "FIAON LTD · Fragen? Einfach hier antworten",
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
    kopf: "Ihr Konto ist aktiviert",
    fuss: "FIAON LTD · Wir bleiben an Ihrer Seite",
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
    kopf: "Es fehlt noch eine Unterlage",
    fuss: "FIAON LTD · Antworten Sie jederzeit hier",
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
    kopf: "Erinnerung an Ihren Termin",
    fuss: "FIAON LTD · Antworten Sie jederzeit hier",
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
    kopf: "Eine kurze Rückfrage",
    fuss: "FIAON LTD · Antworten Sie jederzeit hier",
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
    kopf: "Ihr persönlicher Link",
    fuss: "FIAON LTD · Danke für Ihre Weiterempfehlung",
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
    kopf: "Ihre Kreditkarte wartet",
    fuss: "FIAON LTD · Mara Lindner",
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
    kopf: "Ihr Weg zur Kreditkarte",
    fuss: "FIAON LTD · Mara Lindner",
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
    kopf: "Fünf Minuten am Telefon",
    fuss: "FIAON LTD · Mara Lindner",
    kategorie: "MARKETING",
    zweck: "Gespräch anbieten — fünf Minuten klären mehr als jede Nachricht.",
    wann: "Tag 7.",
    text: "Hallo {{1}}, fünf Minuten am Telefon klären meist alles: was Ihre Kreditkarte für Sie möglich macht, "
      + "wie der Weg dorthin aussieht und was von Ihnen dafür gebraucht wird. Suchen Sie sich ein Zeitfenster aus.",
    beispiele: ["Frau Muster"],
    knoepfe: [TERMIN, { typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Abends" }, STOPP],
  },
  {
    // ══════════════════════════════════════════════════════════════════════
    // DIE OFFENE RECHNUNG (23.09.2026, E-222)
    //
    // Justin: „Baue auch — wir dürfen das laut Anfrage bei Meta Support — die
    // Rechnungen mit dem Link an die Kunden schicken, die überfällig sind."
    //
    // ── WAS ERLAUBT IST, UND WO DIE GRENZE LIEGT ────────────────────────
    // Meta verbietet INKASSO über WhatsApp. Eine Zahlungserinnerung zur
    // EIGENEN Rechnung ist etwas anderes und bei Meta eine gewöhnliche
    // UTILITY-Vorlage. Der Unterschied liegt im Ton, und er ist scharf:
    //
    //   ERLAUBT   Sachlich nennen, was offen ist, und wie man es begleicht.
    //   VERBOTEN  Druck, Fristen mit Folgen, Mahngebühren, Verzugszinsen,
    //             Androhung von Inkasso, Sperre oder Gericht.
    //
    // Deshalb stehen hier weder „Mahnung" noch „überfällig" noch „Rückstand" —
    // nicht aus Zimperlichkeit, sondern weil genau diese Wörter die Vorlage
    // bei der Prüfung kippen und im Wiederholungsfall die Nummer kosten.
    // Gepitcht wird auf das, was den Kunden wirklich interessiert: Nach dem
    // Eingang geht es sofort weiter.
    //
    // Der Prüfstand lässt diese eine Vorlage durch die Inkasso-Wand
    // (INKASSO_AUSNAHME unten) — benannt, nicht stillschweigend.
    // ══════════════════════════════════════════════════════════════════════
    name: "fiaon_kk_rechnung",
    kopf: "Ihre offene Rechnung",
    fuss: "FIAON LTD · Fragen? Einfach hier antworten",
    kategorie: "UTILITY",
    zweck: "Offene Rechnung mit Zahlungslink — sachlich, mit dem Tempo als Argument.",
    wann: "Wenn eine Rechnung offen ist. Sachlicher Ton ist Pflicht: keine Frist mit Folgen, keine Gebühren, keine Androhung.",
    text: "Hallo {{1}}, Ihre Rechnung über {{2}} € ist noch offen — Verwendungszweck {{3}}. "
      + "Sobald die Zahlung bei uns eingeht, aktiviere ich Ihr Konto umgehend, und Sie bekommen direkt den fertigen Link "
      + "unserer Partnerbank für Ihre Kreditkarte. Je schneller die Zahlung da ist, desto schneller halten Sie die Karte in der Hand. "
      + "Über den Knopf sehen Sie den QR-Code für Ihre Banking-App und alle Bankdaten.",
    beispiele: ["Frau Muster", "99,99", "FIAONMUE7AZ"],
    knoepfe: [ZAHLUNG, FRAGE],
  },
  {
    name: "fiaon_kk_letzte",
    kopf: "Soll ich offenhalten?",
    fuss: "FIAON LTD · Danach hören Sie nur per E-Mail",
    kategorie: "MARKETING",
    zweck: "Die letzte WhatsApp — danach nur noch E-Mail.",
    wann: "Tag 14.",
    text: "Hallo {{1}}, Ihr Antrag ist weiterhin vorbereitet und Ihr Platz steht. "
      + "Ein Klick, ein paar Minuten, dann ist Ihre Kreditkarte in Reichweite. Soll ich ihn für Sie offenhalten?",
    beispiele: ["Frau Muster"],
    knoepfe: [WEITER, JA, STOPP],
  },
  // ─────────────────────────────────────────────────────────────────────────
  // E-230 (24.09.2026): DIE MONATSRATE. Justin: „Schreib die Raten-Vorlage und
  // reich sie ein." fiaon_kk_rechnung verspricht die Aktivierung und den Link
  // der Partnerbank — bei einem Bestandskunden, dessen Account längst aktiv
  // ist, gelogen. Diese hier sagt nur, was stimmt: welche Rate, wann fällig,
  // welcher Verwendungszweck, wo man bezahlt. Kein „von 12" (fast alle
  // Empfänger haben Altverträge, monatlich kündbar), keine Frist mit Folgen,
  // keine Gebühr, keine Mahnwörter — die Inkasso-Wand greift ohne Ausnahme.
  // Werbung gehört NICHT hinein: Meta stuft Utility mit Werbesätzen zu
  // Marketing um. Den Kartennutzen bringt Mara, wenn der Kunde antwortet.
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "fiaon_kk_rate",
    kopf: "Ihre Monatsrate",
    fuss: "FIAON LTD · Fragen? Einfach hier antworten",
    kategorie: "UTILITY",
    zweck: "Erinnerung an eine fällige, unbezahlte Monatsrate eines Bestandskunden — Knopf zur Zahlungsseite genau dieser Rate.",
    wann: "Nur über die WhatsApp-Zentrale, Gruppe „Monatsrate fällig“: bezahlte Bestellung, Rate offen und fällig, nicht gekündigt, kein Abo- oder Mahnstopp. Höchstens alle 7 Tage, höchstens zweimal je Rate.",
    text: "Hallo {{1}}, eine kurze Erinnerung von FIAON: Ihre Monatsrate über {{2}} € war am {{3}} fällig — Verwendungszweck {{4}}. "
      + "Über den Knopf öffnen Sie Ihre Zahlungsseite mit dem QR-Code für Ihre Banking-App; Empfänger, Betrag und Verwendungszweck sind dort schon ausgefüllt. "
      + "Schon überwiesen? Dann hat sich diese Nachricht mit Ihrer Zahlung überschnitten — Sie müssen nichts weiter tun. "
      + "Haben Sie eine Frage zu Ihrer Rate, antworten Sie einfach auf diese Nachricht.",
    beispiele: ["Frau Muster", "59,99", "22.09.2026", "FIAON-AB12CD-2"],
    knoepfe: [RATE_ZAHLUNG, FRAGE],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// DIE BONITÄTSAUSKUNFT AUF WHATSAPP (24.09.2026, E-240 · 25.09.2026, E-241)
//
// E-240 legte fiaon_kk_auskunft als ENTWURF neben die Liste (nicht
// eingereicht): Justin sollte sie erst lesen, und sie ging nur an zahlende
// Kunden nach dem 02.09.2026 12:35. Am 25.09. hat er entschieden: „an ALLE,
// die keine Boni-Auskunft hinterlegt oder gekauft haben … jeden Tag 30 per
// WhatsApp zusätzlich." Deshalb stehen beide Vorlagen jetzt HIER, im Register
// des Hauses: Nach dem Ausrollen reicht „Vorlagen einreichen" im Postfach sie
// ein (die Bildfassungen fiaon_kkb_* entstehen unten von selbst), und Meta
// prüft sie. Senden kann sie niemand, bevor Meta sie als APPROVED führt (istFrei).
//
//   · fiaon_kk_auskunft       — zahlende Kunden: „In Ihrer Akte fehlt noch …",
//                               Kundenpreis, Hochlade-Weg im Bereich, Betreuer.
//   · fiaon_kk_auskunft_lead  — fertige Anträge ohne Zahlung (B), Leads (C) und
//                               seit E-243 Abbrecher: ohne Akte, ohne Betreuer,
//                               ohne Bereich (Wortlaut: siehe E-243 unten).
//
// ── DIESELBEN VIER PLATZHALTER IN DERSELBEN REIHENFOLGE ───────────────────
// {{1}} Name (anredeChat ohne „Hallo"), {{2}} das Wort, das der Mensch kennt
// (SCHUFA-/KSV-/Bonitätsauskunft bzw. „Bonitätsauskunft für Ihr Unternehmen"),
// {{3}} die Auskunfteien seines Landes, {{4}} der Preis vom Server; im Knopf
// {{1}} = der Kurz-Kauflink (kaufKurzToken, EIN Pfadstück „4711-p-…").
// werteFuer in der WA-Zentrale füllt beide Vorlagen gleich; Österreich und die
// Schweiz lesen nie „SCHUFA", weil kein Wort des festen Textes es sagt.
//
// ── WAS DRINSTEHT UND WARUM ───────────────────────────────────────────────
// · MARKETING, Sie, keine Emojis, keine Sternchen — und NICHT das Wort
//   „Limit" (Worthygiene, auf WhatsApp ohne Ausnahme). Der Nutzen heißt hier
//   „was die Bank sieht, bevor sie über Ihre Karte entscheidet".
// · Mara gibt sich als digitale Assistentin zu erkennen (KI-VO Art. 50) und
//   nennt den Weg zum Menschen — viele Empfänger haben nie mit ihr geschrieben.
// · Keine Garantie, keine Löschzusage, kein „Score verbessern", keine Frist
//   mit Zahl, keine Karten- oder Rahmenzusage.
// · Der Knopf führt auf die Bestätigungsseite mit „zahlungspflichtig
//   beauftragen" — die Nachricht bestellt nichts (§ 312j Abs. 3 BGB), und sie
//   sagt das: „beauftragt ist erst, wenn Sie auf der nächsten Seite bestätigen".
// · Der Widerspruchs-Hinweis (§ 7 Abs. 3 Nr. 4 UWG) in JEDER Nachricht, mit
//   dem Weg „Antworten Sie STOPP" (istStopp in fiaon-whatsapp-mara.ts) und dem
//   Knopf „Keine Nachrichten mehr" (= STOPP der Zentrale). Der Text endet mit
//   Worten, nicht mit einer Variable (Meta).
// · Länge: Der feste Text bleibt so kurz, dass er auch mit den längsten Werten
//   (Firma: „den Wirtschaftsauskunfteien und für Sie persönlich bei …") unter
//   1.024 Zeichen bleibt — waSenden prüft den GEFÜLLTEN Text (sendePruefung).
// ═══════════════════════════════════════════════════════════════════════════
export const AUSKUNFT_VORLAGE = "fiaon_kk_auskunft";
/** E-241: dieselbe Auskunft für fertige Anträge ohne Zahlung und Leads. */
export const AUSKUNFT_LEAD_VORLAGE = "fiaon_kk_auskunft_lead";
/** Beide Auskunft-Vorlagen mit ihren Bildfassungen — für Sendewege, die den Kauflink prüfen. */
export const AUSKUNFT_VORLAGEN_ALLE: readonly string[] = [AUSKUNFT_VORLAGE, AUSKUNFT_LEAD_VORLAGE, "fiaon_kkb_auskunft", "fiaon_kkb_auskunft_lead"];

// Der Knopf trägt den signierten Kurz-Kauflink (fiaon-chef-auskunft.ts, Route /k/:token).
const AUSKUNFT_KAUF: WaKnopf = {
  typ: "URL", text: "Auskunft beauftragen", url: "https://fiaon.com/api/fiaon/auskunft/k/{{1}}",
  beispiel: "https://fiaon.com/api/fiaon/auskunft/k/4711-p-mfy3k2q0-0f3a9b7c2e4d0f3a9b7c2e4d0f3a9b7c",
};

// Der Widerspruchs-Satz beider Vorlagen — inhaltsgleich mit WIDERSPRUCH_SATZ der Angebots-Mail.
const AUSKUNFT_STOPP_SATZ = "Sie können solchen Nachrichten jederzeit widersprechen: Antworten Sie STOPP — "
  + "es entstehen keine anderen als die Übermittlungskosten nach den Basistarifen.";

// ── NEU GETEXTET: EHRLICH, ABER VERKAUFEND (26.09.2026, E-243) ─────────────
// Justin: „Mach WhatsApp fix fertig … jeden Tag 20 WhatsApp … wo wir das
// richtig verkaufen." Beide Vorlagen waren noch nicht eingereicht — sie dürfen
// neu. Jeder Mensch bekommt genau EINE davon (einmal je Mensch), also trägt sie
// den stärksten Winkel der Angebots-Mail, Fassung a: „Schon einmal abgelehnt,
// ohne zu erfahren, warum?" — der Grund steht oft bei den Auskunfteien,
// dort schaut die Bank nach; wir zeigen, OB und was bremst, mit fertigen
// Schreiben. Die Warnung vor „Kredit ohne SCHUFA" steht NICHT hier: „Kredit"
// ist auf WhatsApp gesperrt (nur „Kreditkarte" ist freigegeben, WHATSAPP_ERLAUBT),
// und Meta prüft Finanzthemen streng — sie bleibt der Mail (Fassung b).
// Die Lead-Vorlage (Anträge, Leads, seit E-243 auch Abbrecher) sagt ehrlich
// „mit einem FIAON-Paket wird die Auskunft günstiger" — ohne Zahl, weil der
// feste Text für privat (74 €) und Firma (199 €) stimmen muss; die Zahl nennt
// die Bestätigungsseite. Text- und Bildfassung entstehen aus DENSELBEN
// Absätzen (AUSKUNFT_ABSAETZE): Der Wortlaut kann nicht auseinanderlaufen.
// Platzhalter unverändert {{1}}–{{4}} in derselben Reihenfolge (werteFuer).
const AUSKUNFT_ABSAETZE: Record<string, string[]> = {
  [AUSKUNFT_VORLAGE]: [
    "Hallo {{1}},",
    "hier ist Mara, die digitale Assistentin von FIAON.",
    "Schon einmal abgelehnt, ohne zu erfahren, warum? Der Grund steht oft bei den Auskunfteien — "
      + "dort sieht die Bank nach, bevor sie über Ihre Karte entscheidet.",
    "In Ihrer Akte fehlt noch Ihre {{2}}. Wir holen die Daten bei {{3}} ein, erklären jeden Eintrag, "
      + "zeigen, ob und was Sie bremst, und legen fertige Schreiben zur Freigabe vor.",
    "Ihr Preis als FIAON-Kunde: {{4}} einmalig, ohne Abo. Über den Knopf sehen Sie alles in Ruhe; "
      + "beauftragt ist erst, wenn Sie auf der nächsten Seite bestätigen. "
      + "Schon eine aktuelle Auskunft? Dann laden Sie sie in Ihrem Bereich hoch.",
    "Fragen beantworte ich gern hier, oder ich hole Ihren Betreuer dazu.",
    AUSKUNFT_STOPP_SATZ,
  ],
  [AUSKUNFT_LEAD_VORLAGE]: [
    "Hallo {{1}},",
    "hier ist Mara, die digitale Assistentin von FIAON.",
    "Schon einmal abgelehnt, ohne zu erfahren, warum? Der Grund steht oft bei den Auskunfteien — "
      + "dort sieht die Bank nach, bevor sie über Ihre Karte entscheidet.",
    "Mit Ihrer {{2}} sehen Sie vorher, was dort steht: Wir holen die Daten bei {{3}} ein, erklären jeden Eintrag, "
      + "zeigen, ob und was Sie bremst, und legen fertige Schreiben zur Freigabe vor.",
    "Ihr Preis: {{4}} einmalig, ohne Abo — mit einem FIAON-Paket wird die Auskunft günstiger. "
      + "Über den Knopf sehen Sie alles in Ruhe; beauftragt ist erst, wenn Sie auf der nächsten Seite bestätigen.",
    "Fragen beantworte ich gern hier, oder ich verbinde Sie mit einem Menschen aus unserem Team.",
    AUSKUNFT_STOPP_SATZ,
  ],
};
/** Textfassung (E-243): ein Absatz, die Absätze mit Leerzeichen verbunden. */
const auskunftText = (name: string) => AUSKUNFT_ABSAETZE[name].join(" ");

const WA_VORLAGEN_AUSKUNFT: WaVorlage[] = [
  {
    name: AUSKUNFT_VORLAGE,
    kopf: "Ihre Bonitätsauskunft fehlt noch",
    fuss: "FIAON LTD · Mara Lindner",
    kategorie: "MARKETING",
    zweck: "Angebot der Bonitätsauskunft an zahlende Kunden ohne Auskunft — Winkel „abgelehnt, ohne zu erfahren, warum?“, Kundenpreis, Knopf zur Bestätigungsseite, Hochlade-Weg im Bereich.",
    // Integration 26.09.2026 (E-243): frühestens 1 Tag nach Mail a (vorher 3), Fenster Mo–So 07:00–20:30.
    wann: "Gruppe „Auskunft fehlt“ der WA-Zentrale und Verkaufstakt (frühestens 1 Tag nach der Angebots-Mail, Mo–So 07:00–20:30) — zahlende Kunden ohne Auskunft, "
      + "je nach Verkaufskreis (auskunft_verkauf_kreis) nur ab dem 02.09.2026 12:35 oder alle; nur mit WhatsApp-Einwilligung, einmal je Kunde, "
      + "zusammen mit fiaon_kk_auskunft_lead höchstens auskunft_verkauf_wa_pro_tag am Tag.",
    text: auskunftText(AUSKUNFT_VORLAGE),
    // {{1}} ist der ganze Name wie bei der Monatsrate (werteFuer: k.name) — das Beispiel zeigt es so.
    beispiele: ["Maria Muster", "SCHUFA-Auskunft", "SCHUFA, CRIF und Creditreform Boniversum", "74 €"],
    knoepfe: [AUSKUNFT_KAUF, FRAGE, STOPP],
  },
  {
    name: AUSKUNFT_LEAD_VORLAGE,
    kopf: "Was die Bank über Sie sieht",
    fuss: "FIAON LTD · Mara Lindner",
    kategorie: "MARKETING",
    zweck: "Angebot der Bonitätsauskunft an fertige Anträge ohne Zahlung, Leads und Abbrecher — Winkel „abgelehnt, ohne zu erfahren, warum?“, "
      + "Einzelpreis mit dem Hinweis, dass die Auskunft mit Paket günstiger ist, Knopf zur Bestätigungsseite; ohne Akte, Betreuer und Hochlade-Weg.",
    wann: "Nur im Verkaufskreis „alle“ (auskunft_verkauf_kreis): Verkaufstakt und WA-Zentrale für Antrag fertig ohne Zahlung (B), Leads (C) und Abbrecher ohne Auskunft — "
      + "nur mit WhatsApp-Einwilligung, einmal je Mensch, zusammen mit fiaon_kk_auskunft höchstens auskunft_verkauf_wa_pro_tag am Tag.",
    text: auskunftText(AUSKUNFT_LEAD_VORLAGE),
    beispiele: ["Maria Muster", "SCHUFA-Auskunft", "SCHUFA, CRIF und Creditreform Boniversum", "149 €"],
    knoepfe: [AUSKUNFT_KAUF, FRAGE, STOPP],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// DIE BILDFASSUNGEN (23.09.2026, E-229)
//
// Justin: „Warum sieht die WhatsApp-Vorlage dennoch so beschissen aus — man
// kann da richtig schöne Vorlagen erstellen … bitte, das ist total wichtig,
// mach diese PERFEKT."
//
// Was eine WhatsApp-Nachricht „schön" macht, ist bei Meta eng begrenzt: ein
// Kopf (Text, Bild, Video oder Dokument), ein Text mit Absätzen, eine
// Fußzeile, Knöpfe. Farbe gibt es nur im Kopfbild. Die Bildfassungen nutzen
// genau das: ein Kopfbild im FIAON-CI (Navy-Glas, Blau-Paar, dünne Schrift,
// „FIAON Ltd."), denselben geprüften Wortlaut in kurze Absätze gegliedert,
// „FIAON Ltd." in der Fußzeile.
//
// ── WARUM EIGENE NAMEN (fiaon_kkb_*) ─────────────────────────────────────
// Eine Vorlage in Prüfung kann nicht senden. Würden die freigegebenen
// Textfassungen umgebaut, stünde jede WhatsApp still, bis Meta fertig ist.
// So laufen beide nebeneinander: waSenden nimmt die Bildfassung, sobald sie
// freigegeben ist, und bis dahin die Textfassung. Kein Aufrufer muss davon
// wissen — sie alle nennen weiter den Namen der Textfassung.
//
// ── WAS DIE BILDER NIE ZEIGEN ────────────────────────────────────────────
// Kein „Zahlung eingegangen" an jemanden mit offener Rechnung, keine
// abgehakten Schritte an jemanden, der noch nicht angefangen hat, kein
// scheinbar echter QR-Code, kein Kartennetz-Logo. Das Bild ist Teil der
// Aussage und muss für jeden stimmen, der es bekommt.
// ═══════════════════════════════════════════════════════════════════════════
export const BILD_PRAEFIX = "fiaon_kkb_";
export const bildName = (name: string) => name.replace(/^fiaon_kk_/, BILD_PRAEFIX);

const BILD_FUER: Record<string, WaBild> = {
  fiaon_kk_anfrage: "karte",
  fiaon_kk_nicht_erreicht: "termin",
  fiaon_kk_termin: "termin",
  fiaon_kk_antrag_offen: "antrag",
  fiaon_kk_aktivierung: "zahlung",
  fiaon_kk_aktiviert: "karte",
  fiaon_kk_unterlagen: "antrag",
  fiaon_kk_termin_morgen: "termin",
  fiaon_kk_rueckfrage: "kontakt",
  fiaon_kk_empfehlung: "kontakt",
  fiaon_kk_tag1: "karte",
  fiaon_kk_tag3: "antrag",
  fiaon_kk_tag7: "termin",
  fiaon_kk_rechnung: "zahlung",
  fiaon_kk_letzte: "karte",
  // Nicht „zahlung": dieses Bild sagt „Zahlung und Aktivierung" — bei Bestandskunden falsch.
  fiaon_kk_rate: "kontakt",
  // E-241: „Ihr Weg zur Kreditkarte" — die Auskunft ist ein Schritt dorthin; kein Bild zeigt eine Zahlung.
  fiaon_kk_auskunft: "karte",
  fiaon_kk_auskunft_lead: "karte",
};

/**
 * Derselbe Wortlaut, in Absätze gegliedert. Platzhalter in derselben
 * Reihenfolge wie in der Textfassung — waSenden schickt für beide dieselben Werte.
 */
const ABSAETZE: Record<string, string> = {
  fiaon_kk_anfrage: "Hallo {{1}},\n\nhier ist Mara Lindner von FIAON — ich bin die digitale Assistentin im Team.\n\n"
    + "Ihre Anfrage für Ihre Kreditkarte liegt auf meinem Tisch. Ihr Antrag ist bereits vorbereitet, Ihre Angaben stehen drin — es fehlen nur wenige Minuten.\n\n"
    + "Danach geht es direkt zur Partnerbank: Bei Zusage ist Ihre Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist nutzen Sie sie schon vorher in der App mit Apple Pay.\n\n"
    + "Über den Knopf geht es weiter. Wenn Sie lieber mit einem Menschen sprechen, sagen Sie es mir hier.",
  fiaon_kk_nicht_erreicht: "Hallo {{1}},\n\nhier ist {{2}} von FIAON — ich habe gerade versucht, Sie zu erreichen.\n\n"
    + "Es geht um Ihre Kreditkarte: Ihre Anfrage liegt bei mir, und es fehlt nur noch Ihr Ja.\n\n"
    + "Suchen Sie sich ein Zeitfenster aus, dann rufe ich Sie genau dann an und wir bringen es zu Ende.",
  fiaon_kk_termin: "Hallo {{1}},\n\nhier ist {{2}} von FIAON. Damit Ihre Kreditkarte zügig auf den Weg kommt, reicht ein kurzes Gespräch — meist sind es fünf Minuten.\n\n"
    + "Suchen Sie sich ein Zeitfenster aus, dann melde ich mich genau dann.",
  fiaon_kk_antrag_offen: "Hallo {{1}},\n\nSie waren fast durch — alles, was Sie eingetragen haben, ist gespeichert.\n\n"
    + "Zwischen Ihnen und Ihrer eigenen Kreditkarte stehen noch wenige Minuten.\n\n"
    + "Der Knopf bringt Sie genau an die Stelle zurück, an der Sie aufgehört haben.",
  fiaon_kk_aktivierung: "Hallo {{1}},\n\nIhr Antrag ist angekommen — jetzt fehlt nur noch die Aktivierung.\n\n"
    + "Mit der ersten Zahlung ist Ihr Konto aktiv, und Sie bekommen direkt den fertigen Link unserer Partnerbank für Ihre Kreditkarte.\n\n"
    + "Über den Knopf sehen Sie den QR-Code für Ihre Banking-App und Ihren Verwendungszweck.",
  fiaon_kk_aktiviert: "Hallo {{1}},\n\nIhr Konto ist aktiviert — und der Link unserer Partnerbank für Ihre Kreditkarte ist auf dem Weg zu Ihnen.\n\n"
    + "Bei Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist nutzen Sie sie schon vorher in der App der Bank mit Apple Pay.",
  fiaon_kk_unterlagen: "Hallo {{1}},\n\nhier ist {{2}} von FIAON. Ihre Kreditkarte ist auf dem Weg, an einer Stelle warte ich noch auf Sie: {{3}}.\n\n"
    + "In Ihrem Bereich laden Sie das in zwei Minuten hoch, dann geht es sofort weiter.",
  fiaon_kk_termin_morgen: "Hallo {{1}},\n\nkurze Erinnerung: Wir sprechen {{2}} über Ihre Kreditkarte und die letzten Schritte dorthin.\n\n"
    + "Passt die Zeit noch? Eine Nachricht hier genügt, dann verschieben wir.",
  fiaon_kk_rueckfrage: "Hallo {{1}},\n\nhier ist {{2}} von FIAON. Ich habe eine kurze Rückfrage zu Ihrer Kreditkarte.\n\n"
    + "Antworten Sie einfach auf diese Nachricht, dann bringen wir es heute zu Ende.",
  fiaon_kk_empfehlung: "Hallo {{1}},\n\nSie hatten gefragt, ob Sie FIAON weiterempfehlen können — sehr gern.\n\n"
    + "Über den Knopf öffnet sich Ihr persönlicher Link zum Weiterempfehlen. Wer ihn benutzt, ist Ihnen zugeordnet, und wir melden uns bei Ihnen, sobald daraus etwas geworden ist.",
  fiaon_kk_tag1: "Hallo {{1}},\n\nhier noch einmal Mara Lindner von FIAON. Ihre Anfrage für Ihre Kreditkarte liegt weiterhin bei mir, und Ihr Antrag ist vorbereitet — ausgefüllt bis auf wenige Angaben.\n\n"
    + "Je früher er steht, desto früher geht er zur Partnerbank.",
  fiaon_kk_tag3: "Hallo {{1}},\n\nIhr Weg zur eigenen Kreditkarte in drei Schritten:\n\n"
    + "1. Antrag abschließen\n2. Konto aktivieren\n3. Den fertigen Link unserer Partnerbank öffnen\n\n"
    + "Bei Zusage der Bank ist Ihre Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist nutzen Sie sie schon vorher in der App mit Apple Pay. "
    + "Der erste Schritt dauert wenige Minuten — den Rest übernehmen wir.",
  fiaon_kk_tag7: "Hallo {{1}},\n\nfünf Minuten am Telefon klären meist alles: was Ihre Kreditkarte für Sie möglich macht, wie der Weg dorthin aussieht und was von Ihnen dafür gebraucht wird.\n\n"
    + "Suchen Sie sich ein Zeitfenster aus.",
  fiaon_kk_rechnung: "Hallo {{1}},\n\nIhre Rechnung über {{2}} € ist noch offen — Verwendungszweck {{3}}.\n\n"
    + "Sobald die Zahlung bei uns eingeht, aktiviere ich Ihr Konto umgehend, und Sie bekommen direkt den fertigen Link unserer Partnerbank für Ihre Kreditkarte. "
    + "Je schneller die Zahlung da ist, desto schneller halten Sie die Karte in der Hand.\n\n"
    + "Über den Knopf sehen Sie den QR-Code für Ihre Banking-App und alle Bankdaten.",
  fiaon_kk_letzte: "Hallo {{1}},\n\nIhr Antrag ist weiterhin vorbereitet und Ihr Platz steht.\n\n"
    + "Ein Klick, ein paar Minuten, dann ist Ihre Kreditkarte in Reichweite. Soll ich ihn für Sie offenhalten?",
  fiaon_kk_rate: "Hallo {{1}},\n\neine kurze Erinnerung von FIAON: Ihre Monatsrate über {{2}} € war am {{3}} fällig — Verwendungszweck {{4}}.\n\n"
    + "Über den Knopf öffnen Sie Ihre Zahlungsseite mit dem QR-Code für Ihre Banking-App; Empfänger, Betrag und Verwendungszweck sind dort schon ausgefüllt.\n\n"
    + "Schon überwiesen? Dann hat sich diese Nachricht mit Ihrer Zahlung überschnitten — Sie müssen nichts weiter tun.\n\n"
    + "Haben Sie eine Frage zu Ihrer Rate, antworten Sie einfach auf diese Nachricht.",
  // E-243 (26.09.2026): dieselben Absätze wie die Textfassung (AUSKUNFT_ABSAETZE), mit Leerzeile gegliedert.
  [AUSKUNFT_VORLAGE]: AUSKUNFT_ABSAETZE[AUSKUNFT_VORLAGE].join("\n\n"),
  [AUSKUNFT_LEAD_VORLAGE]: AUSKUNFT_ABSAETZE[AUSKUNFT_LEAD_VORLAGE].join("\n\n"),
};

/** Fußzeile der Bildfassung: „FIAON Ltd." vorne, dann was die Textfassung sagt. */
const fussBild = (fuss?: string) => {
  const rest = String(fuss || "").replace(/^FIAON LTD\s*·?\s*/i, "").trim();
  return (rest ? `FIAON Ltd. · ${rest}` : "FIAON Ltd.").slice(0, 60);
};

// E-241: Die Auskunft-Vorlagen gehören zum Register (eingereicht, mit Bildfassung) — siehe oben.
export const WA_VORLAGEN_BILD: WaVorlage[] = [...WA_VORLAGEN_TEXT, ...WA_VORLAGEN_AUSKUNFT].map((v) => ({
  ...v,
  name: bildName(v.name),
  kopf: undefined,
  kopfBild: BILD_FUER[v.name] ?? "karte",
  text: ABSAETZE[v.name] ?? v.text,
  fuss: fussBild(v.fuss),
  varianteVon: v.name,
}));

/**
 * ALLE Vorlagen des Hauses: erst die Textfassungen (die Aufrufer nennen),
 * dann die Bildfassungen. Einreichen, Aufräumen und die Prüfstände sehen
 * beide — Aufräumen darf die Bildfassungen nie für Altlast halten.
 */
export const WA_VORLAGEN: WaVorlage[] = [...WA_VORLAGEN_TEXT, ...WA_VORLAGEN_AUSKUNFT, ...WA_VORLAGEN_BILD];

// ═══════════════════════════════════════════════════════════════════════════
// ENTWÜRFE — BEREITGELEGT, NICHT EINGEREICHT (24.09.2026, E-240)
//
// Hier lag bis zum 25.09. fiaon_kk_auskunft: WERBUNG an Bestandskunden, die
// Justin erst lesen sollte, bevor sie bei Meta eingereicht wird. Mit E-241
// („an ALLE … jeden Tag 30 per WhatsApp") steht sie mit fiaon_kk_auskunft_lead
// im Register oben (WA_VORLAGEN_AUSKUNFT) und wird mit „Vorlagen einreichen"
// eingereicht. Die Liste bleibt als Ort für den nächsten Entwurf: WA-Zentrale
// (vorlageDef, Vorlagenliste) und Chefseite lesen sie weiter mit.
// ═══════════════════════════════════════════════════════════════════════════
export const WA_VORLAGEN_ENTWURF: WaVorlage[] = [];
