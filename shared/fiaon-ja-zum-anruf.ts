// ═══════════════════════════════════════════════════════════════════════════
// JA ZUM ANRUF — die Wege, auf denen ein Mensch FIAON das Anrufen erlaubt (E-408 Scheibe 3, 22.10.2026)
//
// Ab Fr 23.10.2026 darf ARAS jeden anrufen, der eingewilligt hat (anderer Strang). Gemessen am 22.10. (Produktion,
// nur lesend): drei gültige Einwilligungen — zwei aus dem Antrag-Kästchen, eine aus einem gebuchten Rückruf. Dazu
// kommen hier drei Wege, alle in fiaon_telefon_einwilligung (server/lib/fiaon-telefon-einwilligung.ts):
//   1. AKTE      „Ja zum Anruf eintragen“ — ein Mitarbeiter trägt das Ja aus SEINEM Gespräch ein (Art „chef“), nur mit
//                der Pflicht-Bestätigung im Dialog (JA_AKTE_BESTAETIGUNG); dazu „Ja widerrufen“.
//   2. WHATSAPP  Mara hängt an eine Antwort EINEN eigenen Satz an (JA_FRAGE_WA) — ihre Antwort bleibt Wort für Wort.
//                Antwortet er klar mit JA (istKlaresJa), entsteht „zuruf_whatsapp“: Wortlaut = die gestellte Frage,
//                Beleg = beide Nachrichten. In der Akte dazu „Mara fragt nach dem Ja“ (nur bei offenem Fenster).
//                „Bitte nicht anrufen“ nimmt das Ja zurück; ein klares „nicht mehr anrufen“ setzt dazu die Telefonsperre.
//   3. META      fragt ein Lead-Formular nach dem Ja zum Anruf (Kästchen oder Frage), entsteht „meta_kaestchen“.
//
// Recht (hart): vorher, ausdrücklich, freiwillig, dokumentiert (§ 7 Abs. 2 Nr. 1 und § 7a UWG; DSGVO Art. 7). Eine
// Frage nach dem Ja per WhatsApp an jemanden, der uns nicht selbst geschrieben hat, wäre selbst Werbung — darum fragt
// Mara NUR im offenen 24-Stunden-Fenster, also in einer Antwort auf SEINE Nachricht, und höchstens einmal in 30 Tagen.
// Im Zweifel KEIN Ja: Ein verpasstes Ja kostet einen Anruf, ein falsch erkanntes kostet das Recht.
//
// Diese Datei ist REIN (keine Datenbank, kein Netz): die freigegebenen Sätze, der JA-Erkenner, der Widerrufs-Erkenner,
// das Urteil „darf Mara jetzt fragen?“ und die Zeile für die Akte. Server, Mara, Meta-Eingang und Akte lesen sie;
// der Prüfstand scripts/pruef-aras-einwilligung-wege.ts prüft sie offline und gegen eine lokale Datenbank.
// ═══════════════════════════════════════════════════════════════════════════
import type { EinwilligungArt } from "./fiaon-aras";

// ── Die freigegebenen Sätze (Wortlaut ändern nur hier, mit derselben Freigabe) ─────────────────────────────────────
/**
 * Die Frage, die Mara an eine Antwort anhängt (und der Knopf „Mara fragt nach dem Ja“ schickt) — ein eigener Satz am Ende.
 * Fassung 2, freigegeben 22.10.2026 (Koordination E-408): Der Widerruf steht VOR dem Ja (DSGVO Art. 7 Abs. 3 Satz 3).
 */
export const JA_FRAGE_WA = "Dürfen wir Sie dazu auch kurz anrufen – auch ARAS, unsere digitale Mitarbeiterin (eine KI)? Antworten Sie einfach mit JA. Sie können es jederzeit mit einer kurzen Nachricht zurücknehmen.";
/** Fassung 1 (Auftrag E-408 vom 22.10.2026, ohne den Widerrufs-Hinweis) — geht nicht mehr raus, ein Ja darauf zählt weiter. */
export const JA_FRAGE_WA_FASSUNG_1 = "Dürfen wir Sie dazu auch kurz anrufen – auch ARAS, unsere digitale Mitarbeiterin (eine KI)? Antworten Sie einfach mit JA.";
/**
 * Jede Fassung der Frage, die je rausging — NEUESTE ZUERST. Der JA-Erkenner und die 30-Tage-Grenze lesen ALLE: Eine
 * neue Fassung kommt vorn dazu, alte bleiben stehen (sonst zählte ein Ja auf die alte Frage nicht mehr, und Mara
 * fragte vor Ablauf der 30 Tage noch einmal). Die Reihenfolge trägt: Fassung 1 steckt wörtlich in Fassung 2 — wer
 * hinten anfinge, hielte jede neue Frage für die alte (und speicherte den falschen Wortlaut).
 */
