// ═══════════════════════════════════════════════════════════════════════════
// DIE ANREDE — EINE REGEL FÜR MAIL, WHATSAPP, SMS UND MARA (22.09.2026, E-210)
//
// Justin: „alle Benennungen (wie heißt ein Kunde), die Nachrichten, wie sie
// geschrieben werden — einfach alles 100 % DICHT."
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// GEMESSEN 22.09.2026 in der laufenden Lead-Strecke (3.054 Menschen): 92
// Vornamen komplett klein, 20 komplett GROSS, dazu 28 Vornamen mit Ziffern
// oder @ im gesamten Bestand. Die Strecke schrieb ungeprüft „Hallo {vorname},"
// — also „Hallo max," und „Hallo ANNA,", und bei „0176…" im Namensfeld die
// Telefonnummer als Anrede. Jede Strecke baute sich ihre Anrede selbst.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// · Anrede bekannt (Herr/Frau) und Nachname brauchbar:
//     Mail „Guten Tag Frau Dr. Muster,"  ·  Chat „Hallo Frau Dr. Muster,"
// · sonst der volle Name:  „Guten Tag Maria Muster,"  ·  „Hallo Maria Muster,"
// · nur ein brauchbarer Vorname:  „Guten Tag Maria,"
// · nichts Brauchbares:  „Guten Tag,"  ·  „Hallo,"
// Gesiezt wird in jedem Fall (E-002, E-117) — die Anrede entscheidet nur den
// Namen, nie das Du.
//
// ── SCHREIBWEISE: NUR FÜR DIE ANZEIGE, NUR BEI EINHEITSSCHRIFT ────────────
// Gespeichert bleibt, was der Mensch getippt hat (shared/fiaon-namen.ts:
// „ein Name gehört dem Menschen"). Für die ANREDE korrigieren wir genau einen
// Fall: Wer alles klein oder alles GROSS tippt, hat nicht „so steht es im Pass"
// gemeint, sondern schnell getippt. „max mustermann" → „Max Mustermann",
// „ANNA VON DER HEIDE" → „Anna von der Heide". Gemischte Schreibweise
// („McDonald", „Mcdonald", „de Vries") bleibt unangetastet.
// ═══════════════════════════════════════════════════════════════════════════

export interface AnredeEin {
  vorname?: string | null;
  nachname?: string | null;
  /** „Herr" / „Frau" — alles andere zählt als unbekannt. */
  anrede?: string | null;
}

export interface NameFuerAnrede {
  /** Vorname für die Anrede, ohne Titel — oder null, wenn unbrauchbar. */
  vorname: string | null;
  /** Nachname für die Anrede — oder null, wenn unbrauchbar. */
  nachname: string | null;
  /** Titel vor dem Namen („Dr.", „Prof. Dr.") — gehört in „Frau Dr. Muster". */
  titel: string | null;
  /** Der volle Name, wie er in einer Anrede steht („Dr. Maria Muster"). */
  voll: string | null;
  /** „herr" | „frau" | null */
  anrede: "herr" | "frau" | null;
}

/** Namenszusätze, die innerhalb eines Namens klein bleiben („Anna von der Heide"). */
const ZUSATZ_KLEIN = new Set([
  "von", "vom", "van", "de", "del", "della", "der", "den", "di", "da", "das", "dos", "du",
  "zu", "zur", "zum", "ten", "ter", "la", "le", "lo", "af", "av", "bin", "ibn", "al", "el", "und",
]);

/** Titel, die vor dem Namen stehen dürfen („Dr.", „Prof."). */
const TITEL = new Set(["dr", "dr.", "prof", "prof.", "dipl.-ing.", "dipl.-ing", "mag.", "mag", "ing.", "ing"]);

/** Wörter, die jemand ins Namensfeld tippt, ohne einen Namen zu meinen. */
const MUELL = new Set([
  "test", "testing", "tester", "asdf", "asd", "qwe", "qwert", "qwertz", "qwerty", "abc", "xyz", "xx", "xxx",
  "name", "vorname", "nachname", "keine", "kein", "keiner", "niemand", "nobody", "anonym", "anonymous",
  "na", "n/a", "nix", "nichts", "fake", "facebook", "instagram", "user", "nutzer", "kunde", "privat",
  "herr", "frau", "hallo", "hi", "moin", "ja", "nein", "ok", "mr", "mrs", "ms",
]);

// Zur Laufzeit gebaut: Das Projekt übersetzt für ein Ziel ohne das u-Flag im Literal
// (wie in shared/fiaon-telefonkartei.ts).
const BUCHSTABE = new RegExp("\\p{L}", "u");
const SYMBOL = new RegExp("[\\p{Extended_Pictographic}\\u{FE0F}\\u{200D}\\u{20E3}]", "gu");
const KEIN_NAMENSZEICHEN = new RegExp("[^\\p{L}\\p{M}\\s'’.\\-]", "gu");

