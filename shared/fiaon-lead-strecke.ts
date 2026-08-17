// ═══════════════════════════════════════════════════════════════════════════
// DIE EWIGE LEAD-STRECKE — Kadenz und Inhalte
//
// ── DIE REGEL DES BETREIBERS ───────────────────────────────────────────────
// „Leads ohne Antrag bekommen eine E-Mail-Strecke, die NIE endet."
//
// GEMESSEN am 18.08.2026: Die alte Strecke endet nach sechs Mails. 1.483 Leads
// stehen am Ende und bekommen nichts mehr, 2.700 lebende Leads ohne Antrag
// warten auf eine Fortsetzung. Und 23 Kunden kamen erst nach der achten Mail —
// wer bei sechs aufhört, verliert genau die.
//
// ── ABER NIEMALS OHNE VERSTAND ─────────────────────────────────────────────
// „Nie endend" heißt nicht „egal". Vier Dinge halten die Strecke sauber:
//
//   1. ABSTAND. Nach dem ersten Monat nur noch EINMAL monatlich. Wer wöchentlich
//      schreibt, landet im Spam-Ordner — und nimmt jede andere Mail des Hauses
//      mit hinein.
//   2. ROTATION. Zwölf Varianten, die sich abwechseln. Dieselbe Mail zum
//      dritten Mal ist eine Beleidigung.
//   3. ABMELDUNG. In JEDER Mail, ein Klick, ohne Rückfrage.
//   4. STOPP HEISST STOPP. Antrag, Kunde, Abmeldung, tote Adresse, DSGVO, Test.
//
// ── WORTHYGIENE (nicht verhandelbar) ───────────────────────────────────────
// Keine Kartenversprechen. Keine Limits. Keine „Beratung". Kein „garantiert".
// Wir bieten eine Plattform und eine Bonitätsauskunft — nichts, was nach
// Kreditvermittlung oder Finanzberatung klingt. Geduzt wird durchgehend.
//
// Die Liste `VERBOTENE_WORTE` wird vom Prüfstand über JEDE Variante geprüft.
// Eine Regel, die nur in einer Schulung steht, gilt bis zur ersten Vertretung.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Die Kadenz in TAGEN seit dem Einstieg in die Strecke.
 *
 * Nach dem letzten festen Tag läuft es monatlich weiter — für immer.
 */
export const KADENZ_TAGE = [1, 3, 7, 14, 30] as const;

/** Abstand danach: einmal im Monat. */
export const MONATS_ABSTAND_TAGE = 30;

/**
 * Der frühestmögliche Abstand zwischen zwei Mails an denselben Menschen.
 *
 * Sicherheitsnetz gegen Doppelläufe und gegen einen Tippfehler in der Kadenz.
 * Zwei Mails an einem Tag sind kein Nachfassen, das ist Belästigung.
 */
export const MINDESTABSTAND_STUNDEN = 20;

export interface StreckenVariante {
  /** Stabiler Schlüssel — er landet im Protokoll. */
  key: string;
  /** Worum es geht — für den Betreiber, nicht für den Kunden. */
  art: "nutzen" | "einwand" | "beweis" | "erinnerung" | "termin" | "auskunft";
  betreff: string;
  /** Der Text. Duzen, kurz, ein Gedanke. */
  text: string;
}

/**
 * Zwölf Varianten. Sie rotieren, und der Prüfstand hält die Zahl.
 *
 * Jede endet OHNE Grußformel und ohne Abmelde-Zeile — beides hängt der Versand
 * an (`streckenMail`), damit es nicht elfmal vergessen werden kann.
 */