export const JA_FRAGE_FASSUNGEN: readonly string[] = [JA_FRAGE_WA, JA_FRAGE_WA_FASSUNG_1];
/**
 * Maras Dank auf ein klares JA — ein fester Satz ohne Modell. Er sagt nur, was stimmt: Es ist notiert, und er kann es
 * zurücknehmen (DSGVO Art. 7 Abs. 3). Kein Zeitpunkt, kein Versprechen eines Anrufs.
 */
export const JA_DANKE_WA = "Vielen Dank, das ist notiert. Sie können es jederzeit mit einer kurzen Nachricht zurücknehmen.";
/**
 * Maras Antwort auf ein klares „nicht mehr anrufen“ (Telefonsperre gesetzt) — ein fester Satz ohne Modell. Er stimmt: Die
 * Sperre gilt für alle (ARAS wählt nicht, die Akte zeigt sie dem Team). Freigegeben 22.10.2026 (Koordination E-408).
 */
export const ANRUF_SPERRE_WA = "Verstanden – wir rufen Sie nicht mehr an.";
/** Die Pflicht-Bestätigung im Dialog der Akte — und genau dieser Satz ist der Wortlaut des Nachweises (Art „chef“). */
export const JA_AKTE_BESTAETIGUNG = "Der Kunde hat mir gerade im Gespräch gesagt, dass FIAON ihn anrufen darf, auch ARAS (KI)";
/** Marke hinter Maras Namen, wenn der Knopf „Mara fragt nach dem Ja“ die Frage schickt (wie „(Nachfass)“). */
export const JA_FRAGE_MARKE = "(Ja-Frage)";
/**
 * E-458 (Justin 29.10.2026 nachmittags: „ARAS darf JEDEN im System anrufen, braucht kein eigenes Kreuz“): Im Buchungsformular
 * eines Global-Gesprächs (fiaon.com/, /en, Unterseiten, Landingpages) steht kein Kästchen mehr, sondern dieser Hinweis über dem
 * Knopf. Wer ein Telefongespräch bucht, bekommt kurz vorher den Bestätigungsanruf — Grundlage ist die Buchung selbst (wie
 * „rueckruf_buchung“). EIN Wortlaut für Anzeige UND Nachweis: Die Seite zeigt genau diesen Satz, der Server speichert ihn
 * (termin_buchung, quelle = der Termin) nur, wenn der Browser ihn unverändert zurückschickt. Er deckt NUR den Erinnerungsanruf
 * vor diesem Gespräch.
 */
export const GLOBAL_TERMIN_ARAS_HINWEIS = {
  de: "Kurz vor dem Gespräch rufen wir Sie an, um den Termin zu bestätigen – auch durch unsere KI-Assistentin ARAS.",
  en: "Shortly before the conversation, we will call you to confirm the appointment – including through our AI assistant ARAS.",
} as const;
/**
 * Bis 29.10.2026 nachmittags: das freiwillige Kästchen (termin_kaestchen, „go Plan“ Punkt 8). Der Server nimmt den Satz weiter
 * an — ein Browser mit dem alten Stand schickt ihn, bis er neu lädt; schon gespeicherte Nachweise bleiben gültig.
 */
export const GLOBAL_TERMIN_ARAS_TEXT = {
  de: "Ja, FIAON darf mich vor dem Gespräch kurz anrufen, um den Termin zu bestätigen – auch durch unsere KI-Assistentin ARAS. Freiwillig und jederzeit widerrufbar.",
  en: "Yes, FIAON may call me shortly before the conversation to confirm the appointment – including through our AI assistant ARAS. Voluntary; you can withdraw this at any time.",
} as const;