/** Zeichen, die in einem Namen nichts verloren haben (Emojis, Symbole) — sie fallen für die Anzeige weg. */
function ohneSymbole(s: string): string {
  return s
    .replace(SYMBOL, "")
    .replace(KEIN_NAMENSZEICHEN, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ein Wort mit großem Anfang — auch nach Bindestrich und Apostroph („Hans-Peter", „O'Brien"). */
function grossAnfang(wort: string): string {
  return wort.split(/([-'’])/).map((teil) => {
    if (teil === "-" || teil === "'" || teil === "’" || !teil) return teil;
    return teil.charAt(0).toLocaleUpperCase("de-DE") + teil.slice(1).toLocaleLowerCase("de-DE");
  }).join("");
}

/**
 * Die Schreibweise für die Anzeige. Nur bei Einheitsschrift (alles klein oder
 * alles groß) wird korrigiert — gemischte Schreibweise gehört dem Menschen.
 */
export function schreibweiseFuerAnzeige(roh: string | null | undefined, teil: "vorname" | "nachname" = "vorname"): string | null {
  const s = String(roh ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const buchstaben = Array.from(s).filter((z) => BUCHSTABE.test(z));
  if (!buchstaben.length) return s;
  const alleKlein = buchstaben.every((z) => z === z.toLocaleLowerCase("de-DE") && z !== z.toLocaleUpperCase("de-DE"));
  const alleGross = buchstaben.every((z) => z === z.toLocaleUpperCase("de-DE") && z !== z.toLocaleLowerCase("de-DE"));
  if (!alleKlein && !alleGross) return s;
  const woerter = s.split(" ");
  return woerter.map((w, i) => {
    const klein = w.toLocaleLowerCase("de-DE");
    // Im Nachnamen bleibt der Zusatz auch vorne klein („von der Heide"), solange
    // noch ein Wort folgt — im Vornamen erst ab dem zweiten Wort.
    const zusatzErlaubt = teil === "nachname" ? i < woerter.length - 1 : i > 0;
    if (zusatzErlaubt && ZUSATZ_KLEIN.has(klein)) return klein;
    if (TITEL.has(klein)) return klein === "dr" || klein === "dr." ? "Dr." : klein.startsWith("prof") ? "Prof." : grossAnfang(w);
    return grossAnfang(w);
  }).join(" ");
}

/**
 * Taugt dieser Teil als Name in einer Anrede?
 *
 * Nein bei: Ziffern oder @ im ROHWERT (eine Telefonnummer oder Mail im
 * Namensfeld), weniger als zwei Buchstaben, bekannten Füllwörtern („test",
 * „keine"), und einer Buchstabenreihe aus nur einem Zeichen („aaaa").
 */
export function nameBrauchbar(roh: string | null | undefined): boolean {
  const s = String(roh ?? "").trim();
  if (!s) return false;
  if (/[0-9@]/.test(s)) return false;
  const sauber = ohneSymbole(s).replace(/[.]/g, "").trim();
  const buchstaben = Array.from(sauber).filter((z) => BUCHSTABE.test(z));
  if (buchstaben.length < 2) return false;
  const klein = sauber.toLocaleLowerCase("de-DE");
  if (MUELL.has(klein)) return false;
  if (new Set(buchstaben.map((z) => z.toLocaleLowerCase("de-DE"))).size === 1) return false;
  return true;
}

/** Führende Titel vom Vornamen trennen: „Dr. Maria" → { titel: „Dr.", rest: „Maria" }. */
function titelAbtrennen(vorname: string): { titel: string | null; rest: string } {
  const woerter = vorname.split(" ").filter(Boolean);
  const titel: string[] = [];
  while (woerter.length && TITEL.has(woerter[0].toLocaleLowerCase("de-DE"))) titel.push(woerter.shift()!);
  return { titel: titel.length ? titel.join(" ") : null, rest: woerter.join(" ") };
}

function anredeNormal(a: string | null | undefined): "herr" | "frau" | null {
  const s = String(a ?? "").trim().toLocaleLowerCase("de-DE");
  if (s === "herr" || s === "hr" || s === "hr." || s === "mr" || s === "mr.") return "herr";
  if (s === "frau" || s === "fr" || s === "fr." || s === "mrs" || s === "mrs." || s === "ms" || s === "ms.") return "frau";
  return null;
}

/** Der Name, wie er in einer Anrede stehen darf — aus EINER Funktion für alle Kanäle. */
export function nameFuerAnrede(e: AnredeEin): NameFuerAnrede {
  const vRoh = String(e.vorname ?? "").trim();
  const nRoh = String(e.nachname ?? "").trim();
  const vAnzeige = nameBrauchbar(vRoh) ? schreibweiseFuerAnzeige(ohneSymbole(vRoh)) : null;
  const nAnzeige = nameBrauchbar(nRoh) ? schreibweiseFuerAnzeige(ohneSymbole(nRoh), "nachname") : null;
  let titel: string | null = null;
  let vorname: string | null = vAnzeige;
  if (vAnzeige) {
    const t = titelAbtrennen(vAnzeige);
    titel = t.titel;
    vorname = t.rest && nameBrauchbar(t.rest) ? t.rest : null;
  }
  const voll = vorname
    ? [titel, vorname, nAnzeige].filter(Boolean).join(" ")
    : null;
  return { vorname, nachname: nAnzeige, titel, voll, anrede: anredeNormal(e.anrede) };
}

function anredeMit(gruss: "Guten Tag" | "Hallo", e: AnredeEin): string {
  const n = nameFuerAnrede(e);
  if (n.anrede && n.nachname) {
    return `${gruss} ${n.anrede === "frau" ? "Frau" : "Herr"} ${n.titel ? `${n.titel} ` : ""}${n.nachname},`;
  }
  if (n.voll) return `${gruss} ${n.voll},`;
  return `${gruss},`;
}

/** Anrede für E-Mails: „Guten Tag Maria Muster," — die Grußzeile steht allein in der ersten Zeile. */
export function anredeMail(e: AnredeEin): string {
  return anredeMit("Guten Tag", e);
}

/** Anrede für WhatsApp und SMS: „Hallo Maria Muster," (Justin 21.09.: menschlicher, kein „Hi"). */
export function anredeChat(e: AnredeEin): string {
  return anredeMit("Hallo", e);
}

/** Nur der Vorname für eine Betreffzeile — oder null (dann ohne Namen). */
export function vornameFuerBetreff(e: AnredeEin): string | null {
  return nameFuerAnrede(e).vorname;
}
