// ═══════════════════════════════════════════════════════════════════════════
// MARA ÄNDERT ANSCHRIFT, E-MAIL UND TELEFON SELBST — die reine Erkennung (E-401 4/6, 19.10.2026)
//
// Justin (19.10.2026): „Mach Mara und co fix fertig, damit die wirklich GUT arbeitet und selbst arbeitet.“
// Bisher wurde aus „Ich bin umgezogen, neue Adresse: …“ eine Aufgabe an einen Menschen (aufgabe_an_betreuer, Fall 4:
// „Datenänderung, für die du kein Werkzeug hast“). Jetzt erledigt der SERVER die sicheren Fälle selbst
// (server/lib/fiaon-mara-angaben-aendern.ts) — hier steht nur, was sich OHNE Datenbank entscheiden lässt:
//
//   · WILL er etwas ändern? (angabenErkennen) — nur auf einen ausdrücklichen Wunsch hin („neue Adresse“, „bin
//     umgezogen“, „neue Nummer“, „bitte ändern Sie meine E-Mail-Adresse“). „Meine Adresse: …“ allein ändert nichts.
//   · WAS ist der neue Wert? Anschrift (Straße mit Hausnummer, PLZ, Ort, Land), E-Mail-Adresse, Telefonnummer —
//     nur, was wörtlich in seiner Nachricht steht, und nur, wenn es eindeutig ist.
//   · IST er plausibel? PLZ je Land (DE fünf, AT/CH vier Ziffern), E-Mail-Form und Tippfehler („gmail.con“),
//     Telefon als E.164 (+49/+43/+41) mit passender Länge.
//   · WAS ändert Mara NIE? Name, Geburtsdatum, Bankverbindung, Ausweisdaten (verboten) — wie bisher ein Mensch.
//   · Kommt die Nachricht vom GESPEICHERTEN Absender? (mailGleich, nummerGleich)
//   · Die Sätze an den Kunden, der Hinweis an Mara und die Antwortprüfung (angabenAntwortFunde): nie „geändert“,
//     was nicht geändert ist; die neue E-Mail-Adresse gilt erst nach dem Klick auf den Bestätigungslink.
//
// Rein — kein Datenbankzugriff, kein Netz. Prüfstand: scripts/pruef-mara-angaben.ts.
// ═══════════════════════════════════════════════════════════════════════════

export type AngabeFeld = "anschrift" | "email" | "telefon";
export type VerbotenFeld = "name" | "geburtsdatum" | "bank" | "ausweis";
export type AngabeLand = "DE" | "AT" | "CH";
/** E-406 C1 (19.10.2026): „anliegen“ = Anliegen aus dem Kundenbereich (angemeldet) — Sätze wie die Mail. */
export type AngabenKanal = "mail" | "whatsapp" | "anliegen";

export interface Anschrift { strasse: string; plz: string; ort: string; land: AngabeLand | null }

/** Was er ändern will — je Feld höchstens ein Wunsch. */
export type FeldWunsch =
  | { feld: "anschrift"; art: "voll"; wert: Anschrift }
  | { feld: "email"; art: "voll"; wert: string }
  | { feld: "telefon"; art: "voll"; wert: string }
  | { feld: AngabeFeld; art: "unvollstaendig"; fehlt: string[]; grund: string }
  | { feld: AngabeFeld; art: "unklar"; grund: string; ausland?: boolean; spaeter?: boolean };

export interface AngabenErkennung {
  wuensche: FeldWunsch[];
  verboten: VerbotenFeld[];
}

/** Was der Server je Feld getan hat (fiaon-mara-angaben-aendern.ts). */
export type FeldStand =
  | "geaendert"          // Anschrift / Telefon gespeichert
  | "link_geschickt"     // E-Mail: Bestätigungslink an die NEUE Adresse, Hinweis an die alte
  | "schon_so"           // der neue Wert ist schon gespeichert
  | "unvollstaendig"     // es fehlt etwas (welche Angabe)
  | "unklar"             // nicht eindeutig oder nicht plausibel — er soll es noch einmal schicken
  | "fremder_absender"   // nicht vom gespeicherten Absender — nichts geändert
  | "mensch"             // ein Mensch trägt es ein (Adresse vergeben, Ausland, Nummernwechsel per WhatsApp, Fehler)
  | "probe";             // Testperson — gerechnet, nichts geschrieben, nichts verschickt

export interface FeldErgebnis {
  feld: AngabeFeld;
  stand: FeldStand;
  /** Bisheriger Wert (für Akte und Prüfung; geht nie an einen fremden Absender). */
  vorher?: string | null;
  /** Neuer Wert (Anschrift als eine Zeile, E-Mail klein, Telefon E.164). */
  nachher?: string | null;
  grund?: string | null;
  fehlt?: string[];
  /** Nur bei probe: was der Server getan hätte. */
  waere?: FeldStand | null;
}

export interface AngabenLageRein {
  kanal: AngabenKanal;
  ergebnisse: FeldErgebnis[];
  verboten: VerbotenFeld[];
  /** Gespeicherte Werte, die in einer Antwort an einen FREMDEN Absender nie stehen dürfen. */
  geheim?: string[];
  /**
   * E-401 Nachbesserung: Die Mail trägt die gespeicherte Adresse als Absender, aber Gmail konnte sie nicht bestätigen
   * (kein dmarc/dkim/spf=pass zur Absender-Domain) oder ein fremdes Reply-To steht darin — dann gilt sie als fremd.
   */
  absenderUnbestaetigt?: boolean;
}

export const LINK_STUNDEN = 48;
export const KUNDENBEREICH_DATEN = "fiaon.com/app/mehr/daten";

const FELD_NAME: Record<AngabeFeld, string> = { anschrift: "Anschrift", email: "E-Mail-Adresse", telefon: "Telefonnummer" };
const VERBOTEN_NAME: Record<VerbotenFeld, string> = { name: "Ihren Namen", geburtsdatum: "Ihr Geburtsdatum", bank: "Ihre Bankverbindung", ausweis: "Ihre Ausweisdaten" };
const VERBOTEN_INTERN: Record<VerbotenFeld, string> = { name: "Name", geburtsdatum: "Geburtsdatum", bank: "Bankverbindung", ausweis: "Ausweisdaten" };

// ═══════════════════════════════════════════════════════════════════════════
// DER WUNSCH — nur ausdrücklich
// ═══════════════════════════════════════════════════════════════════════════
const AE = "(?:ä|ae)";
/** Wortanfang auch vor Umlauten — \b kennt ohne u-Flag nur ASCII („\bändern“ trifft „bitte ändern“ nie). */
const WA = "(?:^|[^A-Za-zÄÖÜäöüß])";
const AENDERN = `(?:ge${AE}ndert|${AE}ndern|${AE}ndere|aktualisier\\w*|korrigier\\w*|austausch\\w*|umstell\\w*)`;
/** „neue Adresse“, „Adresse ändern“, „Adressänderung“ — eindeutig. */
const ANSCHRIFT_STARK: RegExp[] = [
  /\bneue[nrs]?\s+(?:wohn-?|melde-?|post-?)?(?:adresse|anschrift)\b/i,
  new RegExp(`\\b(?:wohn-?|melde-?|post-?)?(?:adresse|anschrift)\\b[^.!?\\n]{0,40}${WA}${AENDERN}`, "i"),
  new RegExp(`${WA}${AE}ndern?\\s+sie\\s+(?:bitte\\s+)?(?:meine|die)\\s+(?:wohn-?|melde-?|post-?)?(?:adresse|anschrift)\\b`, "i"),
  new RegExp(`\\badress-?${AE}nderung\\b|\\banschrift${AE}nderung\\b`, "i"),
  /\b(?:my\s+)?new\s+address\b|\bchange\s+(?:of\s+)?(?:my\s+)?address\b/i,
];
/**
 * „ich bin umgezogen“, „wir sind umgezogen“, „wohne jetzt …“, „wohne nicht mehr in …“ — zählt nur, wenn auch eine Anschrift
 * (PLZ und Ort) dasteht. E-401 Nachbesserung (Prüfer-Fund): nur ER selbst, nur vollzogen. „Umzug“ / „umziehen“ allein
 * („beim Umzug meiner Mutter“, „ich werde im Dezember umziehen“) ist kein Wunsch, seine Anschrift jetzt zu ändern.
 */