/** Höchstens eine Frage je Mensch in so vielen Tagen (Auftrag E-408). */
export const JA_FRAGE_ABSTAND_TAGE = 30;
/** Ein JA zählt nur als Antwort auf die Frage, wenn es höchstens so viele Tage danach kommt. */
export const JA_ANTWORT_GILT_TAGE = 7;
/** Das Gespräch, das ein Eintrag aus der Akte als Beleg mitnimmt: das laufende oder letzte der letzten so vielen Stunden. */
export const JA_GESPRAECH_STUNDEN = 2;

/** Woher das Ja kam — so steht es in der Akte („Ja zum Anruf: seit 22.10. (WhatsApp)“). */
export const JA_QUELLE_TEXT: Record<EinwilligungArt, string> = {
  antrag_kaestchen: "Antrag-Kästchen", antrag_knopf: "Antrag-Knopf", zuruf_whatsapp: "WhatsApp", zuruf_mail: "Mail",
  meta_kaestchen: "Meta-Formular", rueckruf_buchung: "Rückruf gebucht", chef: "im Gespräch",
  termin_kaestchen: "Gesprächsbuchung (Erinnerung)", termin_buchung: "Gesprächsbuchung (Erinnerung)",
};

// ── Der JA-Erkenner ─────────────────────────────────────────────────────────────────────────────────────────────
// Nur, was aus Ja-Worten und freundlichem Beiwerk besteht. Jedes andere Wort (aber, nur, nicht, später, WhatsApp,
// eine Uhrzeit, ein Name) macht aus dem Ja ein bedingtes oder unklares — und das ist KEIN Ja.
const JA_KERN = new Set(["ja", "jap", "jep", "jup", "jo", "jawohl", "yes", "yep", "gern", "gerne", "natürlich", "natuerlich",
  "selbstverständlich", "selbstverstaendlich", "einverstanden"]);
const JA_BEIWERK = new Set(["ok", "okay", "oki", "okey", "okidoki", "passt", "gut", "super", "perfekt", "prima", "top", "klar", "na",
  "sehr", "danke", "dankeschön", "dankeschoen", "vielen", "dank", "herzlichen", "bitte", "doch", "ruhig", "sicher", "logo", "genau",
  "dürfen", "duerfen", "darf", "darfst", "dürft", "duerft", "können", "koennen", "könnt", "koennt", "kann", "kannst", "sie", "du", "ihr",
  "mich", "mir", "uns", "euch", "mal", "jederzeit", "ich", "bin", "damit", "das", "ist", "in", "ordnung", "auch", "aras", "kurz",
  "rufen", "ruft", "anrufen", "an", "melden", "meldet", "machen", "mach", "hallo", "hi", "moin", "servus", "lg", "vg", "mfg", "grüße", "gruesse",
  "gruß", "gruss", "liebe", "beste", "viele"]);
/** Freundliche Zeichen, die ein Ja begleiten dürfen (👍 👌 🙏 🙂 😊 😀 😃 😄 😁 ☺ ✅ ✔ ❤ 💙 💚 🤝 👋 ✌ — Hautton und Verbinder). */
const JA_ZEICHEN = new RegExp("[\\u{1F44D}\\u{1F44C}\\u{1F64F}\\u{1F642}\\u{1F60A}\\u{1F600}\\u{1F603}\\u{1F604}\\u{1F601}\\u{263A}\\u{2705}\\u{2714}\\u{2764}\\u{1F499}\\u{1F49A}\\u{1F91D}\\u{1F44B}\\u{270C}\\u{1F3FB}-\\u{1F3FF}\\u{FE0F}\\u{200D}]", "gu");
const BILDZEICHEN = new RegExp("\\p{Extended_Pictographic}", "u");
const NICHT_BUCHSTABE = new RegExp("[^\\p{L}]+", "u");

/**
 * Ist das ein KLARES Ja (auf unsere Frage, ob wir anrufen dürfen)? „Ja“, „Ja gerne“, „Ja, passt“, „Ja, dürfen Sie 👍“ —
 * ja. „Ja, aber nicht anrufen“, „Ja?“, „Ja, ab 18 Uhr“, „Ja gerne per WhatsApp“, „Ok“, „👍“, „jaja“, „Ja 😂“ — nein.
 */