export const VARIANTEN: StreckenVariante[] = [
  {
    key: "nutzen-uebersicht",
    art: "nutzen",
    betreff: "Was du bei FIAON tatsächlich bekommst",
    text: "du hattest dich für FIAON interessiert — hier in drei Sätzen, was dahintersteht.\n\n"
      + "Du bekommst eine Plattform, die deine Unterlagen sortiert, deinen Stand sichtbar macht "
      + "und dir Schritt für Schritt zeigt, was als Nächstes dran ist. Dazu einen Menschen, den "
      + "du anrufen kannst.\n\n"
      + "Kein Papierkram, den du allein sortieren musst. Kein Warten darauf, dass sich jemand meldet.",
  },
  {
    key: "erinnerung-antrag",
    art: "erinnerung",
    betreff: "Dein Antrag liegt noch offen",
    text: "du hast angefangen, den Antrag auszufüllen — abgeschickt ist er noch nicht.\n\n"
      + "Das dauert keine fünf Minuten, und danach weißt du, wo du stehst. "
      + "Der Link unten führt genau dorthin zurück, wo du aufgehört hast.",
  },
  {
    key: "einwand-zeit",
    art: "einwand",
    betreff: "„Dafür habe ich gerade keine Zeit\u201c",
    text: "das hören wir oft, und es stimmt meistens.\n\n"
      + "Deshalb: Der Antrag dauert fünf Minuten. Alles danach übernehmen wir — "
      + "du bekommst eine Nachricht, wenn etwas von dir gebraucht wird, und sonst nicht.\n\n"
      + "Fünf Minuten jetzt sparen dir das Suchen später.",
  },
  {
    key: "termin-anruf",
    art: "termin",
    betreff: "Lieber kurz telefonieren?",
    text: "manche Fragen klärt ein Gespräch schneller als jede E-Mail.\n\n"
      + "Such dir einen Zeitpunkt aus, der dir passt — wir rufen dich an. "
      + "Fünfzehn Minuten, und du weißt, ob FIAON etwas für dich ist.",
  },
  {
    key: "beweis-alltag",
    art: "beweis",
    betreff: "Wie es bei anderen läuft",
    text: "die meisten, die bei uns anfangen, haben vorher versucht, es allein zu sortieren.\n\n"
      + "Was sie danach am häufigsten sagen: Sie wussten endlich, was als Nächstes dran ist. "
      + "Nicht weil wir etwas Magisches tun, sondern weil jemand die Reihenfolge kennt.",
  },
  {
    key: "auskunft-grundstein",
    art: "auskunft",
    betreff: "Der erste Schritt ist immer derselbe",
    text: "bevor irgendetwas anderes Sinn hat, braucht es einen Überblick: "
      + "Was steht eigentlich über dich in den Auskunfteien?\n\n"
      + "Diese Auskunft ist der Grundstein — sie kostet einmalig 74 € und wird "
      + "neutral abgerufen, verändert also nichts an deinem Stand. Du siehst danach "
      + "schwarz auf weiß, wo du anfängst.",
  },
  {
    key: "einwand-kosten",
    art: "einwand",
    betreff: "Was kostet das eigentlich?",
    text: "eine berechtigte Frage, und die Antwort steht auf der Seite — nicht im Kleingedruckten.\n\n"
      + "Es gibt vier Pakete, monatlich kündbar. Dazu einmalig die Bonitätsauskunft für 74 €. "
      + "Keine Anschlussgebühr, keine Mindestlaufzeit, keine Überraschung auf dem Kontoauszug.",
  },
  {
    key: "nutzen-unterlagen",
    art: "nutzen",
    betreff: "Der Ordner, den du nie anlegen musstest",
    text: "das Lästigste an solchen Dingen ist nicht die Entscheidung — es ist das Zusammensuchen.\n\n"
      + "Bei FIAON lädst du hoch, was du hast, und die Plattform sagt dir, was fehlt. "
      + "Kein Rätselraten, welches Dokument gemeint ist.",
  },
  {
    key: "erinnerung-offen",
    art: "erinnerung",
    betreff: "Steht das noch auf deiner Liste?",
    text: "falls du es aus den Augen verloren hast: Dein Zugang wartet noch.\n\n"
      + "Wenn es gerade nicht passt, ist das völlig in Ordnung — meld dich, wenn es passt. "
      + "Wenn du gar nichts mehr hören willst, steht unten der Weg dafür.",
  },
  {
    key: "beweis-warum-mensch",
    art: "beweis",
    betreff: "Warum bei uns ein Mensch anruft",
    text: "wir könnten alles über Formulare abwickeln. Wir tun es nicht.\n\n"
      + "Denn die eine Frage, die dich wirklich beschäftigt, steht in keinem Formular. "
      + "Deshalb ruft dich jemand an, der deine Unterlagen kennt — und nicht ein Callcenter, "
      + "das deinen Namen zum ersten Mal liest.",
  },
  {
    key: "einwand-vertrauen",
    art: "einwand",
    betreff: "Woher weiß ich, dass das seriös ist?",
    text: "eine Frage, die du stellen solltest.\n\n"
      + "Was du prüfen kannst: Impressum, Datenschutzerklärung und AGB stehen offen auf der "
      + "Seite. Es gibt keine Vorkasse für Versprechen, sondern ein monatliches Paket, das "
      + "du jederzeit beenden kannst. Und du bekommst einen Namen, keine Hotline-Nummer.",
  },
  {
    key: "termin-letzte",
    art: "termin",
    betreff: "Ein Anruf, dann weißt du es",
    text: "wir schreiben dir seit einer Weile, und du hast nicht geantwortet — das ist dein Recht.\n\n"
      + "Falls es nur daran liegt, dass Schreiben mühsam ist: Wähl einen Zeitpunkt, wir rufen an. "
      + "Und falls du wirklich nichts mehr hören willst, ist der Weg dafür unten. "
      + "Dann ist es das letzte Mal.",
  },
];