const ANSCHRIFT_SCHWACH: RegExp[] = [
  /\b(?:bin|sind)\s+(?:\S+\s+){0,4}?umgezogen\b/i,
  /\b(?:ich|wir)\s+(?:\S+\s+){0,3}?umgezogen\b/i,
  /\bwohne(?:n)?\s+(?:jetzt|nun|ab\s+sofort|seit\s+\w+|inzwischen|mittlerweile|neu)\b/i,
  /\bwohne(?:n)?\s+nicht\s+mehr\s+(?:in|im|am|an|bei)\b/i,
  /\b(?:i|we)\s+(?:have\s+|'ve\s+)?moved\b/i,
];
/** Die neue Anschrift gilt erst später („werde im Dezember umziehen“, „ab dem 01.12.“, „bis dahin bitte die alte“). */
const MONAT = "(?:januar|februar|m(?:ä|ae)rz|april|mai|juni|juli|august|september|oktober|november|dezember)";
const ZUKUNFT = new RegExp(String.raw`\b(?:werde|werden)\s+(?:\S+\s+){0,4}?(?:umziehen|wohnen)\b|\bziehe(?:n)?\s+(?:\S+\s+){0,5}?um\b|\bab\s+(?:dem\s+)?\d{1,2}\.\s?(?:\d{1,2}\.|${MONAT})|\b(?:ab|im)\s+${MONAT}\b|\bab\s+n(?:ä|ae)chste[nmr]?\s+(?:woche|monat|jahr)\b|\bdemn(?:ä|ae)chst\b|\bbis\s+dahin\b`, "i");
/**
 * Jemand anderes — „meine Mutter“, „mein Sohn“, „Ihr Kollege“, „von … angerufen“. Steht das im Satz mit dem Wunsch oder
 * dem Wert, sind es nicht SEINE Angaben: dann ändert der Server nichts (Prüfer-Fund: Nummer des Sohnes, Anschrift der
 * Mutter). „Meine Frau und ich“ ist er selbst.
 */
const DRITTE = /\b(?:meine[rsmn]?|unsere[rsmn]?|mein|unser)\s+(?:mutter|mama|vater|papa|eltern|sohn|tochter|kind(?:er)?|frau|ehefrau|mann|ehemann|partner(?:in)?|freund(?:in)?|bruder|schwester|oma|opa|gro(?:ß|ss)(?:mutter|vater|eltern)|tante|onkel|nachbar(?:in)?|chef(?:in)?|firma|arbeitgeber(?:in)?|schwieger\w+|enkel\w*|neffe|nichte|cousin\w*)\b(?!\s+und\s+ich\b)|\bihr(?:e[rsmn]?)?\s+(?:kollege|kollegin|mitarbeiter\w*|berater\w*)\b|\bvon\s+[^.!?\n]{0,40}\bangerufen\b|\bangerufen\s+(?:von|hat)\b/i;
/** Der Satz um eine Stelle (bis zu Zeilenende, „!“, „?“ oder einem Punkt mit Leerzeichen dahinter). Rein. */
function satzUm(t: string, i: number): string {
  let a = 0;
  for (const m of Array.from(t.slice(0, Math.max(0, i)).matchAll(/[\n!?]|\.\s/g))) a = (m.index ?? 0) + m[0].length;
  const rest = t.slice(Math.max(0, i));
  const e = rest.search(/[\n!?]|\.\s|\.$/);
  return t.slice(a, e >= 0 ? Math.max(0, i) + e : t.length);
}
const EMAIL_STARK: RegExp[] = [
  /\bneue[nrs]?\s+(?:e-?mail-?adresse|mail-?adresse|email-?adresse)\b/i,
  /\bneue[nrs]?\s+(?:e-?mail|mail)\s*(?:ist|lautet|:)/i,
  new RegExp(`\\b(?:e-?mail|mail)(?:-?adresse)?\\b[^.!?\\n]{0,40}${WA}${AENDERN}`, "i"),
  new RegExp(`${WA}${AE}ndern?\\s+sie\\s+(?:bitte\\s+)?(?:meine|die)\\s+(?:e-?mail|mail)`, "i"),
  /\b(?:schreiben|senden|schicken)\s+sie\s+(?:mir\s+)?(?:bitte\s+)?(?:ab\s+(?:jetzt|sofort)|künftig|kuenftig|zukünftig|in\s+zukunft)\s+(?:nur\s+noch\s+)?an\b/i,
  /\b(?:ab\s+(?:jetzt|sofort)|künftig|kuenftig|zukünftig)\b[^.!?\n]{0,30}\b(?:e-?mail|mail)(?:-?adresse)?\b/i,
  /\bmeine\s+(?:e-?mail|mail)(?:-?adresse)?\s+(?:ist|lautet)\s+(?:jetzt|nun|neu|ab\s+sofort)\b/i,
  /\bnew\s+e-?mail(?:\s+address)?\b/i,
  // E-401 Nachbesserung (Prüfer-Fund): „Meine Mailadresse ändert sich“, „… gewechselt“, „schreiben Sie mir nur noch an …“.
  new RegExp(`\\b(?:e-?mail|mail)(?:-?adresse)?\\b[^.!?\\n]{0,30}(?:${WA}${AE}ndert\\s+sich|\\bhat\\s+sich\\s+ge${AE}ndert|\\bgewechselt\\b)`, "i"),
  /\b(?:schreiben|senden|schicken)\s+sie\s+(?:mir\s+)?(?:bitte\s+)?nur\s+noch\s+an\b/i,
];
const TELEFON_STARK: RegExp[] = [
  /\bneue[nrs]?\s+(?:handy|mobil|telefon|tel\.?|ruf|whatsapp)?-?\s?(?:nummer|nr\.?)(?![a-zäöüß])/i,
  // E-401 Nachbesserung (Prüfer-Fund): „neues Handy“ (ein Gerät) ist KEINE neue Nummer — gestrichen.
  // „… Nummer gewechselt“, „die alte Nummer gibt es nicht mehr“ (Prüfer-Fund: wurde nicht erkannt).
  /\b(?:telefon|handy|mobil|ruf)?-?nummer\b[^.!?\n]{0,30}\bgewechselt\b/i,
  /\balte\s+(?:handy|telefon|mobil|ruf)?-?nummer\b[^.!?\n]{0,30}(?:gibt\s+es\s+nicht\s+mehr|existiert\s+nicht\s+mehr|ist\s+(?:nicht\s+mehr\s+aktiv|abgemeldet|gek(?:ü|ue)ndigt|weg))/i,
  new RegExp(`\\b(?:handy|mobil|telefon|ruf|whatsapp)-?(?:nummer|nr)\\b[^.!?\\n]{0,40}${WA}${AENDERN}`, "i"),
  new RegExp(`\\b(?:meine|die)\\s+nummer\\b[^.!?\\n]{0,30}${WA}${AENDERN}`, "i"),
  new RegExp(`${WA}${AE}ndern?\\s+sie\\s+(?:bitte\\s+)?(?:meine|die)\\s+(?:handy|mobil|telefon)?-?nummer`, "i"),
  /\b(?:bin|sind)\s+(?:jetzt|nun|ab\s+sofort|künftig|kuenftig)\s+(?:nur\s+noch\s+)?unter\b[^.!?\n]{0,40}\berreichbar\b/i,
  /\bmeine\s+(?:neue\s+)?(?:handy|mobil|telefon)?-?nummer\s+(?:ist|lautet)\s+(?:jetzt|nun|neu|ab)\b/i,
  /\bnew\s+(?:phone|mobile|number|cell)\b/i,
];
const VERBOTEN_MUSTER: Record<VerbotenFeld, RegExp[]> = {
  name: [
    new RegExp(`\\bnamens-?${AE}nderung\\b`, "i"),
    /\bneue[nrs]?\s+(?:nach|familien|vor)?namen?\b/i,
    /\b(?:habe|hab|haben)\s+(?:\w+\s+){0,2}geheiratet\b/i,
    /\bhei(?:ß|ss)e\s+(?:jetzt|nun|seit)\b/i,
    new RegExp(`\\bmein(?:en)?\\s+(?:nach|vor|familien)?namen?\\b[^.!?\\n]{0,30}${WA}(?:${AENDERN}|falsch|stimmt\\s+nicht)`, "i"),
  ],
  geburtsdatum: [
    new RegExp(`\\bgeburts(?:datum|tag)\\b[^.!?\\n]{0,30}\\b(?:falsch|stimmt\\s+nicht|${AENDERN})`, "i"),
    /\bfalsche[sn]?\s+geburtsdatum\b/i,
  ],
  bank: [
    /\bmeine\s+neue\s+(?:iban|bankverbindung|kontoverbindung|bankdaten|kontonummer)\b/i,
    new RegExp(`\\bmeine\\s+(?:iban|bankverbindung|kontoverbindung|bankdaten|kontonummer)\\b[^.!?\\n]{0,40}${WA}(?:${AENDERN}|lautet\\s+jetzt|ist\\s+jetzt|ist\\s+neu)`, "i"),
    new RegExp(`\\b(?:iban|bankverbindung|kontoverbindung)\\s+${AE}ndern\\b`, "i"),
  ],
  ausweis: [
    new RegExp(`\\b(?:personal)?ausweis(?:nummer|daten)\\b[^.!?\\n]{0,30}${WA}(?:${AENDERN}|eintragen|neu|falsch)`, "i"),
    new RegExp(`\\b(?:reisepass|pass)(?:nummer|daten)\\b[^.!?\\n]{0,30}${WA}(?:${AENDERN}|eintragen|neu|falsch)`, "i"),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// LAND, PLZ, ORT, STRASSE
// ═══════════════════════════════════════════════════════════════════════════
const LAND_WORTE: { re: RegExp; land: AngabeLand }[] = [
  { re: /\b(?:deutschland|germany|bundesrepublik)\b/i, land: "DE" },
  { re: /(?:\b(?:österreich|oesterreich|austria)\b|(?:^|[^a-zäöüß])österreich)/i, land: "AT" },
  { re: /\b(?:schweiz|switzerland|suisse|svizzera)\b/i, land: "CH" },
];
const AUSLAND = /\b(?:italien|kroatien|ungarn|rumänien|rumaenien|bulgarien|türkei|tuerkei|polen|spanien|frankreich|slowakei|tschechien|serbien|bosnien|kosovo|albanien|griechenland|niederlande|belgien|luxemburg|dänemark|daenemark|portugal|slowenien|ukraine|england|irland|italy|croatia|hungary|romania|bulgaria|turkey|poland|spain|france)\b/i;

/** Land aus einem Text (eindeutig) — null, wenn keins oder mehrere genannt sind. Rein. */
export function landAus(text: string): AngabeLand | null {
  const t = String(text ?? "");
  const treffer = new Set<AngabeLand>();
  for (const l of LAND_WORTE) if (l.re.test(t)) treffer.add(l.land);
  return treffer.size === 1 ? Array.from(treffer)[0] : null;
}
/** „DE“, „Deutschland“, „AT“, „Österreich“ … → DE/AT/CH, sonst null. Rein. */
export function landNorm(roh: string | null | undefined): AngabeLand | null {
  const t = String(roh ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "de" || t === "d" || t === "deu" || /^deutschland|^germany/.test(t)) return "DE";
  if (t === "at" || t === "a" || t === "aut" || /^(österreich|oesterreich|austria)/.test(t)) return "AT";
  if (t === "ch" || t === "che" || /^(schweiz|switzerland|suisse|svizzera)/.test(t)) return "CH";
  return null;
}
/** Passt die Postleitzahl zum Land? DE fünf Ziffern (01–99), AT und CH vier (1000–9999). Rein. */
export function plzPlausibel(plz: string, land: AngabeLand | null): boolean {
  const p = String(plz ?? "").trim();
  if (land === "DE") return /^\d{5}$/.test(p) && Number(p.slice(0, 2)) >= 1;
  if (land === "AT" || land === "CH") return /^[1-9]\d{3}$/.test(p);
  return /^\d{5}$/.test(p) || /^[1-9]\d{3}$/.test(p);
}

const ORT_STOPP = new Set(["und", "mit", "bitte", "ich", "meine", "mein", "ist", "sind", "wir", "ab", "seit", "danke", "vielen", "grüße", "gruß",
  "gruesse", "gruss", "mfg", "lg", "vg", "tel", "tel.", "telefon", "handy", "email", "e-mail", "mail", "neue", "neuer", "nummer", "auch", "noch",
  "jetzt", "habe", "hab", "wohne", "wohnen", "freundliche", "freundlichen", "liebe", "beste", "besten", "viele", "hallo", "sie", "ihnen",
  "the", "and", "my", "please", "thanks", "wo", "wie", "wann", "was", "dass", "weil", "aber", "oder", "für", "fuer", "eingetragen",
  "eintragen", "ändern", "aendern", "geändert", "geaendert", "gespeichert", "speichern", "lautet", "neu", "sowie", "so", "schon", "bereits",
  "umzug", "umgezogen", "nach", "in", "im", "am", "an", "zu", "zum", "zur", "von", "vom", "bei", "auf", "aus", "uhr", "euro", "rate", "raten"]);
const KLEINE_TEILE = new Set(["am", "an", "der", "die", "das", "den", "dem", "im", "in", "zum", "zur", "bei", "ob", "vor", "unter", "auf", "ober", "unter", "von", "vom", "und"]);
/** Kleingeschriebenes ordentlich groß — nur, wenn er ALLES klein geschrieben hat. „frankfurt am main“ → „Frankfurt am Main“. Rein. */
export function grossSchreiben(s: string): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t || /[A-ZÄÖÜ]/.test(t)) return t;
  return t.split(" ").map((w, i) => (i > 0 && KLEINE_TEILE.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const HAUSNUMMER = String.raw`\d{1,4}\s?[a-zA-Z]?(?:\s*[\/-]\s*\d{1,4}[a-zA-Z]?){0,3}(?:\s*(?:top|stiege|stg\.?|tür|whg\.?)\s*\d{1,4}[a-zA-Z]?){0,2}`;
const STRASSE_ENDE = new RegExp(`^(.*?[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.'’ -]*?)\\s*\\.?\\s*(${HAUSNUMMER})$`);
const INTRO_GROSS = new Set(["meine", "mein", "neue", "neuer", "neuen", "adresse", "anschrift", "wohnadresse", "meldeadresse", "postanschrift",
  "ich", "wir", "neu", "jetzt", "ab", "bitte", "hier", "die", "der", "das", "unsere", "unser", "lautet", "ist", "straße", "strasse", "adresse:",
  "anschrift:", "new", "address", "my", "hallo", "guten", "tag", "liebe", "lieber", "sehr", "geehrte", "geehrter", "damen", "herren", "nun"]);
const INTRO_KLEIN = new Set([...Array.from(INTRO_GROSS), "lautet", "ist", "jetzt", "nun", "ab", "sofort", "wohne", "wohnen", "bin", "sind",
  "umgezogen", "nach", "in", "seit", "folgende", "heißt", "heisst", "ändern", "aendern", "auf", "zu", "mich", "mir", "uns", "sie", "ihre", "habe",
  "hab", "eine", "einen", "is", "now", "to", "moved", "und", "mit"]);

/** Klein geschriebene Bindewörter, hinter denen (bei sonst richtiger Großschreibung) erst die Straße beginnt. */
const SCHNITT = new Set(["nach", "von", "auf", "ist", "lautet", "und", "bei", "zu", "nun", "jetzt", "wohne", "wohnen", "ab", "sofort", "neu", "neue", "jetzige",
  // E-401 Nachbesserung: „… Umzug meiner Mutter in den Lindenweg 3“ — klein geschriebenes „in/im“ vor der Straße schneidet.
  "in", "im"]);
/** Die Straße mit Hausnummer am Ende eines Stücks Text — Einleitungsworte vorn abgeschnitten. null: keine. Rein. */
export function strasseAus(stueck: string): string | null {
  const s = String(stueck ?? "").replace(/[\t ]+/g, " ").replace(/^[\s,;:.\-–—]+|[\s,;:\-–—]+$/g, "").trim();
  const m = s.match(STRASSE_ENDE);
  if (!m) return null;
  const nummer = m[2].replace(/\s+/g, " ").trim();
  // E-401 Nachbesserung (Prüfer-Fund): „Hauptstr. 5“ behält seinen Punkt — sonst erkannte der Vergleich die gespeicherte
  // „Hauptstr. 5“ nicht wieder und hielt die alte Anschrift für die neue.
  const punkt = s.charAt(m[1].length) === "." && /(?:str|pl|g|w)$/i.test(m[1]) ? "." : "";
  let worte = `${m[1]}${punkt}`.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  // Nur, was nach der letzten Zahl steht („Tel 0151 Neuweg 2“ → „Neuweg 2“).
  const letzteZahl = worte.map((w) => /\d/.test(w)).lastIndexOf(true);
  if (letzteZahl >= 0) worte = worte.slice(letzteZahl + 1);
  const mitGross = worte.some((w) => /^[A-ZÄÖÜ]/.test(w));
  if (mitGross) {
    // „… Altstadt nach Neuweg 2“: ab dem letzten klein geschriebenen Bindewort beginnt die Straße.
    const schnitt = worte.map((w) => SCHNITT.has(w)).lastIndexOf(true);
    if (schnitt >= 0 && schnitt < worte.length - 1) worte = worte.slice(schnitt + 1);
    // Vorn weg, was klein geschrieben ist oder eine Einleitung ist („Meine neue Adresse ist …“) — Straßennamen beginnen groß.
    while (worte.length && (/^[a-zäöüß]/.test(worte[0]) || INTRO_GROSS.has(worte[0].toLowerCase().replace(/[:,]$/, "")))) worte = worte.slice(1);
  } else {
    while (worte.length > 1 && INTRO_KLEIN.has(worte[0].toLowerCase().replace(/[:,]$/, ""))) worte = worte.slice(1);
    if (worte.length === 1 && INTRO_KLEIN.has(worte[0].toLowerCase())) worte = [];
  }
  const name = worte.join(" ").replace(/^[\s,;:.\-–—]+/, "").trim();
  if (name.replace(/[^A-Za-zÄÖÜäöüß]/g, "").length < 2 || name.length > 70) return null;
  return grossSchreiben(`${name} ${nummer}`).replace(/\s+/g, " ").trim();
}

/** Vorsilben mehrteiliger Orte: „Bad Homburg“, „Sankt Augustin“, „St. Gallen“, „Bergisch Gladbach“, „Lutherstadt Wittenberg“. */
const ORT_VORSILBE = new Set(["bad", "sankt", "st", "groß", "gross", "klein", "neu", "alt", "hohen", "schwäbisch", "schwaebisch", "bergisch",
  "lutherstadt", "hansestadt", "königs", "koenigs", "markt", "ober", "nieder", "hann", "wendisch", "deutsch", "windisch",
  "bayerisch", "fränkisch", "fraenkisch", "märkisch", "maerkisch"]);
/** „a.M.“, „i.Br.“, „a.d.“, „a.“ — Kürzel im Ortsnamen (Punkt INNEN oder ein einzelner Buchstabe). */
const ORT_KUERZEL = /^(?:[A-Za-zÄÖÜäöü]{1,3}\.){2,}$|^[a-zäöü]\.$/;
/**
 * PLZ und Ort ab einer Fundstelle; der Ort endet an Satzzeichen, Ziffern, Füllwörtern oder dem Land. Rein.
 * E-401 Nachbesserung (Prüfer-Fund): Der Ort endet auch am SATZENDE („54321 Neustadt. Die Karte bitte …“ ergab „Neustadt
 * Die Karte“) — ein Wort mit Punkt beendet ihn (außer Kürzeln wie „a.M.“, „i.Br.“, „St.“). Ein zweites großes Wort gehört
 * nur nach einer Vorsilbe (Bad, Sankt …) oder einem Kürzel dazu — „Neustadt Max Mustermann“ ist „Neustadt“.
 */
function ortAb(rest: string, allesKlein: boolean): { ort: string; land: AngabeLand | null } {
  const zeile = rest.split(/[\n,;:!?()]|\s[-–—]\s/)[0] ?? "";
  const worte = zeile.replace(/\s+/g, " ").trim().split(" ");
  const ort: string[] = [];
  let land: AngabeLand | null = null;
  for (const w0 of worte) {
    const kuerzel = ORT_KUERZEL.test(w0) || /^st\.$/i.test(w0);
    const w = kuerzel ? w0 : w0.replace(/[.]+$/, "");
    if (!w) break;
    const l = landNorm(w);
    if (l && (w.length > 3 || /^(DE|AT|CH)$/.test(w))) { land = l; break; }
    if (/\d/.test(w) || ORT_STOPP.has(w.toLowerCase()) || AUSLAND.test(w)) break;
    if (!/^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß'’.\-/]*$/.test(w)) break;
    // Ein Ort beginnt groß — außer er schreibt alles klein („54321 neustadt“).
    if (!ort.length && !allesKlein && /^[a-zäöüß]/.test(w)) break;
    if (ort.length) {
      // Ein weiteres Wort nur nach einer Vorsilbe oder einem Kürzel — oder als Kürzel selbst („Frankfurt a.M.“).
      const vor = ort[ort.length - 1];
      const passt = kuerzel || ORT_KUERZEL.test(vor) || /^st\.$/i.test(vor) || (ort.length === 1 && ORT_VORSILBE.has(vor.toLowerCase().replace(/\.$/, "")));
      if (!passt) break;
    }
    ort.push(w);
    // Satzende: ein Wort mit Punkt (kein Kürzel) beendet den Ort.
    if (!kuerzel && /\.$/.test(w0)) break;
    if (ort.length >= 5) break;
  }
  return { ort: grossSchreiben(ort.join(" ")), land };
}

interface AnschriftFund { anschrift: Partial<Anschrift>; start: number; ende: number; ausland: boolean }

/** Alle Anschriften-Stellen (PLZ + Ort, die Straße davor) in einem Text. Rein. */
export function anschriftenFinden(text: string): AnschriftFund[] {
  const t = String(text ?? "");
  const allesKlein = !/[A-ZÄÖÜ]/.test(t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/gi, ""));
  const aus: AnschriftFund[] = [];
  const re = /(?:\b(D|A|CH)\s*-\s*)?\b(\d{4,5})\b(?=\s+[A-Za-zÄÖÜäöüß])/g;
  for (const m of Array.from(t.matchAll(re))) {
    const i = m.index ?? 0;
    const vor = t.slice(Math.max(0, i - 1), i);
    // Ein Datum („19.10.2026 Umzug“), ein Betrag („1.234“) oder eine längere Zahl ist keine Postleitzahl.
    if (/[.,\d/]/.test(vor)) continue;
    const plz = m[2];
    const nach = t.slice(i + m[0].length);
    const { ort, land: landOrt } = ortAb(nach, allesKlein);
    if (!ort || ort.length < 2) continue;
    const landPrefix = m[1] ? landNorm(m[1]) : null;
    // Die Straße: dieselbe Zeile vor der PLZ (nach dem letzten Trenner), sonst die Zeile davor.
    const zeilenAnfang = t.lastIndexOf("\n", i - 1) + 1;
    const vorDerPlz = t.slice(zeilenAnfang, i).replace(/[\s,;\-–—]+$/, "");
    const trenner = Math.max(vorDerPlz.lastIndexOf(","), vorDerPlz.lastIndexOf(";"), vorDerPlz.lastIndexOf(":"));
    let strasse = strasseAus(trenner >= 0 ? vorDerPlz.slice(trenner + 1) : vorDerPlz);
    let start = zeilenAnfang + (trenner >= 0 ? trenner + 1 : 0);
    if (!strasse && !/\d/.test(trenner >= 0 ? vorDerPlz.slice(trenner + 1) : vorDerPlz)) {
      // Die Zeile davor (Anschriftenblock) — nur, wenn auf dieser Zeile vor der PLZ keine Zahl steht.
      const ende = zeilenAnfang - 1;
      if (ende > 0) {
        const vorZeileAnfang = t.lastIndexOf("\n", ende - 1) + 1;
        const vorZeile = t.slice(vorZeileAnfang, ende);
        const s2 = strasseAus(vorZeile.split(/[,;:]/).pop() ?? "");
        if (s2) { strasse = s2; start = vorZeileAnfang; }
      }
    }
    const ortEnde = i + m[0].length + (nach.indexOf(ort.split(" ")[0]) >= 0 ? nach.indexOf(ort.split(" ")[0]) + ort.length : 0);
    const ausland = AUSLAND.test(t.slice(i, Math.min(t.length, ortEnde + 30)).split("\n")[0] ?? "");
    aus.push({ anschrift: { strasse: strasse ?? undefined, plz, ort, land: landPrefix ?? landOrt ?? null }, start, ende: ortEnde, ausland });
  }
  return aus;
}

/** Steht außerhalb der gefundenen Anschriften noch eine Straße mit Hausnummer („… auf Neuweg 2 in Neustadt“)? Rein. */
function andereStrasseAusser(text: string, funde: AnschriftFund[]): boolean {
  let rest = String(text ?? "");
  for (const f of funde) rest = rest.slice(0, f.start) + " ".repeat(Math.max(0, f.ende - f.start)) + rest.slice(f.ende);
  return /[A-Za-zÄÖÜäöüß](?:str(?:\.|a(?:ß|ss)e)?|weg|gasse|platz|allee|ring|damm|ufer|chaussee|steig|pfad|stieg|markt|hof|berg|feld|garten|park|zeile|kai)\s*\d{1,4}\s?[a-zA-Z]?(?![\d])/i.test(rest);
}

/** „Musterstr. 5“ = „musterstraße 5“ — für den Vergleich mit dem Gespeicherten. Rein. */
export function anschriftSchluessel(a: Partial<Anschrift> | null | undefined): string {
  // E-401 Nachbesserung: auch „str“ OHNE Punkt vor der Hausnummer („Hauptstr 5“) ist „straße“.
  const s = (x: unknown) => String(x ?? "").toLowerCase().replace(/ß/g, "ss").replace(/str\.(?=\s|$)|str(?=\s*\d)/g, "strasse").replace(/[^a-z0-9äöü]/g, "");
  return `${s(a?.strasse)}|${s(a?.plz)}|${s(a?.ort)}`;
}
/** Eine Zeile: „Neuweg 2, 54321 Neustadt“ (+ Land, wenn nicht DE). Rein. */
export function anschriftText(a: Partial<Anschrift> | null | undefined): string {
  if (!a) return "";
  const land = a.land === "AT" ? ", Österreich" : a.land === "CH" ? ", Schweiz" : "";
  return [a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") + (a.strasse || a.plz ? land : "");
}

// ═══════════════════════════════════════════════════════════════════════════
// E-MAIL UND TELEFON
// ═══════════════════════════════════════════════════════════════════════════
const MAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const MAIL_TIPPFEHLER = /@(?:gmial|gmai|gamil|gmali|gmaill|gnail)\.|@[^@\s]+\.(?:con|cpm|coom|cmo|comm|dee|ed|nett|ner)$|@gmail\.de$|\.\.|@googlemail\.de$/i;

/** Die Gmail-Grundform (googlemail = gmail, Punkte und „+Zusatz“ zählen nicht) — dieselbe Regel wie der Postmeister. Rein. */
export function mailGrundform(a: string | null | undefined): string {
  const t = String(a ?? "").trim().toLowerCase();
  const m = t.match(/^([^@]+)@(?:gmail|googlemail)\.com$/);
  if (!m) return t;
  return `${m[1].replace(/\+.*$/, "").replace(/\./g, "")}@gmail.com`;
}
/** Dasselbe Postfach? Rein. */
export function mailGleich(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = mailGrundform(a), y = mailGrundform(b);
  return !!x && x === y;
}
/** Sieht die Adresse richtig aus — Form, Länge, kein typischer Tippfehler („gmail.con“)? null = in Ordnung, sonst der Grund. Rein. */
export function mailPlausibel(adresse: string): string | null {
  const a = String(adresse ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(a)) return "Die E-Mail-Adresse hat keine gültige Form.";
  if (MAIL_TIPPFEHLER.test(a)) return "Die E-Mail-Adresse sieht nach einem Tippfehler aus.";
  if (/@fiaon\.com$/.test(a)) return "Eine Adresse von FIAON kann nicht seine sein.";
  return null;
}

/** Die letzten neun Ziffern — dieselbe Vergleichsform wie phone_key9 an der Person. Rein. */
export function nummerKern(n: string | null | undefined): string {
  return String(n ?? "").replace(/\D/g, "").slice(-9);
}
/** Dieselbe Nummer? (letzte neun Ziffern, mindestens sieben Ziffern). Rein. */
export function nummerGleich(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = String(a ?? "").replace(/\D/g, ""), y = String(b ?? "").replace(/\D/g, "");
  return x.length >= 7 && y.length >= 7 && nummerKern(x) === nummerKern(y);
}
const VORWAHL: Record<AngabeLand, string> = { DE: "49", AT: "43", CH: "41" };
/**
 * Eine Telefonnummer als E.164 („+4915112345678“) — „0151 …“ mit der Vorwahl seines Landes (DE, wenn unbekannt),
 * „0049 …“ und „+49 (0) …“ richtig. null = nicht plausibel. Rein.
 */
export function telefonNorm(roh: string, land: AngabeLand | null = null): string | null {
  let t = String(roh ?? "").trim().replace(/\(0\)/g, "").replace(/[\s/().\-–]/g, "");
  if (!/^\+?\d+$/.test(t)) return null;
  if (t.startsWith("00")) t = `+${t.slice(2)}`;
  else if (t.startsWith("0")) t = `+${VORWAHL[land ?? "DE"]}${t.slice(1)}`;
  else if (!t.startsWith("+")) {
    if (/^(49|43|41)\d{7,}$/.test(t)) t = `+${t}`;
    else return null;
  }
  // „+49 0151 …“ — die nationale Null nach der Landesvorwahl fällt weg.
  t = t.replace(/^\+(49|43|41)0/, "+$1");
  const z = t.slice(1);
  if (z.length < 8 || z.length > 15) return null;
  const cc = z.slice(0, 2);
  const rest = z.slice(2);
  if (cc === "49" && (rest.length < 6 || rest.length > 12)) return null;
  if (cc === "43" && (rest.length < 6 || rest.length > 13)) return null;
  if (cc === "41" && rest.length !== 9) return null;
  return t;
}
/**
 * Eine Nummer als volles E.164 für den ABSENDER-Vergleich auf WhatsApp — dort zählt die ganze Nummer mit Landesvorwahl,
 * nicht nur die letzten neun Ziffern (eine fremde Nummer in einem anderen Land könnte gleich enden).
 * `international`: die Nummer eines WhatsApp-Gesprächs (immer mit Landesvorwahl, ohne „+“). Rein.
 */
export function nummerE164(roh: string | null | undefined, land: AngabeLand | null = null, international = false): string | null {
  const t = String(roh ?? "").trim();
  if (!t) return null;
  if (international) {
    const z = t.replace(/\D/g, "").replace(/^00/, "");
    return z.length >= 8 && z.length <= 15 ? `+${z}` : null;
  }
  const n = telefonNorm(t, land);
  if (n) return n;
  const z = t.replace(/[^\d+]/g, "");
  if (z.startsWith("+") && z.length >= 9 && z.length <= 16) return z;
  if (z.startsWith("00") && z.length >= 10) return `+${z.slice(2)}`;
  return null;
}
/** Kommt die WhatsApp von dieser gespeicherten Nummer? Ganze Nummer, Landesvorwahl inklusive. Rein. */
export function waNummerGleich(waNummer: string | null | undefined, gespeichert: string | null | undefined, land: AngabeLand | null = null): boolean {
  const a = nummerE164(waNummer, null, true), b = nummerE164(gespeichert, land);
  return !!a && a === b;
}

/** „+4915112345678“ → „+49 151 12345678“. Rein. */
export function telefonText(e164: string | null | undefined): string {
  const t = String(e164 ?? "");
  const m = t.match(/^\+(49|43|41)(\d{3})(\d+)$/);
  if (m) return `+${m[1]} ${m[2]} ${m[3]}`;
  return t;
}
/** „+49 151 ••••5678“ — für Hinweis-Mails. Rein. */
export function telefonMaske(e164: string | null | undefined): string {
  const t = telefonText(e164);
  const ziffern = t.replace(/\D/g, "");
  if (ziffern.length < 8) return "•••";
  const m = t.match(/^(\+\d{2} \d{3}) (\d+)$/);
  if (m) return `${m[1]} ${"•".repeat(Math.max(2, m[2].length - 4))}${m[2].slice(-4)}`;
  return `${"•".repeat(Math.max(2, ziffern.length - 4))}${ziffern.slice(-4)}`;
}
/** „max.muster@beispiel.de“ → „m••••••••@b••••••.de“. Rein. */
export function mailMaske(adresse: string | null | undefined): string {
  const a = String(adresse ?? "").trim();
  const m = a.match(/^([^@]+)@([^.]+)(\..+)$/);
  if (!m) return "•••";
  const k = (s: string) => `${s.charAt(0)}${"•".repeat(Math.max(2, Math.min(8, s.length - 1)))}`;
  return `${k(m[1])}@${k(m[2])}${m[3]}`;
}

/** Stellen, die keine Telefonnummer sein können (Datum, Betrag, Referenz, IBAN, Uhrzeit) — mit Leerzeichen überschrieben. */
function ohneFremdeZahlen(t: string): string {
  const leer = (s: string) => " ".repeat(s.length);
  return t
    .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g, leer)       // IBAN
    .replace(/\bFIAON-?[A-Z0-9-]+\b/gi, leer)                                              // Referenzen
    .replace(/\b\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/g, leer)                                    // Datum
    .replace(/\b\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\s*(?:€|eur\w*)?/gi, leer)                  // Betrag
    .replace(/\b\d{1,2}[:.]\d{2}\s*uhr\b/gi, leer)                                         // Uhrzeit
    // E-401 Nachbesserung (Prüfer-Fund): „Meine Bestellnummer ist 0815-4711-2233“ ist keine Telefonnummer.
    .replace(/\b(?:bestell|kunden|vertrags|auftrags|rechnungs|referenz|antrags|ticket|sendungs|order|konto|mitglieds|versicherungs|steuer)-?\s?(?:nummer|nr\.?)[\s:#.-]*(?:ist|lautet)?\s*:?\s*\d[\d\s\-\/.]{2,}\d/gi, leer);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ERKENNUNG
// ═══════════════════════════════════════════════════════════════════════════
export interface ErkennenOpts {
  /** Die Absenderadresse der Mail (nie der neue Wert). */
  absender?: string | null;
  /** Gespeichertes Land (fiaon_applications.country / fiaon_persons.country) — für „0664 …“ und vierstellige PLZ. */
  landBisher?: string | null;
  /** Gespeicherte Werte — ein alter Wert in seinem Text („von … auf …“) ist nie der neue. */
  bisher?: { anschrift?: Partial<Anschrift> | null; email?: string | null; telefon?: string | null } | null;
}

/** Will er Anschrift, E-Mail oder Telefon ändern (oder etwas, das Mara nie ändert)? Rein, schnell — vor jedem Lesen. */
export function angabenWunsch(text: string): boolean {
  const t = String(text ?? "");
  return ANSCHRIFT_STARK.some((r) => r.test(t)) || EMAIL_STARK.some((r) => r.test(t)) || TELEFON_STARK.some((r) => r.test(t))
    || (ANSCHRIFT_SCHWACH.some((r) => r.test(t)) && anschriftenFinden(t).length > 0)
    || verbotenErkennen(t).length > 0;
}

/** Name, Geburtsdatum, Bankverbindung, Ausweis — was er ändern will, das Mara nie ändert. Rein. */
export function verbotenErkennen(text: string): VerbotenFeld[] {
  const t = String(text ?? "");
  return (Object.keys(VERBOTEN_MUSTER) as VerbotenFeld[]).filter((f) => VERBOTEN_MUSTER[f].some((r) => r.test(t)));
}

/**
 * Die ganze Erkennung: je Feld höchstens ein Wunsch (voll, unvollständig, unklar) und was Mara nie ändert.
 * Nur auf einen ausdrücklichen Wunsch hin; nur Werte, die wörtlich dastehen; im Zweifel „unklar“ (er schickt es noch
 * einmal) — nie geraten. Rein.
 */
export function angabenErkennen(text: string, o: ErkennenOpts = {}): AngabenErkennung {
  const t = String(text ?? "").replace(/\r/g, "");
  const wuensche: FeldWunsch[] = [];
  const verboten = verbotenErkennen(t);
  const landBisher = landNorm(o.landBisher);
  let maskiert = t;
  const ausblenden = (start: number, ende: number) => { maskiert = maskiert.slice(0, start) + " ".repeat(Math.max(0, ende - start)) + maskiert.slice(ende); };

  // ── E-MAIL (zuerst — ihre Ziffern sind nie eine Telefonnummer) ──
  const mails = Array.from(t.matchAll(MAIL_RE)).map((m) => ({ a: m[0].toLowerCase().replace(/\.$/, ""), i: m.index ?? 0, n: m[0].length }));
  for (const m of mails) ausblenden(m.i, m.i + m.n);
  const emailStark = EMAIL_STARK.some((r) => r.test(t));
  if (emailStark) {
    const kandidaten = Array.from(new Set(mails.map((m) => m.a)))
      .filter((a) => !mailGleich(a, o.absender) && !mailGleich(a, o.bisher?.email) && !/@fiaon\.com$/.test(a));
    if (kandidaten.length === 1) {
      const fehler = mailPlausibel(kandidaten[0]);
      wuensche.push(fehler ? { feld: "email", art: "unklar", grund: fehler } : { feld: "email", art: "voll", wert: kandidaten[0] });
    } else if (kandidaten.length > 1) {
      wuensche.push({ feld: "email", art: "unklar", grund: "Mehrere neue E-Mail-Adressen in seiner Nachricht — welche gilt?" });
    } else if (mails.some((m) => mailGleich(m.a, o.bisher?.email) && !mailGleich(m.a, o.absender))) {
      wuensche.push({ feld: "email", art: "voll", wert: String(o.bisher?.email).trim().toLowerCase() });
    } else {
      wuensche.push({ feld: "email", art: "unvollstaendig", fehlt: ["die neue E-Mail-Adresse"], grund: "Er will die E-Mail-Adresse ändern, nennt aber keine neue." });
    }
  }

  // ── ANSCHRIFT ──
  const funde = anschriftenFinden(maskiert);
  const anschriftStark = ANSCHRIFT_STARK.some((r) => r.test(t));
  const anschriftSchwach = ANSCHRIFT_SCHWACH.some((r) => r.test(t));
  // E-401 Nachbesserung (Prüfer-Fund): Steht im Satz mit dem Wunsch oder der Anschrift jemand anderes („meiner Mutter“),
  // sind es nicht SEINE Angaben — dann kein Wunsch (Mara antwortet wie bisher, ein Mensch sieht es im Verlauf).
  const anschriftDritte = funde.some((f) => DRITTE.test(satzUm(t, f.start)) || DRITTE.test(satzUm(t, f.ende)))
    || (!funde.length && ANSCHRIFT_STARK.some((r) => { const m = r.exec(t); return !!m && DRITTE.test(satzUm(t, m.index)); }));
  if ((anschriftStark || (anschriftSchwach && funde.length)) && !anschriftDritte) {
    const bisherSchl = o.bisher?.anschrift ? anschriftSchluessel(o.bisher.anschrift) : null;
    // „von der Altstraße 1, 12345 A nach Neuweg 2, 54321 B“: die gespeicherte fällt weg; bleibt eine, ist sie die neue.
    const neue = funde.filter((f) => !(bisherSchl && f.anschrift.strasse && anschriftSchluessel(f.anschrift) === bisherSchl));
    const kandidaten = neue.length ? neue : funde;
    for (const f of funde) ausblenden(f.start, f.ende);
    const textLand = landAus(t);
    if (kandidaten.length > 1 && new Set(kandidaten.map((f) => anschriftSchluessel(f.anschrift))).size > 1) {
      wuensche.push({ feld: "anschrift", art: "unklar", grund: "Mehrere Anschriften in seiner Nachricht — welche gilt?" });
    } else if (!kandidaten.length) {
      wuensche.push({ feld: "anschrift", art: "unvollstaendig", fehlt: ["Straße mit Hausnummer", "Postleitzahl", "Ort"], grund: "Er will die Anschrift ändern, nennt aber keine vollständige." });
    } else if (!neue.length && (!anschriftStark || andereStrasseAusser(maskiert, funde))) {
      // „Ich bin umgezogen“ — und in der Nachricht steht nur die gespeicherte (alte) Anschrift, etwa in der Signatur.
      // E-401 Nachbesserung (Prüfer-Fund): auch bei einem ausdrücklichen Wunsch, wenn daneben eine weitere Straße steht
      // („von Hauptstr. 5, 10115 Berlin auf Neuweg 2 in Neustadt“ — die neue ohne PLZ): Die gespeicherte Anschrift ist dann
      // NIE der neue Wert; es fehlt die neue. (Schickt er nur die gespeicherte noch einmal, bleibt es „schon so“.)
      wuensche.push({ feld: "anschrift", art: "unvollstaendig", fehlt: ["die neue Anschrift"], grund: "Er will die Anschrift ändern, nennt aber nur die bisherige (die neue fehlt oder ist unvollständig)." });
    } else if (ZUKUNFT.test(t)) {
      // E-401 Nachbesserung (Prüfer-Fund): „Ich werde im Dezember umziehen … bis dahin bitte die alte“ — die neue gilt erst
      // später. Sofort speichern wäre falsch; ein Mensch trägt sie zum richtigen Zeitpunkt ein.
      wuensche.push({ feld: "anschrift", art: "unklar", grund: "Die neue Anschrift gilt erst später — ein Kollege trägt sie zum richtigen Zeitpunkt ein; bis dahin bleibt die bisherige.", spaeter: true });
    } else {
      const f = kandidaten[kandidaten.length - 1];
      const a = f.anschrift;
      const plz = String(a.plz ?? "");
      let land: AngabeLand | null = a.land ?? textLand ?? null;
      if (f.ausland || (AUSLAND.test(t) && !land)) {
        wuensche.push({ feld: "anschrift", art: "unklar", grund: "Die neue Anschrift liegt außerhalb von Deutschland, Österreich und der Schweiz.", ausland: true });
      } else {
        if (!land) land = plz.length === 5 ? "DE" : landBisher === "AT" || landBisher === "CH" ? landBisher : null;
        const fehlt: string[] = [];
        if (!a.strasse) fehlt.push("Straße mit Hausnummer");
        if (!land) fehlt.push("das Land (Österreich oder Schweiz?)");
        if (fehlt.length) {
          wuensche.push({ feld: "anschrift", art: "unvollstaendig", fehlt, grund: `Anschrift unvollständig: ${fehlt.join(", ")} fehlt.` });
        } else if (!plzPlausibel(plz, land)) {
          wuensche.push({ feld: "anschrift", art: "unklar", grund: `Die Postleitzahl ${plz} passt nicht zu ${land === "DE" ? "Deutschland" : land === "AT" ? "Österreich" : "der Schweiz"}.` });
        } else {
          wuensche.push({ feld: "anschrift", art: "voll", wert: { strasse: String(a.strasse), plz, ort: String(a.ort), land } });
        }
      }
    }
  }

  // ── TELEFON ──
  const telStark = TELEFON_STARK.map((r) => r.exec(t)).find((m) => !!m) ?? null;
  if (telStark) {
    const rein = ohneFremdeZahlen(maskiert);
    const rohFunde = Array.from(rein.matchAll(/(?:\+|\b00|\b0|\b(?:49|43|41))[\d\s/().\-–]{5,}\d/g));
    // E-401 Nachbesserung (Prüfer-Fund): „Mein Sohn hat eine neue Handynummer …“, „Ihr Kollege hat mich von … angerufen“ —
    // nicht SEINE Nummer: kein Wunsch (phone_key9 und die Zuordnung von Anrufen und WhatsApp blieben sonst falsch).
    const telDritte = DRITTE.test(satzUm(t, telStark.index)) || rohFunde.some((m) => DRITTE.test(satzUm(t, m.index ?? 0)));
    const roh = telDritte ? [] : rohFunde.map((m) => m[0]);
    const landTel = landBisher ?? null;
    const normal = Array.from(new Set(roh.map((r) => telefonNorm(r, landTel)).filter((x): x is string => !!x)));
    const neue = normal.filter((n) => !nummerGleich(n, o.bisher?.telefon));
    if (neue.length === 1) wuensche.push({ feld: "telefon", art: "voll", wert: neue[0] });
    else if (neue.length > 1) wuensche.push({ feld: "telefon", art: "unklar", grund: "Mehrere neue Nummern in seiner Nachricht — welche gilt?" });
    else if (normal.length === 1) wuensche.push({ feld: "telefon", art: "voll", wert: normal[0] });
    else if (roh.length) wuensche.push({ feld: "telefon", art: "unklar", grund: "Die neue Nummer ist nicht eindeutig lesbar (bitte mit Vorwahl)." });
    else if (!telDritte) wuensche.push({ feld: "telefon", art: "unvollstaendig", fehlt: ["die neue Telefonnummer"], grund: "Er will die Nummer ändern, nennt aber keine neue." });
  }

  return { wuensche, verboten };
}

// ═══════════════════════════════════════════════════════════════════════════
// SÄTZE, HINWEIS, PRÜFUNG
// ═══════════════════════════════════════════════════════════════════════════
function fehltText(f: string[] | undefined): string {
  const l = (f ?? []).filter(Boolean);
  if (!l.length) return "die fehlende Angabe";
  return l.length === 1 ? l[0] : `${l.slice(0, -1).join(", ")} und ${l[l.length - 1]}`;
}

/**
 * Was ein Mensch übernimmt. Mail: Mara gibt wie bisher eine Aufgabe (Fall 4) — „trägt ein Kollege ein“. WhatsApp: der
 * Server legt Justin eine Karte vor — derselbe Satz wie E-372 („prüft unsere Geschäftsführung persönlich …“).
 */
function menschSatz(was: string, kanal: AngabenKanal, verb = "trägt ein Kollege für Sie ein"): string {
  return kanal === "whatsapp"
    ? `${was} prüft unsere Geschäftsführung persönlich, und Sie bekommen dazu eine Nachricht.`
    : `${was} ${verb}.`;
}

/** Der Satz je Feld an den Kunden (Sie-Form). Rein. */
export function feldSatz(e: FeldErgebnis, kanal: AngabenKanal): string {
  if (e.stand === "probe") {
    const was = e.waere === "geaendert" ? `würde ich auf ${e.feld === "telefon" ? telefonText(e.nachher) : e.nachher} ändern`
      : e.waere === "link_geschickt" ? `würde ich nach einem Bestätigungslink an ${e.nachher} ändern`
      : e.waere === "schon_so" ? "ist schon so hinterlegt" : "würde ich so nicht ändern";
    return `Testkonto: Ihre ${FELD_NAME[e.feld]} ${was} — bei einem Testkonto speichere und verschicke ich nichts.`;
  }
  const stand = e.stand;
  switch (`${e.feld}:${stand}`) {
    case "anschrift:geaendert": return `Ich habe Ihre neue Anschrift gespeichert: ${e.nachher}.`;
    case "anschrift:schon_so": return `Ihre Anschrift ${e.nachher} ist bei uns schon genau so hinterlegt.`;
    case "anschrift:unvollstaendig": return `Damit ich Ihre neue Anschrift eintragen kann, fehlt mir noch ${fehltText(e.fehlt)} — schicken Sie mir die Anschrift bitte vollständig (Straße mit Hausnummer, Postleitzahl, Ort).`;
    case "anschrift:unklar": return `Ihre neue Anschrift konnte ich so nicht sicher übernehmen — schicken Sie sie mir bitte noch einmal vollständig (Straße mit Hausnummer, Postleitzahl, Ort und Land).`;
    case "anschrift:mensch": return menschSatz("Ihre neue Anschrift", kanal);
    case "email:link_geschickt": return `Ich habe Ihnen an ${e.nachher} einen Bestätigungslink geschickt — sobald Sie ihn anklicken, gilt Ihre neue E-Mail-Adresse (der Link ist ${LINK_STUNDEN} Stunden gültig). Bis dahin bleibt Ihre bisherige Adresse hinterlegt.`;
    case "email:schon_so": return `Ihre E-Mail-Adresse ${e.nachher} ist bei uns schon genau so hinterlegt.`;
    case "email:unvollstaendig": return `Welche E-Mail-Adresse soll künftig gelten? Schreiben Sie sie mir bitte genau auf.`;
    case "email:unklar": return `Ihre neue E-Mail-Adresse konnte ich so nicht sicher übernehmen — schreiben Sie sie mir bitte noch einmal genau auf.`;
    case "email:mensch": return menschSatz("Ihre neue E-Mail-Adresse", kanal);
    case "telefon:geaendert": return `Ihre neue Telefonnummer ${telefonText(e.nachher)} ist gespeichert.`;
    case "telefon:schon_so": return `Ihre Telefonnummer ${telefonText(e.nachher)} ist bei uns schon genau so hinterlegt.`;
    case "telefon:unvollstaendig": return `Wie lautet Ihre neue Telefonnummer? Schreiben Sie sie mir bitte mit Vorwahl (zum Beispiel +49 …).`;
    case "telefon:unklar": return `Ihre neue Telefonnummer konnte ich so nicht sicher übernehmen — schreiben Sie sie mir bitte noch einmal mit Vorwahl (zum Beispiel +49 …).`;
    case "telefon:mensch": return menschSatz(kanal === "whatsapp" ? "Ihre neue Nummer" : "Ihre neue Telefonnummer", kanal);
    default: return "";
  }
}

/** Der eine Absatz an den Kunden — alle Felder, der fremde Absender einmal, was Mara nie ändert. Rein. */
export function angabenSatz(l: AngabenLageRein): string {
  const teile: string[] = [];
  const fremd = l.ergebnisse.filter((e) => e.stand === "fremder_absender");
  for (const e of l.ergebnisse) if (e.stand !== "fremder_absender") { const s = feldSatz(e, l.kanal); if (s) teile.push(s); }
  if (fremd.length && l.absenderUnbestaetigt && l.kanal === "mail") {
    // E-401 Nachbesserung: Die Mail trägt seine Adresse, ließ sich aber nicht als echt bestätigen — nie ändern, nie Daten nennen.
    teile.push(`Aus Sicherheitsgründen ändere ich Ihre ${fremd.map((e) => FELD_NAME[e.feld]).join(" und ")} nicht allein auf eine E-Mail hin — bitte ändern Sie sie selbst in Ihrem Kundenbereich unter ${KUNDENBEREICH_DATEN}.`);
  } else if (fremd.length) {
    teile.push(l.kanal === "whatsapp"
      ? `Aus Sicherheitsgründen ändere ich Ihre ${fremd.map((e) => FELD_NAME[e.feld]).join(" und ")} nur, wenn Sie mir von Ihrer bei uns hinterlegten Telefonnummer schreiben — oder Sie ändern sie selbst in Ihrem Kundenbereich unter ${KUNDENBEREICH_DATEN}.`
      : `Aus Sicherheitsgründen ändere ich Ihre ${fremd.map((e) => FELD_NAME[e.feld]).join(" und ")} nur, wenn Sie uns von Ihrer bei uns hinterlegten E-Mail-Adresse schreiben — oder Sie ändern sie selbst in Ihrem Kundenbereich unter ${KUNDENBEREICH_DATEN}.`);
  }
  if (l.verboten.length) {
    const was = l.verboten.map((v) => VERBOTEN_NAME[v]);
    const liste = was.length === 1 ? was[0] : `${was.slice(0, -1).join(", ")} und ${was[was.length - 1]}`;
    teile.push(l.kanal === "whatsapp"
      ? `${liste} ändere ich nicht selbst — das prüft unsere Geschäftsführung persönlich, und Sie bekommen dazu eine Nachricht.`
      : `${liste} ändere ich nicht selbst — das prüft ein Kollege und trägt es für Sie ein.`);
  }
  return teile.join(" ");
}

/** Muss ein Mensch ran? (Mail: aufgabe_an_betreuer Fall 4 — WhatsApp: der Server legt Justin eine Karte vor.) Rein. */
export function angabenMenschNoetig(l: AngabenLageRein): boolean {
  return l.verboten.length > 0 || l.ergebnisse.some((e) => e.stand === "mensch");
}

/** Der Block für Maras Auftrag (vorab). Rein. */
export function angabenHinweis(l: AngabenLageRein): string {
  const zeilen = l.ergebnisse.map((e) => {
    const f = FELD_NAME[e.feld];
    const pfeil = e.vorher != null && e.nachher != null ? ` (${e.feld === "telefon" ? telefonText(e.vorher) || "leer" : e.vorher || "leer"} → ${e.feld === "telefon" ? telefonText(e.nachher) : e.nachher})` : "";
    switch (e.stand) {
      case "geaendert": return `· ${f}: GESPEICHERT${pfeil}.`;
      case "link_geschickt": return `· ${f}: NOCH NICHT GEÄNDERT — Bestätigungslink an die NEUE Adresse ${e.nachher} geschickt (${LINK_STUNDEN} Stunden gültig), Hinweis an die bisherige. Erst sein Klick ändert sie.`;
      case "schon_so": return `· ${f}: schon genau so gespeichert — nichts zu tun.`;
      case "unvollstaendig": return `· ${f}: NICHT geändert — es fehlt ${fehltText(e.fehlt)}. Frag genau danach.`;
      case "unklar": return `· ${f}: NICHT geändert — ${e.grund ?? "nicht eindeutig"}. Bitte ihn, es noch einmal genau zu schicken.`;
      case "fremder_absender": return l.absenderUnbestaetigt && l.kanal === "mail"
        ? `· ${f}: NICHT geändert — die Mail trägt zwar die gespeicherte Adresse, ließ sich aber NICHT als echt bestätigen (keine Absender-Prüfung bestanden oder eine fremde Antwortadresse) — sie könnte gefälscht sein. Nenn ihm NIE gespeicherte Daten aus der Akte.`
        : `· ${f}: NICHT geändert — die Nachricht kommt NICHT vom gespeicherten Absender (${l.kanal === "whatsapp" ? "andere Nummer" : "andere Mail-Adresse"}). Nenn ihm NIE die gespeicherte ${l.kanal === "whatsapp" ? "Nummer" : "Adresse"} und keine anderen Daten aus der Akte.`;
      case "mensch": return `· ${f}: NICHT geändert — ${e.grund ?? "ein Mensch trägt es ein"}.${l.kanal !== "whatsapp" ? " Dafür gibst du eine Aufgabe (aufgabe_an_betreuer, Fall 4)." : " Der Server legt es Justin vor (Karte)."}`;
      case "probe": return `· ${f}: TESTKONTO — nichts gespeichert, nichts verschickt (wäre: ${e.waere ?? "?"}${pfeil}).`;
      default: return "";
    }
  }).filter(Boolean);
  if (l.verboten.length) zeilen.push(`· ${l.verboten.map((v) => VERBOTEN_INTERN[v]).join(", ")}: ändert Mara NIE selbst — ${l.kanal !== "whatsapp" ? "dafür gibst du wie bisher eine Aufgabe (aufgabe_an_betreuer, Fall 4)" : "der Server legt es Justin vor (Karte)"}.`);
  const satz = angabenSatz(l);
  const keinWerkzeug = l.kanal !== "whatsapp"
    ? "Für Anschrift, E-Mail-Adresse und Telefonnummer gibst du KEINE Aufgabe und rufst kein Werkzeug — der Server hat es erledigt (außer oben steht „Dafür gibst du eine Aufgabe“)."
    : "Für Anschrift, E-Mail-Adresse und Telefonnummer rufst du KEIN Werkzeug (auch nicht angaben_eintragen) — der Server hat es erledigt.";
  return [
    `ANGABEN (angaben_aendern ist gelaufen — der Server hat seinen Änderungswunsch eben selbst bearbeitet):`,
    ...zeilen,
    `SO ANTWORTEST DU: Sag es ihm kurz und freundlich, sinngemäß: „${satz}“ ${keinWerkzeug} Schreib nie, etwas sei geändert, gespeichert oder hinterlegt, was oben nicht GESPEICHERT heißt — die E-Mail-Adresse gilt erst nach seinem Klick. Danach beantwortest du alles andere aus seiner Nachricht wie immer.`,
  ].join("\n");
}

const FELD_WORT: Record<AngabeFeld, RegExp> = {
  anschrift: /\b(?:adresse|anschrift|wohnadresse)\b/i,
  email: /\b(?:e-?mail|mail-?adresse|e-?mail-?adresse)\b/i,
  telefon: /\b(?:telefon\w*|handy\w*|rufnummer|mobilnummer|nummer)\b/i,
};
const VERBOTEN_WORT: Record<VerbotenFeld, RegExp> = {
  name: /\b(?:name|namen|nachname\w*|vorname\w*|familienname\w*)\b/i,
  geburtsdatum: /\bgeburts(?:datum|tag)\b/i,
  bank: /\b(?:iban|bankverbindung|kontoverbindung|bankdaten|kontonummer)\b/i,
  ausweis: /\b(?:ausweis\w*|reisepass\w*|passnummer)\b/i,
};
const ERLEDIGT = /\b(?:habe|hab|haben|ist|sind|wurde|wurden)\b[^.!?\n]{0,80}(?:^|[^A-Za-zÄÖÜäöüß])(?:ge(?:ä|ae)ndert|aktualisiert|gespeichert|eingetragen|(?:ü|ue)bernommen|hinterlegt|korrigiert|umgestellt)\b|\b(?:ge(?:ä|ae)ndert|aktualisiert|gespeichert|eingetragen|korrigiert|umgestellt)\s*(?:[.!]|$)/i;
const NICHT_ERLEDIGT = /\b(?:nicht|noch\s+nicht|erst|sobald|wenn|nachdem|bis|kein\w*|bleibt|bisherige\w*|alte[nrs]?|schon\s+genau\s+so|bereits\s+(?:genau\s+)?so|wird|werden|trägt|tragen|prüf\w*)\b/i;

function saetze(t: string): string[] {
  return String(t ?? "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}
/** Behauptet ein Satz, ein Feld sei geändert? Den Satz zurück, sonst null. Rein. */
function behauptetGeaendert(text: string, wort: RegExp): string | null {
  for (const s of saetze(text)) if (wort.test(s) && ERLEDIGT.test(s) && !NICHT_ERLEDIGT.test(s)) return s;
  return null;
}

/**
 * Die Antwortprüfung (Mail und WhatsApp, hart): nie „geändert/gespeichert“, was der Server nicht gespeichert hat; die
 * neue E-Mail-Adresse erst nach dem Klick; Name, Geburtsdatum, Bank, Ausweis nie „geändert“; dem fremden Absender nie
 * die gespeicherten Daten. Was gespeichert ist, nennt die Antwort (Anschrift: PLZ, Telefon: die letzten vier Ziffern).
 * Rein.
 */
export function angabenAntwortFunde(antwort: string, l: AngabenLageRein): string[] {
  const t = String(antwort ?? "");
  const funde: string[] = [];
  const satz = angabenSatz(l);
  for (const e of l.ergebnisse) {
    const stand = e.stand;
    const f = FELD_NAME[e.feld];
    if (stand !== "geaendert" && stand !== "schon_so") {
      const b = behauptetGeaendert(t, FELD_WORT[e.feld]);
      if (b) funde.push(`Die Antwort sagt, die ${f} sei geändert („${b.slice(0, 90)}“) — das ist sie NICHT${stand === "link_geschickt" ? " (erst nach seinem Klick auf den Bestätigungslink)" : ""}. Sag es so: „${satz}“`);
    }
    if (stand === "link_geschickt" && !(/\blink\b|bestätig|bestaetig/i.test(t) && (t.toLowerCase().includes(String(e.nachher ?? "").toLowerCase()) || /\bneue[nrs]?\b/i.test(t)))) {
      funde.push(`Die Antwort nennt den Bestätigungslink an seine neue E-Mail-Adresse nicht — ein Satz: „${feldSatz(e, l.kanal)}“`);
    }
    if (stand === "geaendert" && e.feld === "anschrift") {
      const plz = String(e.nachher ?? "").match(/\b\d{4,5}\b/)?.[0];
      if (plz && !t.includes(plz)) funde.push(`Die Antwort nennt die gespeicherte Anschrift nicht — ein Satz: „${feldSatz(e, l.kanal)}“`);
    }
    if (stand === "geaendert" && e.feld === "telefon") {
      const vier = String(e.nachher ?? "").replace(/\D/g, "").slice(-4);
      if (vier && !t.replace(/\D/g, "").includes(vier)) funde.push(`Die Antwort nennt die gespeicherte Telefonnummer nicht — ein Satz: „${feldSatz(e, l.kanal)}“`);
    }
  }
  for (const v of l.verboten) {
    const b = behauptetGeaendert(t, VERBOTEN_WORT[v]);
    if (b) funde.push(`Die Antwort sagt, ${VERBOTEN_NAME[v].replace(/^Ihre?n? /, "")} sei geändert („${b.slice(0, 90)}“) — das ändert Mara nie selbst; ein Kollege prüft es.`);
  }
  if (l.ergebnisse.some((e) => e.stand === "fremder_absender")) {
    for (const g of (l.geheim ?? []).filter((x) => String(x ?? "").trim().length >= 5)) {
      const roh = String(g).trim();
      const ziffern = roh.replace(/\D/g, "");
      const steht = roh.includes("@") ? t.toLowerCase().includes(roh.toLowerCase())
        : ziffern.length >= 7 ? t.replace(/\D/g, "").includes(ziffern.slice(-7))
        : t.toLowerCase().includes(roh.toLowerCase());
      if (steht) { funde.push("Die Antwort nennt gespeicherte Daten aus der Akte an einen Absender, der NICHT der gespeicherte ist — nimm sie heraus."); break; }
    }
    if (!/kundenbereich|hinterlegt/i.test(t)) funde.push(`Die Antwort erklärt nicht, wie er die Änderung sicher macht — ein Satz: „${satz}“`);
  }
  return funde;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE MAILS (Text — der CI-Rahmen kommt aus eigeneMailSenden)
// ═══════════════════════════════════════════════════════════════════════════
export function bestaetigungsMail(e: { name: string | null; neu: string }): { betreff: string; text: string; knopf: string; fuss: string } {
  return {
    betreff: "Bitte bestätigen Sie Ihre neue E-Mail-Adresse",
    text: `Guten Tag${e.name ? ` ${e.name}` : ""},\n\nSie haben uns gebeten, Ihre E-Mail-Adresse bei FIAON auf ${e.neu} zu ändern. Damit wir sicher sind, dass diese Adresse Ihnen gehört, bestätigen Sie sie bitte mit einem Klick auf den Knopf unten.\n\nErst danach gilt die neue Adresse — auch für die Anmeldung in Ihrem Kundenbereich.`,
    knopf: "E-Mail-Adresse bestätigen",
    fuss: `Der Link ist ${LINK_STUNDEN} Stunden gültig. Haben Sie das nicht angefordert? Dann ignorieren Sie diese E-Mail einfach — es ändert sich nichts.`,
  };
}
export function hinweisAlteMail(e: { name: string | null; neu: string }): { betreff: string; text: string; knopf: string; fuss: string } {
  return {
    betreff: "Ihre E-Mail-Adresse bei FIAON soll geändert werden",
    text: `Guten Tag${e.name ? ` ${e.name}` : ""},\n\nwir haben die Bitte erhalten, Ihre E-Mail-Adresse bei FIAON auf ${mailMaske(e.neu)} zu ändern. An diese neue Adresse haben wir einen Bestätigungslink geschickt — erst nach dem Klick darauf gilt sie. Bis dahin bleibt alles, wie es ist.\n\nWaren Sie das nicht? Dann stoppen Sie die Änderung mit einem Klick auf den Knopf unten — oder antworten Sie einfach auf diese E-Mail, wir kümmern uns sofort darum.`,
    // E-401 Nachbesserung (Prüfer-Fund): ein Stopp-Knopf — wer es nicht war, hält die Änderung selbst an.
    knopf: "Das war ich nicht — Änderung stoppen",
    fuss: "Der Knopf stoppt die Änderung sofort; Ihre bisherige Adresse bleibt hinterlegt.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// IST DIE MAIL ECHT? — Gmails Absender-Prüfung (E-401 Nachbesserung, Prüfer-Fund)
//
// „Vom gespeicherten Absender“ hieß bisher nur: Die From-Zeile trägt seine Adresse. Die lässt sich fälschen — und Mara
// antwortet an Reply-To. So hätte ein Fremder Anschrift und Nummer ändern und die E-Mail-Adresse auf seine umstellen
// können. Gmail prüft beim Empfang SPF, DKIM und DMARC und schreibt das Ergebnis in den OBERSTEN Kopf
// „Authentication-Results: mx.google.com; …“. Echt ist die Mail nur, wenn eine dieser Prüfungen zur Absender-Domain
// besteht — und ein Reply-To fehlt, gleich dem Absender ist oder selbst eine gespeicherte Adresse ist.
// ═══════════════════════════════════════════════════════════════════════════
function domainAus(x: string | null | undefined): string {
  const t = String(x ?? "").trim().toLowerCase().replace(/^.*<([^>]+)>.*$/, "$1");
  return (t.includes("@") ? t.slice(t.lastIndexOf("@") + 1) : t).replace(/[>\s;,()]+$/g, "").replace(/^@/, "");
}
/** Passt die geprüfte Domain zur Absender-Domain (gleich oder deren Ober-Domain, „relaxed alignment“)? */
function domainPasst(geprueft: string, absender: string): boolean {
  const g = geprueft.toLowerCase(), a = absender.toLowerCase();
  return !!g && !!a && (g === a || a.endsWith(`.${g}`));
}
/**
 * Ist die Mail wirklich von dieser Adresse? `authErgebnis` = Wert des obersten „Authentication-Results“ (nur, wenn er
 * mit „mx.google.com“ beginnt — das liest fiaon-gmail.ts). Rein.
 */
export function absenderEcht(e: { authErgebnis: string | null | undefined; von: string | null | undefined; antwortAn?: string | null; bekannte?: string[] }): { echt: boolean; grund: string } {
  const vonAdresse = String(e.von ?? "").toLowerCase().replace(/^.*<([^>]+)>.*$/, "$1").trim();
  const vonDomain = domainAus(vonAdresse);
  if (!vonDomain) return { echt: false, grund: "kein Absender" };
  const reply = String(e.antwortAn ?? "").toLowerCase().replace(/^.*<([^>]+)>.*$/, "$1").trim();
  if (reply && !mailGleich(reply, vonAdresse) && !(e.bekannte ?? []).some((b) => mailGleich(b, reply))) {
    return { echt: false, grund: "fremde Antwortadresse (Reply-To)" };
  }
  const auth = String(e.authErgebnis ?? "");
  if (!/^\s*mx\.google\.com\b/i.test(auth)) return { echt: false, grund: "keine Absender-Prüfung von Gmail" };
  for (const teil of auth.split(";")) {
    const dmarc = teil.match(/\bdmarc=(\w+)[\s\S]*?\bheader\.from=([^\s;]+)/i);
    if (dmarc && dmarc[1].toLowerCase() === "pass" && domainPasst(domainAus(dmarc[2]), vonDomain)) return { echt: true, grund: "dmarc=pass" };
    const dkim = teil.match(/\bdkim=(\w+)[\s\S]*?\bheader\.[id]=([^\s;]+)/i);
    if (dkim && dkim[1].toLowerCase() === "pass" && domainPasst(domainAus(dkim[2]), vonDomain)) return { echt: true, grund: "dkim=pass" };
    const spf = teil.match(/\bspf=(\w+)[\s\S]*?\bsmtp\.mailfrom=([^\s;]+)/i);
    if (spf && spf[1].toLowerCase() === "pass" && domainPasst(domainAus(spf[2]), vonDomain)) return { echt: true, grund: "spf=pass" };
  }
  return { echt: false, grund: "keine bestandene Absender-Prüfung (SPF/DKIM/DMARC) für die Absender-Domain" };
}

// ═══════════════════════════════════════════════════════════════════════════
// OHNE BLOCK „ANGABEN“ — nie „geändert“ behaupten (E-401 Nachbesserung, Prüfer-Fund)
// ═══════════════════════════════════════════════════════════════════════════
// Nur die Angaben selbst — nicht „Ihre E-Mail“ (die Nachricht) oder „am Telefon“.
const FELD_WORT_STRENG: Record<AngabeFeld, RegExp> = {
  anschrift: /\b(?:anschrift|wohnadresse|meldeadresse|postanschrift)\b|(?<![-\w])adresse\b(?![-\w])/i,
  email: /\b(?:e-?mail-?adresse|e-?mail\s+adresse|mail-?adresse)\b/i,
  telefon: /\b(?:telefonnummer|handynummer|rufnummer|mobilnummer|telefon-?nummer|handy-?nummer)\b/i,
};
const GEAENDERT_STRENG = /\b(?:habe|hab|haben|ist|sind|wurde|wurden)\b[^.!?\n]{0,80}(?:^|[^A-Za-zÄÖÜäöüß])(?:ge(?:ä|ae)ndert|aktualisiert|gespeichert|eingetragen|(?:ü|ue)bernommen|korrigiert|umgestellt)\b/i;
/**
 * Ist angaben_aendern NICHT gelaufen (kein Block ANGABEN — der Wunsch wurde nicht erkannt), darf die Antwort nie
 * behaupten, Anschrift, E-Mail-Adresse oder Telefonnummer seien geändert: Dann hat niemand etwas geändert. Rein.
 */
export function angabenOhneLageFunde(antwort: string): string[] {
  const funde: string[] = [];
  for (const s of saetze(antwort)) {
    for (const f of Object.keys(FELD_WORT_STRENG) as AngabeFeld[]) {
      if (FELD_WORT_STRENG[f].test(s) && GEAENDERT_STRENG.test(s) && !NICHT_ERLEDIGT.test(s)) {
        funde.push(`Die Antwort sagt, die ${FELD_NAME[f]} sei geändert („${s.slice(0, 90)}“) — geändert hat niemand etwas (kein Block ANGABEN). Gib dafür wie bisher eine Aufgabe (aufgabe_an_betreuer, Fall 4) und schreib, dass ein Kollege es für ihn einträgt.`);
        return funde;
      }
    }
  }
  return funde;
}
export function hinweisTelefonMail(e: { name: string | null; alt: string | null; neu: string }): { betreff: string; text: string } {
  return {
    betreff: "Ihre Telefonnummer bei FIAON wurde geändert",
    text: `Guten Tag${e.name ? ` ${e.name}` : ""},\n\nauf Ihre Nachricht hin haben wir Ihre Telefonnummer bei FIAON geändert: ${e.alt ? `${telefonMaske(e.alt)} → ` : ""}${telefonMaske(e.neu)}.\n\nWaren Sie das nicht? Dann antworten Sie bitte einfach auf diese E-Mail — wir kümmern uns sofort darum.`,
  };
}

/**
 * Ersetzt angaben_aendern diese aufgabe_an_betreuer? Nur eine reine Stammdaten-Aufgabe (Anschrift, E-Mail-Adresse,
 * Telefonnummer) an den Betreuer oder einen genannten Kollegen — nie an die Leitung oder die Zahlungsstelle, nie mit
 * Rückruf, nie, wenn Geld, Erstattung, Widerruf, Kulanz, Beleg, Zahlung, Kündigung, Storno, Beschwerde oder Anwalt darin
 * stehen. E-401 Nachbesserung (Prüfer-Fund): Vorher reichte das Wort „E-Mail“ — „Kunde widerruft per E-Mail und verlangt
 * sein Geld zurück“ an die Leitung wurde gesperrt. Rein.
 */
export function angabenAufgabeErsetzbar(p: { titel?: unknown; text?: unknown; kollege?: unknown; rueckruf_am?: unknown } | null | undefined): boolean {
  const inhalt = `${String(p?.titel ?? "")} ${String(p?.text ?? "")}`;
  if (String(p?.rueckruf_am ?? "").trim()) return false;
  if (/\b(?:leitung|chef|gesch[äa]ftsf[üu]hr\w*|management|zahlung|beleg|buchhaltung|inkasso|forderung|bankbuch)\b/i.test(String(p?.kollege ?? ""))) return false;
  if (/r(?:ü|ue)ckruf|zur(?:ü|ue)ckruf|anruf|\bgeld\b|erstatt|widerruf|kulanz|beleg|zahlung|überweis|ueberweis|k(?:ü|ue)ndig|storn|beschwerde|anwalt|rechtlich/i.test(inhalt)) return false;
  return /\b(?:adress\w*|anschrift\w*|umzug|umgezogen|e-?mail-?adresse\w*|mailadresse\w*|telefonnummer\w*|handynummer\w*|rufnummer\w*|mobilnummer\w*|stammdaten)\b|\bneue[nrs]?\s+(?:handy|telefon|mobil)?-?nummer\b|daten(?:ä|ae)nderung/i.test(inhalt);
}