export function istKlaresJa(text: unknown): boolean {
  const roh = String(text ?? "").trim();
  if (!roh || roh.length > 80 || roh.includes("?") || /\d/.test(roh)) return false;
  // Nur freundliche Zeichen; ein anderes (😂 🙄 😡 🤔) kann Spott oder Ärger sein — dann lieber kein Ja.
  if (BILDZEICHEN.test(roh.replace(JA_ZEICHEN, " "))) return false;
  // Feste Wendungen, die ein Ja SIND, werden zu einem Kernwort („einverstanden“, nie „ja“ — sonst sähe „Ja, dürfen
  // Sie“ wie „ja ja“ aus); „kein Problem“ ist Beiwerk.
  const t = roh.toLowerCase()
    .replace(/\bna\s+klar\b/g, " einverstanden ")
    .replace(/\bauf\s+jeden\s+fall\b/g, " einverstanden ")
    .replace(/\bkein(?:e)?\s+(?:problem|ding|thema)\b/g, " ok ")
    .replace(/\b(?:dürfen|duerfen|können|koennen)\s+sie\b/g, " einverstanden ")
    .replace(/\b(?:darfst\s+du|dürft\s+ihr|duerft\s+ihr)\b/g, " einverstanden ");
  const woerter = t.split(NICHT_BUCHSTABE).filter(Boolean);
  if (!woerter.length) return false;
  const jaForm = (w: string) => /^ja{1,5}$/.test(w);
  if (!woerter.every((w) => jaForm(w) || JA_KERN.has(w) || JA_BEIWERK.has(w))) return false;
  if (!woerter.some((w) => jaForm(w) || JA_KERN.has(w))) return false;
  // „ja ja“ allein klingt nach „schon gut“ — kein klares Ja.
  if (woerter.length >= 2 && woerter.every(jaForm)) return false;
  return true;
}