/** Verbotene Worte — der Prüfstand geht damit über jede Variante. */
export const VERBOTENE_WORTE = [
  // Kreditvermittlung / Kartenversprechen
  "kredit", "karte garantiert", "kreditkarte", "limit", "sofortkredit",
  "schufa-frei", "schufafrei", "ohne schufa",
  // Beratung (erlaubnispflichtig)
  "beraten", "beratung", "finanzberatung", "anlageberatung",
  // Versprechen
  "garantiert", "garantie", "100 %", "sicher zu", "auf jeden fall",
  "score verbessern", "wir verbessern dein",
  // Druck
  "nur heute", "letzte chance", "läuft ab", "verfällt",
] as const;

/** Prüft einen Text auf Worthygiene. Gibt die Verstöße zurück. */
export function worthygiene(text: string): string[] {
  const t = text.toLowerCase();
  return VERBOTENE_WORTE.filter((w) => t.includes(w));
}

/**
 * Welche Variante ist für diese Stufe dran?
 *
 * Rotiert reihum und beginnt nach dem Durchlauf wieder vorn — aber versetzt,
 * damit die zweite Runde nicht identisch zur ersten ist. Der Lead-Schlüssel
 * geht in den Versatz ein: Zwei Menschen, die am selben Tag einsteigen,
 * bekommen nicht dieselbe Reihenfolge.
 */
export function varianteFuer(stufe: number, leadId: number): StreckenVariante {
  const n = VARIANTEN.length;
  // Die erste Mail ist für JEDEN dieselbe: Sie erklärt, was FIAON ist. Danach
  // rotiert es. Wer als Erstes einen Einwand behandelt bekommt, den er nie
  // geäußert hat, fühlt sich nicht angesprochen.
  if (stufe <= 1) return VARIANTEN[0];
  const runde = Math.floor((stufe - 1) / n);
  const versatz = (leadId % n) * runde;
  return VARIANTEN[((stufe - 1) + versatz) % n];
}

/**
 * Wann ist die nächste Mail fällig? — Tage seit dem Einstieg.
 *
 * Stufe 0 = noch keine verschickt → die erste ist nach KADENZ_TAGE[0] fällig.
 * Nach der letzten festen Stufe: monatlich, ohne Ende.
 */
export function faelligNachTagen(stufe: number): number {
  if (stufe < KADENZ_TAGE.length) return KADENZ_TAGE[stufe];
  const ueber = stufe - KADENZ_TAGE.length + 1;
  return KADENZ_TAGE[KADENZ_TAGE.length - 1] + ueber * MONATS_ABSTAND_TAGE;
}

/** Der Klartext der Kadenz — für die Admin-Ansicht. */
export function kadenzText(): string {
  return `T+${KADENZ_TAGE.join(", T+")}, danach alle ${MONATS_ABSTAND_TAGE} Tage — ohne Ende.`;
}
