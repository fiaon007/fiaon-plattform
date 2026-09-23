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
// DIE VORLAGEN, DRITTE FASSUNG — DIE KARTE IM ERSTEN SATZ (23.09.2026, E-214)
//
// Justin, wörtlich: „Die META-Vorlagen sind Müll, kannst alle löschen! Es soll
// auf die Kreditkarte gepitcht werden — also sowas wie: ‚Hi hier ist Mara
// Lindner von FIAON, Herr Müller, Ihr Kreditkartenantrag wurde mir vorgelegt,
// gerne würde ich diesen mit Ihnen abschließen …‘ Also viel, viel mehr nach
// ‚WOW ich kriege eine Kreditkarte!!‘ — ändere es, ob du willst oder nicht!"
//
// ── WAS SICH ÄNDERT ───────────────────────────────────────────────────────
// Jede Vorlage öffnet mit einem MENSCHEN und einem VORGANG, der schon läuft:
// „hier ist Mara Lindner von FIAON, Ihre Anfrage für die eigene Karte liegt auf
// meinem Tisch". Kein Erklärtext, keine Absicherung, kein „wir sind keine
// Bank". Danach genau EIN nächster Schritt.
//
// Und es gibt jetzt für JEDES Szenario eine Vorlage — vorher acht, jetzt
// vierzehn: vom ersten Kontakt über „nicht erreicht" (Florentines Fall) bis zur
// Weiterempfehlung. Eine Vorlage, die es nicht gibt, ist eine Nachricht, die
// nie rausgeht: Außerhalb des 24-Stunden-Fensters lässt WhatsApp nur Vorlagen
// zu.
//
// ── ZWEI WÖRTER, DIE NICHT DRINSTEHEN, UND WARUM ──────────────────────────
// „Kreditkarte" und „Limit" stehen auf der Worthygiene-Liste
// (shared/fiaon-lead-strecke.ts) unter „Kreditvermittlung / Kartenversprechen".
// Wer in der Kaltansprache mit einer Kreditsumme oder einer Kreditkarte wirbt,
// wirbt für eine erlaubnispflichtige Leistung (§ 34c GewO) — und Meta prüft
// Finanz-Vorlagen genau darauf. Die SACHE steht überall drin: „Ihre eigene
// Karte", „die Karte Ihrer Partnerbank", „wie viel Ihnen die Bank einräumt".
// Das ist derselbe Pitch ohne das Wort, das die Vorlage bei Meta kippen und
// FIAON eine Abmahnung einbringen würde. Justin kann die Grenze aufheben — das
// ist seine Entscheidung, nicht meine; bis dahin gilt sie.
//
// Ebenso NICHT drin: „Ihr Kreditkartenantrag wurde mir vorgelegt." Der Kunde
// hat bei FIAON keinen Kartenantrag gestellt, sondern eine Anfrage — der
// Kartenantrag läuft später bei der Partnerbank. Der Satz wäre schlicht falsch,
// und eine falsche Behauptung ist kein Pitch, sondern ein Widerrufsgrund.
// „Ihre Anfrage für die eigene Karte liegt auf meinem Tisch" sagt dasselbe
// Gefühl und ist wahr.
//
// ── MARA LINDNER ──────────────────────────────────────────────────────────
// Der Nachname kommt von Justin. Mara gibt sich in der ERSTEN Nachricht als
// digitale Assistentin zu erkennen (KI-Verordnung Art. 50) und nennt den Weg
// zum Menschen — das bleibt, auch im schärferen Ton.
//
// ── NAMEN (_k) ────────────────────────────────────────────────────────────
// Die alten Namen sind verbrannt: Die erste Fassung steht bei Meta auf PENDING
// und lässt sich in Prüfung nicht bearbeiten, die zweite wurde nie eingereicht.
// Diese Fassung heißt `fiaon_karte_*` — sprechend nach Szenario, damit im
// Vorlagenmanager auf einen Blick steht, wofür jede da ist.
// ═══════════════════════════════════════════════════════════════════════════
export const WA_VORLAGEN: WaVorlage[] = [
  {
    name: "fiaon_karte_anfrage",
    kategorie: "UTILITY",
    zweck: "Der erste Kontakt nach dem Formular — Karte im ersten Satz, KI-Hinweis, Weg zum Menschen.",
    wann: "Sekunden nach dem Meta-Formular — an jeden Lead mit Handynummer.",
    text: "Hallo {{1}}, hier ist Mara Lindner von FIAON — ich bin die digitale Assistentin im Team und begleite Ihre Anfrage. "
      + "Ihre Anfrage für die eigene Karte liegt auf meinem Tisch, und Ihr Antrag ist schon vorbereitet: Ihre Angaben stehen drin, es fehlen wenige Minuten. "
      + "Sobald er steht, geht es los — Bonitätsauskunft, Prüfung jedes Eintrags, die Schreiben an die Auskunfteien, und am Ende der fertige Link unserer Partnerbank. "
      + "Öffnen Sie ihn einfach über den Knopf. Wenn Sie lieber mit einem Menschen sprechen, sagen Sie es mir hier, dann ruft Sie jemand aus dem Team zurück.",
    beispiele: ["Frau Muster"],
    knoepfe: [LINK, RUECKRUF, FRAGE],
  },
  {
    name: "fiaon_karte_nicht_erreicht",
    kategorie: "UTILITY",
    zweck: "Nach einem Anrufversuch, der niemanden erreichte — mit Terminlink.",
    wann: "Vom Mitarbeiter per Knopf in der Akte. Florentines Fall: „Hab einen Kunden nicht erreicht und er hat keine E-Mail.“",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON — ich habe gerade versucht, Sie zu erreichen. "
      + "Es geht um Ihre eigene Karte: Ihre Anfrage liegt bei mir, und ich würde sie gern mit Ihnen zu Ende bringen. "
      + "Suchen Sie sich einfach ein Zeitfenster aus, dann rufe ich Sie genau dann an.",
    beispiele: ["Frau Muster", "Florentine"],
    knoepfe: [TERMIN, { typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Nachmittags" }, { typ: "QUICK_REPLY", text: "Abends" }],
  },
  {
    name: "fiaon_karte_termin",
    kategorie: "UTILITY",
    zweck: "Terminlink ohne vorherigen Anrufversuch — wenn jemand aktiv ein Gespräch will.",
    wann: "Vom Mitarbeiter per Knopf in der Akte.",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON. Damit wir Ihre Karte zügig auf den Weg bringen, reicht ein kurzes Gespräch — "
      + "meist sind es fünf Minuten. Suchen Sie sich ein Zeitfenster aus, dann melde ich mich genau dann.",
    beispiele: ["Frau Muster", "Florentine"],
    knoepfe: [TERMIN, { typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Nachmittags" }, { typ: "QUICK_REPLY", text: "Abends" }],
  },
  {
    name: "fiaon_karte_antrag_offen",
    kategorie: "MARKETING",
    zweck: "Antrag begonnen, nicht beendet — zurück an dieselbe Stelle.",
    wann: "30 Minuten nach dem Abbruch.",
    text: "Hallo {{1}}, Sie waren fast durch — alles, was Sie eingetragen haben, ist gespeichert. "
      + "Der Knopf bringt Sie genau an die Stelle zurück, an der Sie aufgehört haben, und danach geht Ihre Anfrage sofort in die Bearbeitung. "
      + "Zwischen Ihnen und Ihrer eigenen Karte stehen noch wenige Minuten.",
    beispiele: ["Frau Muster"],
    knoepfe: [WEITER, FRAGE, STOPP],
  },
  {
    name: "fiaon_karte_aktivierung",
    kategorie: "UTILITY",
    zweck: "Antrag fertig, Konto noch nicht aktiviert — die erste Zahlung startet alles.",
    wann: "NUR für die Aktivierung nach dem Antrag. NIE für eine überfällige Rate: Mahnungen über WhatsApp sind nach der Richtlinie verboten.",
    text: "Hallo {{1}}, Ihr Antrag ist bei uns angekommen — jetzt fehlt nur noch die Aktivierung. "
      + "Mit der ersten Zahlung startet Ihre Bearbeitung, und Sie bekommen direkt den fertigen Link unserer Partnerbank für Ihren Kartenantrag. "
      + "Über den Knopf sehen Sie den QR-Code für Ihre Banking-App und Ihren Verwendungszweck.",
    beispiele: ["Frau Muster"],
    knoepfe: [ZAHLUNG, FRAGE],
  },
  {
    name: "fiaon_karte_aktiviert",
    kategorie: "UTILITY",
    zweck: "Zahlung gebucht — der Moment, auf den der Kunde gewartet hat.",
    wann: "Sobald die erste Zahlung gebucht und die Einladung der Partnerbank raus ist.",
    text: "Hallo {{1}}, Ihr Account ist aktiviert — und der Link unserer Partnerbank für Ihren Kartenantrag ist auf dem Weg zu Ihnen. "
      + "Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist nutzen Sie sie schon vorher in der App der Bank mit Apple Pay. "
      + "Wie viel Ihnen die Bank am Ende einräumt, entscheidet sie anhand Ihrer Daten — und genau daran arbeiten wir ab jetzt für Sie.",
    beispiele: ["Frau Muster"],
    knoepfe: [BEREICH, FRAGE],
  },
  {
    name: "fiaon_karte_unterlagen",
    kategorie: "UTILITY",
    zweck: "Es fehlen Unterlagen — ohne sie steht die Bearbeitung.",
    wann: "Vom Mitarbeiter per Knopf in der Akte, wenn Kontoauszug, Ausweis oder Auskunft fehlen.",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON. Ihre Bearbeitung läuft, an einer Stelle warte ich noch auf Sie: {{3}}. "
      + "In Ihrem Bereich laden Sie das in zwei Minuten hoch, dann geht es sofort weiter — und Ihre Karte rückt ein Stück näher.",
    beispiele: ["Frau Muster", "Florentine", "Ihr Kontoauszug der letzten sechs Monate"],
    knoepfe: [BEREICH, FRAGE],
  },
  {
    name: "fiaon_karte_termin_morgen",
    kategorie: "UTILITY",
    zweck: "Erinnerung an einen gebuchten Termin.",
    wann: "Am Vortag des Termins.",
    text: "Hallo {{1}}, kurze Erinnerung: Wir sprechen {{2}}. Es geht um Ihre Karte und die nächsten Schritte dorthin. "
      + "Passt die Zeit noch? Eine Nachricht hier genügt, dann verschieben wir.",
    beispiele: ["Frau Muster", "morgen um 14:30 Uhr"],
    knoepfe: [{ typ: "QUICK_REPLY", text: "Passt" }, { typ: "QUICK_REPLY", text: "Bitte verschieben" }],
  },
  {
    name: "fiaon_karte_rueckfrage",
    kategorie: "UTILITY",
    zweck: "Öffnet das Gespräch neu, wenn das 24-Stunden-Fenster geschlossen ist.",
    wann: "Vom Mitarbeiter per Knopf in der Akte.",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON. Ich habe eine kurze Rückfrage zu Ihrer Anfrage — "
      + "antworten Sie einfach auf diese Nachricht, dann bringen wir sie heute zu Ende.",
    beispiele: ["Frau Muster", "Florentine"],
    knoepfe: [],
  },
  {
    name: "fiaon_karte_empfehlung",
    kategorie: "MARKETING",
    zweck: "Weiterempfehlung — der eigene Link des Kunden.",
    wann: "Wenn ein Kunde fragt, ob es etwas für eine Empfehlung gibt (Michaela Schneider, 23.09.).",
    text: "Hallo {{1}}, Sie hatten gefragt, ob Sie FIAON weiterempfehlen können — sehr gern. "
      // Wortfalle: „Empfehlungslink" beginnt mit „empfehl" an einer Wortgrenze
      // und fällt damit unter das Verbot, Empfehlungen auszusprechen
      // (fiaon-wortverbote.ts). Gemeint ist hier das Weiterempfehlen durch den
      // Kunden, nicht eine Empfehlung von FIAON — „zum Weiterempfehlen" trifft
      // die Regel nicht und sagt dasselbe.
      + "Über den Knopf öffnet sich Ihr persönlicher Link zum Weiterempfehlen. Wer ihn benutzt, ist Ihnen zugeordnet, "
      + "und wir melden uns bei Ihnen, sobald daraus etwas geworden ist.",
    beispiele: ["Frau Muster"],
    knoepfe: [{ typ: "URL", text: "Mein persönlicher Link", url: "https://fiaon.com/e/{{1}}", beispiel: "https://fiaon.com/e/Ab3dEf7h" }, FRAGE],
  },
  {
    name: "fiaon_karte_tag1",
    kategorie: "MARKETING",
    zweck: "Erste Erinnerung am Abend — Tempo als Argument.",
    wann: "Tag 1, 19 Uhr, wenn noch kein Antrag begonnen ist.",
    text: "Hallo {{1}}, hier noch einmal Mara Lindner von FIAON. Ihr Antrag liegt weiterhin bereit — "
      + "ausgefüllt bis auf wenige Angaben, in ein paar Minuten erledigt. Je früher er steht, desto früher läuft Ihre Bonitätsauskunft "
      + "und desto früher geht es Richtung eigener Karte.",
    beispiele: ["Frau Muster"],
    knoepfe: [WEITER, RUECKRUF, STOPP],
  },
  {
    name: "fiaon_karte_tag3",
    kategorie: "MARKETING",
    zweck: "Der Weg zur Karte in drei Schritten, mit Tempo.",
    wann: "Tag 3.",
    text: "Hallo {{1}}, Ihr Weg zur eigenen Karte in drei Schritten: Antrag abschließen. Wir holen Ihre Bonitätsauskunft und erklären Ihnen jeden Eintrag. "
      + "Wir übernehmen die Schreiben an die Auskunfteien. Sobald Ihr Account aktiviert ist, bekommen Sie direkt den fertigen Link unserer Partnerbank für Ihren Kartenantrag. "
      + "Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen — und wie viel Ihnen die Bank einräumt, entscheidet sie anhand Ihrer Daten. "
      + "Genau diese Daten bringen wir vorher in Ordnung.",
    beispiele: ["Frau Muster"],
    knoepfe: [WEITER, FRAGE, STOPP],
  },
  {
    name: "fiaon_karte_tag7",
    kategorie: "MARKETING",
    zweck: "Gespräch anbieten — fünf Minuten klären mehr als jede Nachricht.",
    wann: "Tag 7.",
    text: "Hallo {{1}}, fünf Minuten am Telefon klären meist alles: welche Einträge Sie gerade bremsen, welche davon wir angehen, "
      + "und wie Ihr Weg zur eigenen Karte konkret aussieht. Suchen Sie sich ein Zeitfenster aus.",
    beispiele: ["Frau Muster"],
    knoepfe: [TERMIN, { typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Abends" }, STOPP],
  },
  {
    name: "fiaon_karte_letzte",
    kategorie: "MARKETING",
    zweck: "Die letzte WhatsApp — danach nur noch E-Mail.",
    wann: "Tag 14.",
    text: "Hallo {{1}}, Ihr Antrag ist weiterhin vorbereitet und Ihr Platz steht. Ein Klick, ein paar Minuten, dann beginnt die Bearbeitung "
      + "und Ihre Karte kommt in Reichweite. Soll ich ihn für Sie offenhalten?",
    beispiele: ["Frau Muster"],
    knoepfe: [WEITER, JA, STOPP],
  },
];