// ── Der Widerrufs-Erkenner („bitte nicht anrufen“) und die Telefonsperre („nicht mehr anrufen“) ───────────────────
// Mara sagt bei der Frage und nach dem Ja: „Sie können es jederzeit mit einer kurzen Nachricht zurücknehmen.“ Und der
// Antrag verspricht dasselbe („eine Nachricht genügt“). Darum nimmt eine solche Nachricht auf WhatsApp das Ja sofort
// zurück. Lieber einmal zu viel zurückgenommen (ein Mensch trägt es neu ein) als einen Widerruf überhört — ein Anruf
// danach wäre unerlaubt. Was über die VERGANGENHEIT klagt („Sie haben mich nicht angerufen“) oder nach dem Warum fragt
// („Warum rufen Sie mich nicht an?“), nimmt nichts zurück.
// ZWEI STUFEN (Koordination E-408, 22.10.2026):
//   · weich („Bitte nicht anrufen, bin auf Arbeit“, „bitte jetzt nicht anrufen“) → nur das Ja zurück (istNeinZumAnruf);
//   · klar („nicht mehr anrufen“, „keine Anrufe mehr“, „rufen Sie mich nie wieder an“, „hören Sie auf anzurufen“) →
//     zusätzlich eine echte Telefonsperre, derselbe Weg wie ARAS' Werkzeug nicht_mehr_anrufen (istAnrufSperreWunsch).
const WIDERRUF_MUSTER: RegExp[] = [
  new RegExp("\\bnicht\\s+mehr\\s+(?:an)?(?:ge)?ruf", "i"),
  new RegExp("\\b(?:bitte|lieber|besser)\\s+(?:\\S+\\s+){0,2}?(?:nicht|keine?n?)\\s+(?:mehr\\s+)?(?:an)?(?:ge)?ruf", "i"),
  new RegExp("\\b(?:will|möchte|moechte|wünsche|wuensche|mag)\\s+(?:\\S+\\s+){0,3}?(?:nicht|keine?n?)\\s+(?:mehr\\s+)?(?:an)?(?:ge)?ruf", "i"),
  new RegExp("\\bruf\\w*\\s+(?:sie\\s+|ihr\\s+|du\\s+)?(?:mich|uns)\\s+(?:\\S+\\s+){0,3}?(?:nicht|nie)\\b", "i"),
  new RegExp("\\bkeine\\s+(?:weiteren\\s+)?anrufe\\b(?![^.!?\\n]{0,30}\\b(?:bekommen|erhalten|gehabt|bekam|gekommen))", "i"),
  new RegExp("\\bnicht\\s+(?:mehr\\s+)?telefonisch\\b", "i"),
  new RegExp("\\bwiderruf\\w*\\b[^.!?\\n]{0,60}\\b(?:anruf\\w*|telefon\\w*)", "i"),
  new RegExp("\\b(?:anruf\\w*|telefon\\w*)\\b[^.!?\\n]{0,60}\\bwiderruf\\w*", "i"),
  new RegExp("\\b(?:nehme|ziehe)\\b[^.!?\\n]{0,40}\\b(?:ja|anruf\\w*|einwilligung)\\b[^.!?\\n]{0,40}\\bzur(?:ü|ue)ck\\b", "i"),
  new RegExp("\\bh(?:ö|oe)r\\w*\\b[^.!?;\\n]{0,30}\\bauf\\b[^.!?;\\n]{0,30}\\b(?:anzurufen|anrufe\\w*)\\b", "i"),
];
/** Klare Sätze, die JEDEN Anruf beenden sollen — dann auch die Telefonsperre (enger als WIDERRUF_MUSTER). */
const SPERRE_MUSTER: RegExp[] = [
  new RegExp("\\bnicht\\s+mehr\\s+(?:an)?(?:ge)?ruf", "i"),
  new RegExp("\\bnie\\s+(?:wieder|mehr)\\s+(?:an)?(?:ge)?ruf", "i"),
  new RegExp("\\bruf\\w*\\s+(?:sie\\s+|ihr\\s+|du\\s+)?(?:mich|uns)\\s+(?:\\S+\\s+){0,3}?(?:nicht\\s+mehr|nie\\s+wieder|nie\\s+mehr|nimmer)\\b", "i"),
  new RegExp("\\bkeine\\s+(?:weiteren\\s+)?anrufe\\s+mehr\\b", "i"),
  new RegExp("\\bkeine\\s+weiteren\\s+anrufe\\b", "i"),
  new RegExp("\\bh(?:ö|oe)r\\w*\\b[^.!?;\\n]{0,30}\\bauf\\b[^.!?;\\n]{0,30}\\b(?:anzurufen|anrufe\\w*)\\b", "i"),
];
const VERGANGENHEIT = new RegExp("\\b(?:habe|hat|haben|hatte|hatten|wurde|wurden|bin|ist|war)\\b[^.!?;,\\n]{0,40}\\b(?:nicht|keine?n?|nie)\\b[^.!?;,\\n]{0,15}\\b(?:angerufen|anruf\\b|anrufe\\b)", "i");
/** „Warum rufen Sie mich nicht an?“ will einen Anruf — das ist nie ein Widerruf. */
const WARUM = new RegExp("\\b(?:warum|wieso|weshalb|weswegen)\\b", "i");
/** „Sie müssen mich nicht mehr anrufen, ich habe bezahlt“ — kein Bedarf, keine Sperre (das Ja geht trotzdem zurück). */
const KEIN_BEDARF = new RegExp("\\b(?:müssen|muessen|musst|müsst|muss|brauchen|braucht|brauchst)\\b", "i");

/**
 * Nimmt diese Nachricht das Ja zum Anruf zurück? Je Satzteil geprüft — Klage über die Vergangenheit und Warum zählen
 * nicht. Wer die Sperre verlangt (istAnrufSperreWunsch), nimmt das Ja immer auch zurück.
 */
export function istNeinZumAnruf(text: unknown): boolean {
  if (istAnrufSperreWunsch(text)) return true;
  const teile = String(text ?? "").split(/[.!?;,\n]+/).map((s) => s.trim()).filter(Boolean);
  return teile.some((s) => WIDERRUF_MUSTER.some((m) => m.test(s)) && !VERGANGENHEIT.test(s) && !WARUM.test(s));
}

