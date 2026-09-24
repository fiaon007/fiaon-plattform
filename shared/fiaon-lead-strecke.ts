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
// Kreditvermittlung oder Finanzberatung klingt. Gesiezt wird durchgehend
// (E-002: „Sie" im ganzen Kundenkontakt — bis 22.09.2026 duzte ausgerechnet
// diese Strecke, zwischen einer gesiezten Begrüßung und gesiezten Rechnungen).
//
// Die Liste `VERBOTENE_WORTE` wird vom Prüfstand über JEDE Variante geprüft.
// Eine Regel, die nur in einer Schulung steht, gilt bis zur ersten Vertretung.
// ═══════════════════════════════════════════════════════════════════════════

import { PAKETE } from "./fiaon-pakete";
// 24.09.2026 (E-240): Der Auskunftspreis kommt aus der einen Quelle. Leads haben
// kein Paket — für sie gilt der Einzelpreis; der Kundenpreis steht daneben.
import { AUSKUNFT_PREISE_CENTS } from "./fiaon-auskunft";
import { FIAON_FIRMA } from "./fiaon-firma";

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

/** Katalogwerte für die Kosten-Variante — nie von Hand in den Text (E-210). */
const PRIVATPAKETE = PAKETE.filter((p) => p.art === "privat" && p.abo && !p.eingestellt);
const AB_CENTS = Math.min(...PRIVATPAKETE.map((p) => p.preisCents));
const EURO = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",").replace(",00", "")} €`;
const ZAHLWORT: Record<number, string> = { 2: "zwei", 3: "drei", 4: "vier", 5: "fünf", 6: "sechs" };

export interface StreckenVariante {
  /** Stabiler Schlüssel — er landet im Protokoll. */
  key: string;
  /**
   * Worum es geht — für den Betreiber, nicht für den Kunden.
   * 18.09.2026: `termin` entscheidet auch über den Knopf der Mail — „Zeitfenster
   * wählen" auf /termin statt „Jetzt Antrag starten" (streckenKnopf unten).
   */
  art: "nutzen" | "einwand" | "beweis" | "erinnerung" | "termin" | "auskunft";
  betreff: string;
  /** Der Text. Siezen, kurz, ein Gedanke. Beginnt großgeschrieben — die Anrede steht davor in einer eigenen Zeile. */
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
    betreff: "Was Sie bei FIAON tatsächlich bekommen",
    text: "Sie hatten sich für FIAON interessiert — hier in drei Sätzen, was dahintersteht.\n\n"
      + "Sie bekommen eine Plattform, die Ihre Unterlagen sortiert, Ihren Stand sichtbar macht "
      + "und Ihnen Schritt für Schritt zeigt, was als Nächstes dran ist. Dazu einen Menschen, den "
      + "Sie anrufen können.\n\n"
      + "Kein Papierkram, den Sie allein sortieren müssen. Kein Warten darauf, dass sich jemand meldet.",
  },
  // 18.09.2026: Hier stand „du hast angefangen, den Antrag auszufüllen … Der
  // Link unten führt genau dorthin zurück, wo du aufgehört hast." Beides trifft
  // niemanden, der diese Mail bekommt: Die Strecke schreibt NUR Leads ohne
  // Antrag an (faellige() in server/lib/fiaon-lead-strecke.ts schließt jeden
  // mit Bestellung aus). Seit E-210 (22.09.2026) stimmt dafür etwas anderes:
  // Der Knopf ist der persönliche Link, Name, E-Mail und Telefon stehen schon drin.
  {
    key: "erinnerung-antrag",
    art: "erinnerung",
    betreff: "Ihr Antrag fehlt noch",
    text: "Sie hatten sich bei uns gemeldet — Ihren Antrag haben Sie aber noch nicht gestellt.\n\n"
      + "Das dauert nur wenige Minuten, Ihre Angaben aus der Anfrage sind schon eingetragen, "
      + "und danach wissen Sie, wo Sie stehen. Der Link unten führt Sie direkt hinein.",
  },
  {
    key: "einwand-zeit",
    art: "einwand",
    betreff: "„Dafür habe ich gerade keine Zeit\u201c",
    text: "Das hören wir oft, und es stimmt meistens.\n\n"
      + "Deshalb: Der Antrag dauert nur wenige Minuten, Ihre Angaben aus der Anfrage sind schon "
      + "eingetragen. Alles danach übernehmen wir — Sie bekommen eine Nachricht, wenn etwas von "
      + "Ihnen gebraucht wird, und sonst nicht.\n\n"
      + "Ein paar Minuten jetzt sparen Ihnen das Suchen später.",
  },
  {
    key: "termin-anruf",
    art: "termin",
    betreff: "Lieber kurz telefonieren?",
    text: "Manche Fragen klärt ein Gespräch schneller als jede E-Mail.\n\n"
      + "Suchen Sie sich ein Zeitfenster aus, das Ihnen passt — zu dieser Zeit rufen wir Sie an. "
      + "Fünfzehn Minuten, und Sie wissen, ob FIAON etwas für Sie ist.",
  },
  {
    key: "beweis-alltag",
    art: "beweis",
    betreff: "Wie es bei anderen läuft",
    text: "Die meisten, die bei uns anfangen, haben vorher versucht, es allein zu sortieren.\n\n"
      + "Was sie danach am häufigsten sagen: Sie wussten endlich, was als Nächstes dran ist. "
      + "Nicht weil wir etwas Magisches tun, sondern weil jemand die Reihenfolge kennt.",
  },
  {
    key: "auskunft-grundstein",
    art: "auskunft",
    betreff: "Der erste Schritt ist immer derselbe",
    text: "Bevor irgendetwas anderes Sinn hat, braucht es einen Überblick: "
      + "Was steht eigentlich über Sie in den Auskunfteien?\n\n"
      + `Diese Auskunft ist der Grundstein — sie kostet einmalig ${EURO(AUSKUNFT_PREISE_CENTS.privat.einzeln)}, `
      + `mit einem FIAON-Paket ${EURO(AUSKUNFT_PREISE_CENTS.privat.mitAbo)}, und wird `
      + "neutral abgerufen, verändert also nichts an Ihrem Stand. Sie sehen danach "
      + "schwarz auf weiß, wo Sie anfangen.",
  },
  // 22.09.2026 (E-210): Hier stand „monatlich kündbar … keine Mindestlaufzeit". Seit dem
  // 03.09.2026 laufen neue Verträge über zwölf Monatsraten (shared/fiaon-wissen.ts,
  // VERTRAG UND KÜNDIGUNG) — der Satz war falsch. Preise kommen aus dem Katalog.
  {
    key: "einwand-kosten",
    art: "einwand",
    betreff: "Was kostet das eigentlich?",
    text: "Eine berechtigte Frage, und die Antwort steht auf der Seite — nicht im Kleingedruckten.\n\n"
      + `Es gibt ${ZAHLWORT[PRIVATPAKETE.length] ?? PRIVATPAKETE.length} Pakete ab ${EURO(AB_CENTS)} im Monat. Jede Rate überweisen Sie selbst — `
      + `abgebucht wird nichts. Die Bonitätsauskunft ist nicht im Paket enthalten: mit Paket einmalig `
      + `${EURO(AUSKUNFT_PREISE_CENTS.privat.mitAbo)}, einzeln ${EURO(AUSKUNFT_PREISE_CENTS.privat.einzeln)}. `
      + "Keine Anschlussgebühr und keine Überraschung auf dem Kontoauszug.",
  },
  {
    key: "nutzen-unterlagen",
    art: "nutzen",
    betreff: "Der Ordner, den Sie nie anlegen mussten",
    text: "Das Lästigste an solchen Dingen ist nicht die Entscheidung — es ist das Zusammensuchen.\n\n"
      + "Bei FIAON laden Sie hoch, was Sie haben, und die Plattform sagt Ihnen, was fehlt. "
      + "Kein Rätselraten, welches Dokument gemeint ist.",
  },
  {
    key: "erinnerung-offen",
    art: "erinnerung",
    betreff: "Steht das noch auf Ihrer Liste?",
    // 18.09.2026: vorher „Dein Zugang wartet noch" — an Menschen ohne Konto.
    text: "Falls Sie es aus den Augen verloren haben: Der Weg zu FIAON steht Ihnen weiter offen.\n\n"
      + "Wenn es gerade nicht passt, ist das völlig in Ordnung — melden Sie sich, wenn es passt. "
      + "Wenn Sie gar nichts mehr hören möchten, steht unten der Weg dafür.",
  },
  // 22.09.2026 (E-210): Betreff vorher „Warum bei uns ein Mensch anruft" und „Deshalb ruft
  // dich jemand an" — eine Anrufzusage an Menschen, für die kein Anruf eingeplant ist. Der
  // Anruf, den der Ablauf wirklich vorsieht, ist das Startgespräch.
  {
    key: "beweis-warum-mensch",
    art: "beweis",
    betreff: "Warum bei uns ein Mensch mit Ihnen spricht",
    text: "Wir könnten alles über Formulare abwickeln. Wir tun es nicht.\n\n"
      + "Denn die eine Frage, die Sie wirklich beschäftigt, steht in keinem Formular. "
      + "Deshalb führt Ihr Startgespräch ein Mensch, der Ihre Unterlagen kennt — "
      + "und kein Callcenter, das Ihren Namen zum ersten Mal liest.",
  },
  // 22.09.2026 (E-210): vorher „keine Vorkasse für Versprechen … ein monatliches Paket, das du
  // jederzeit beenden kannst". Jetzt, was stimmt und prüfbar ist: Firma mit Registernummer,
  // Überweisung statt Abbuchung, Kündigung jederzeit (danach keine neue Rate).
  {
    key: "einwand-vertrauen",
    art: "einwand",
    betreff: "Woher weiß ich, dass das seriös ist?",
    text: "Eine Frage, die Sie stellen sollten.\n\n"
      + "Was Sie prüfen können: Impressum, Datenschutzerklärung und AGB stehen offen auf der Seite, "
      + `und hinter FIAON steht die ${FIAON_FIRMA.name}, eingetragen bei Companies House unter der Nummer ${FIAON_FIRMA.companyNo}. `
      + "Sie zahlen in Monatsraten per Überweisung — abgebucht wird nichts — und können jederzeit "
      + "kündigen; ab dann wird keine neue Rate mehr gestellt. Und Sie bekommen eine feste "
      + "Ansprechperson mit Namen, keine Hotline-Nummer.",
  },
  {
    key: "termin-letzte",
    art: "termin",
    betreff: "Ein Anruf, dann wissen Sie es",
    text: "Wir schreiben Ihnen seit einer Weile, und Sie haben nicht geantwortet — das ist Ihr gutes Recht.\n\n"
      + "Falls es nur daran liegt, dass Schreiben mühsam ist: Wählen Sie ein Zeitfenster, "
      + "zu dieser Zeit rufen wir Sie an. Und falls Sie wirklich nichts mehr hören möchten, "
      + "ist der Weg dafür unten. Dann ist es das letzte Mal.",
  },
];

/**
 * Der Knopf einer Variante (18.09.2026).
 *
 * Die zwei Termin-Varianten versprechen „wähl ein Zeitfenster, wir rufen an" —
 * ihr Knopf hieß trotzdem „Jetzt Antrag starten". Jetzt führt er dorthin, wo
 * man ein Zeitfenster wählt (/termin, dieselbe Seite wie „Startgespräch
 * buchen" auf der Website); alle anderen führen in den Antrag. `zeile` ist die
 * Knopfzeile im Text-Teil — der Mail-Motor erkennt sie am Anfang und setzt
 * stattdessen den Knopf.
 */
export function streckenKnopf(v: StreckenVariante): { text: string; termin: boolean; zeile: "Zum Termin" | "Zum Antrag" } {
  return v.art === "termin"
    ? { text: "Zeitfenster wählen", termin: true, zeile: "Zum Termin" }
    : { text: "Jetzt Antrag starten", termin: false, zeile: "Zum Antrag" };
}

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
// ═══════════════════════════════════════════════════════════════════════════
// DAS WORT „KREDITKARTE" AUF WHATSAPP — JUSTINS ENTSCHEIDUNG (23.09.2026, E-215)
//
// Die Liste oben ist am 18.09. entstanden, damit FIAON in der Kaltansprache
// nicht mit einer Kreditsumme wirbt: Das wäre Werbung für eine
// erlaubnispflichtige Leistung (§ 34c GewO). Sie gilt weiter — für Mails,
// Briefe und die gesamte Nachfass-Strecke.
//
// Für die WhatsApp-Vorlagen hat Justin am 23.09. anders entschieden, zweimal
// und ausdrücklich, nachdem ihm die Begründung vorlag: „Es soll auf die
// Kreditkarte gepitcht werden … ändere es, ob du willst oder nicht!" und
// „NUR auf die Kreditkarte pitchen".
//
// Das ist seine Entscheidung und sein Risiko — er ist Inhaber, er kennt die
// Begründung, und er hat sie überstimmt. Was NICHT zu seiner Disposition
// stand und deshalb auch nicht geändert wurde: falsche Tatsachenbehauptungen.
// „Ihr Kreditkartenantrag liegt mir vor" bleibt draußen, weil der Kunde bei
// FIAON keinen Kartenantrag gestellt hat — die Anfrage ja, der Antrag läuft
// bei der Partnerbank. Ein falscher Satz ist kein Pitch, sondern ein
// Widerrufsgrund, und Meta weist ihn ohnehin ab.
//
// Die Ausnahme steht hier als PARAMETER und nicht als gelöschtes Wort: Wer sie
// benutzt, muss sie benennen. Ein aus der Liste gestrichenes Wort hätte
// stillschweigend auch jede Mail und jeden Brief freigegeben.
// ═══════════════════════════════════════════════════════════════════════════
/** Für WhatsApp-Vorlagen freigegeben (Justin, 23.09.2026). Nur dort verwenden. */
export const WHATSAPP_ERLAUBT = ["kreditkarte"] as const;

/**
 * Prüft einen Text auf Worthygiene. Gibt die Verstöße zurück.
 *
 * `erlaubt` nimmt Wörter heraus, BEVOR geprüft wird — nötig, weil „kredit" in
 * „kreditkarte" steckt und sonst jede erlaubte Kreditkarte einen Treffer auf
 * „kredit" erzeugen würde.
 */
export function worthygiene(text: string, erlaubt: readonly string[] = []): string[] {
  let t = text.toLowerCase();
  for (const e of erlaubt) t = t.split(e.toLowerCase()).join(" ");
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