/**
 * Will er GAR KEINE Anrufe mehr („nicht mehr anrufen“, „keine Anrufe mehr“, „rufen Sie mich nie wieder an“, „hören Sie
 * auf anzurufen“)? Dann Telefonsperre + Widerruf. Je ganzem Satz geprüft (ein Komma trennt „hören Sie auf, mich
 * anzurufen“ nicht). Nie bei einer Frage („Können Sie mich nicht mehr anrufen?“), einem Warum, der Vergangenheit oder
 * „müssen/brauchen nicht mehr“ — dort reicht der Widerruf; eine Sperre hält auch die Raten-Anrufe an.
 */
export function istAnrufSperreWunsch(text: unknown): boolean {
  const saetze = String(text ?? "").match(/[^.!?;\n]+[.!?;\n]*/g) ?? [];
  return saetze.some((satz) => {
    const s = satz.trim();
    if (!s || s.includes("?") || WARUM.test(s) || VERGANGENHEIT.test(s) || KEIN_BEDARF.test(s)) return false;
    return SPERRE_MUSTER.some((m) => m.test(s));
  });
}

// ── Die Frage im Verlauf ─────────────────────────────────────────────────────────────────────────────────────────
/** Welche Fassung der Frage steht in diesem Text (Maras Nachricht)? Sonst null. */
export function jaFrageIn(text: unknown): string | null {
  const t = String(text ?? "");
  return JA_FRAGE_FASSUNGEN.find((f) => t.includes(f)) ?? null;
}
/**
 * Darf an diese Antwort die Frage? Nur, wenn Maras Antwort selbst nichts fragt — sonst wüsste niemand, worauf ein
 * „Ja“ antwortet („Soll ich Ihnen den Link schicken? … Dürfen wir Sie anrufen?“ → „Ja“ = ?). Links zählen nicht.
 */
export function antwortOhneFrage(antwort: unknown): boolean {
  const t = String(antwort ?? "").replace(/https?:\/\/\S+/g, "").trim();
  return !!t && !t.includes("?") && !jaFrageIn(t);
}

// ── Darf Mara jetzt fragen? (rein — die Fakten holt server/lib/fiaon-ja-zum-anruf.ts) ───────────────────────────
export interface JaFrageFakten {
  /** Die WhatsApp-Nummer, über die er uns geschrieben hat (ohne: nie). */
  nummer: string | null;
  /** Hat er uns in den letzten 24 Stunden geschrieben? */
  fensterOffen: boolean;
  /** Gibt es schon ein gültiges Ja zum Anruf? */
  hatJa: boolean;
  /** „Nicht mehr anrufen“ (fiaon_telefon_sperre). */
  telefonSperre: boolean;
  /** FIAON Global — Mara schreibt ihm nie selbst. */
  global: boolean;
  /** werbungVerboten (Werbesperre, „Stopp“, Vertriebssperre, gekündigt) — null = frei. */
  werbeGrund: string | null;
  /** Wann Mara zuletzt gefragt hat (jede Fassung, auch über den Knopf). */
  zuletztGefragtAm: Date | string | null;
  /** Nur für den Knopf: Wartet eine Nachricht von ihm noch auf eine Antwort? */
  wartetAufAntwort?: boolean;
  jetzt?: Date;
}
export interface JaFrageUrteil { darf: boolean; grund: string | null; wiederAb: string | null }

const TAG_FORMAT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });
/** „22.10.“ — Berliner Zeit. */
export function tagKurz(d: Date | string | null | undefined): string {
  const x = d instanceof Date ? d : new Date(String(d ?? ""));
  return Number.isFinite(x.getTime()) ? TAG_FORMAT.format(x) : "";
}

/** Das Urteil — die erste Wand, die hält, als ganzer Satz (nie ein stummer Knopf). */
export function jaFrageUrteil(f: JaFrageFakten): JaFrageUrteil {
  const nein = (grund: string, wiederAb: string | null = null): JaFrageUrteil => ({ darf: false, grund, wiederAb });
  if (!f.nummer) return nein("Er hat uns noch nicht auf WhatsApp geschrieben – Mara fragt nur in einer Antwort auf seine Nachricht.");
  if (f.hatJa) return nein("Er hat schon Ja gesagt.");
  if (f.telefonSperre) return nein("Er möchte nicht angerufen werden (Telefonsperre) – Mara fragt nicht.");
  if (f.global) return nein("Firmenkunde (FIAON Global) – Mara fragt nicht.");
  if (f.werbeGrund) return nein(`${f.werbeGrund} – Mara fragt nicht.`);
  if (f.zuletztGefragtAm) {
    const am = new Date(f.zuletztGefragtAm as any);
    const ab = new Date(am.getTime() + JA_FRAGE_ABSTAND_TAGE * 86_400_000);
    if (Number.isFinite(am.getTime()) && ab.getTime() > (f.jetzt ?? new Date()).getTime()) {
      return nein(`Mara hat am ${tagKurz(am)} schon gefragt – wieder ab ${tagKurz(ab)}.`, ab.toISOString());
    }
  }
  if (!f.fensterOffen) return nein("Das WhatsApp-Fenster ist zu: Er hat seit über 24 Stunden nicht geschrieben. Mara fragt nur, wenn er selbst schreibt.");
  if (f.wartetAufAntwort) return nein("Er wartet gerade auf eine Antwort – erst antworten, dann fragen.");
  return { darf: true, grund: null, wiederAb: null };
}

/** Was Mara (Modell) zu seiner Antwort auf die Frage wissen muss — oder null. Ein Satz für JETZT BEACHTEN. */
export function jaHinweisFuerMara(s: { jaGespeichert: boolean; zurueckgenommen: boolean; frageOffen: boolean; gesperrt?: boolean }): string | null {
  // Nach einer Telefonsperre: der Satz muss stimmen — wir rufen ihn nicht mehr an (auch kein Rückruf-Angebot).
  if (s.gesperrt) return "ER WILL NICHT MEHR ANGERUFEN WERDEN (Telefonsperre gesetzt): Sag ihm in einem kurzen Satz, dass wir ihn nicht mehr anrufen. Biete keinen Anruf und keinen Rückruf an. Beantworte dann, was er sonst schreibt.";
  if (s.zurueckgenommen) return "SEIN JA ZUM ANRUF IST ZURÜCKGENOMMEN (eben gespeichert): Bestätige kurz, dass es notiert ist – ohne weitere Zusage.";
  if (s.jaGespeichert) return "ER HAT JA ZUM ANRUF GESAGT (gespeichert): Danke ihm dafür in einem kurzen Halbsatz. Nenn keinen Zeitpunkt und versprich keinen Anruf – beantworte dann, was er sonst schreibt.";
  if (s.frageOffen) return "DEINE LETZTE NACHRICHT FRAGTE, OB WIR IHN ANRUFEN DÜRFEN (auch ARAS). Seine Antwort ist KEIN klares JA: Sag nicht, dass wir ihn anrufen oder dass etwas notiert ist, und frag nicht noch einmal danach. Ein Nein nimmst du freundlich an. Beantworte, was er schreibt.";
  return null;
}

// ── Die Zeile für die Akte ────────────────────────────────────────────────────────────────────────────────────────
export interface JaEintrag {
  id: number;
  art: string;
  /** Erteilt am (ISO). */
  seit: string;
  /** Bei „chef“: der Mitarbeiter, der es aus seinem Gespräch eingetragen hat. */
  von: string | null;
  /** Widerrufen am (ISO) — oder null, solange es gilt. */
  widerrufenAm: string | null;
}
/** „Ja zum Anruf: seit 22.10. (WhatsApp)“ · „… · Widerrufen am 23.10.“ · „Noch kein Ja zum Anruf“. */
export function jaZeile(e: JaEintrag | null | undefined): string {
  if (!e) return "Noch kein Ja zum Anruf";
  const art = e.art as EinwilligungArt;
  const quelle = art === "chef" ? (e.von ? `im Gespräch mit ${e.von}` : JA_QUELLE_TEXT.chef) : JA_QUELLE_TEXT[art] ?? e.art;
  return `Ja zum Anruf: seit ${tagKurz(e.seit)} (${quelle})${e.widerrufenAm ? ` · Widerrufen am ${tagKurz(e.widerrufenAm)}` : ""}`;
}
