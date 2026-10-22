// ═══════════════════════════════════════════════════════════════════════════
// PRÜF-MARA — DIE REINEN REGELN (E-409, 19.10.2026)
//
// Justin (fiaon-mara-endziel): Qualitätskontrolle von Maras Arbeit macht eine
// zweite KI automatisch; nur Auffälliges kommt als Karte zu ihm. Keine
// Mitarbeiter-Pflicht. Hier stehen die HARTEN Regeln ohne KI — dieselbe
// Wortwand, derselbe Ton wie beim Schreiben (shared/fiaon-wortverbote.ts,
// shared/fiaon-mara-ton.ts) — plus die Telefon-Regeln des Vertrags (§ 11):
// KI-Hinweis in den ersten 20 s, Anliegen erst nach Identitätsbestätigung,
// Aufnahme erst nach dem Ja, kein „Lastschrift“, kein Druck (KI-VO Art. 5
// Abs. 1 lit. b — wirtschaftliche Lage), keine Vertrags-Zusage per Stimme.
//
// Alles hier ist rein (kein Netz, keine Datenbank) und in
// scripts/pruef-ki-pruefung.ts geprüft. Der Server (server/lib/fiaon-ki-pruefung.ts)
// ruft `harteRegeln`, fragt danach das Modell und bildet mit `urteilBilden` das Urteil.
//
// E-409 Nachbesserung (20.10.2026, Prüfer-Funde 7 + 8):
//   · Am Telefon gelten die Textregeln NUR für das, was Aras sagt (arasText) — „Sonst gehe ich zum Anwalt“
//     aus dem Mund des Kunden ist kein Fehler von Aras. Eine Zusammenfassung ist kein Wortlaut: ohne Transkript
//     gibt der Server keinen Text in die Textregeln (nur die Zeiten und Teams 1 Live-Befund).
//   · „Anliegen erst nach Identität“ liest das GANZE Gespräch: Bestätigt ist erst ein Ja des Kunden NACH der
//     Identitätsfrage. Beginnt das Transkript erst mitten im Gespräch (z. B. ab dem Aufnahme-Ja), fehlt der Anfang —
//     dann prüft die Regel nichts, statt fast jeden Anruf zum „Fehler“ zu machen.
//   · telefonRegeln = Teams 1 Form (shared/fiaon-aras-regeln.ts, ohne Ton-Prüfung) — damit die Datei dort zur
//     reinen Weiterleitung werden kann (ihr Kopf sagt das so). Mit Teams 1 Ergänzungen: Druck in umgekehrter
//     Reihenfolge, „€“ als Anliegen.
//
// E-409 Kalibrierung (22.10.2026, nach den ersten zwei Live-Tagen von ARAS): Die Stufen-Ampel stand zweimal auf Rot —
// fast nur wegen Fehlalarmen gegen Justins ausdrückliche Vorgaben. Jetzt gilt am Telefon:
//   · Identität: bestätigt ist sie, wenn der Kunde seinen Namen nennt (Nachname oder Vorname aus dem Briefing,
//     unscharf — die Spracherkennung schreibt Namen oft falsch) ODER klar „ja / am Apparat / bin ich / selber / genau“
//     auf eine Identitätsfrage sagt. Ein „Ja“ auf „habens an Moment?“ ist keine Bestätigung — auch nicht nach der
//     Begrüßung mit Namen. Kennt ARAS den Namen nicht, zählt seine Antwort auf „Mit wem spreche ich?“.
//   · Limit: das Wunschlimit wird verkauft (E-373). Hart ist nur eine echte Zusage („garantiert“, „sicher“, „fix“,
//     „bewilligt“, „genehmigt“, „bekommen Sie“) oder ein Limit (nicht Wunschlimit) als Tatsache („Ihr Limit beträgt …“).
//   · KI-Hinweis und Aufnahme entscheiden allein die Zeitstempel; Wienerisch, Lachen und „Geht sich des heute noch aus?“
//     sind nie ein Punkt — Modell-Punkte dazu verwirft modellPunkteTelefon.
//   · „fehler“ heißt am Telefon: ein harter Punkt mit Bestand (punktMitBestand) — nur der zählt in der Stufen-Ampel.
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen, kopplungFinden, drohungFinden } from "./fiaon-wortverbote";
import { tonPruefung, limitPruefen, type MaraKanal } from "./fiaon-mara-ton";
import type { MitarbeiterEintrag } from "./fiaon-mitarbeiter-name";
import type { PruefPunkt } from "./fiaon-ki-team";

export type PruefKanal = "telefon" | "mail" | "whatsapp";
export type PruefUrteil = "ok" | "auffaellig" | "fehler";

/**
 * Der Regelstand dieser Fassung (E-409 Kalibrierung, 22.10.2026) — steht an jeder neuen Prüfzeile (fiaon_ki_pruefung.
 * regel_stand) und an jedem Live-Befund (fiaon_aras_anruf.pruefung.stand). Was ihn nicht trägt, entstand mit den alten Regeln.
 */
export const PRUEF_REGEL_STAND = "e409-2210";

/** Eine Transkriptzeile (fiaon_aras_anruf.transkript bzw. Live-Zeilen). */
export interface TranskriptZeile { t?: number; wer: "kunde" | "aras"; text: string }

/**
 * Wen ARAS anrufen wollte (Briefing, sonst Akte) — nur für den Abgleich der Identität. Der Name steht nie in einem
 * Punkt, einem Hinweis oder einem Log.
 */
export interface ErwarteterKunde { nachname?: string | null; vorname?: string | null; anrede?: string | null }

export interface PruefKontext {
  kanal: PruefKanal;
  land?: "DE" | "AT" | "CH" | null;
  mitarbeiter?: readonly MitarbeiterEintrag[] | null;
  kundeNamen?: readonly (string | null | undefined)[];
  /** Telefon: Zeiten in Sekunden seit Abheben (null = unbekannt). */
  telefon?: {
    kiHinweisSek?: number | null;
    aufnahmeJaSek?: number | null;
    aufnahmeGestartetSek?: number | null;
    aufnahmeNeinSek?: number | null;
    /** Twilio meldete „Maschine“, obwohl der Kunde sprach. */
    amdWiderspruch?: boolean;
    /** Der Kunde sagte „nicht mehr anrufen“, und die Sperre fehlt. */
    sperrwunschOhneSperre?: boolean;
    transkript?: TranskriptZeile[] | null;
    /** E-409 Kalibrierung: der erwartete Kunde (Briefing) — für „Identität vor Anliegen“. */
    kunde?: ErwarteterKunde | null;
  } | null;
}

// ── Druck (KI-VO Art. 5 Abs. 1 lit. b): Zeitfallen, Drohkulisse, Ausnutzen der Lage ──
const DRUCK_MUSTER: { re: RegExp; hinweis: string }[] = [
  { re: /\b(?:nur|bloß|bloss)\s+(?:noch\s+)?heute\b|\bnur\s+(?:noch\s+)?bis\s+(?:heute|morgen|mitternacht)\b|\bheute\s+ist\s+(?:die|ihre)\s+letzte\b/i, hinweis: "Zeitfalle („nur heute“) — verboten (KI-VO Art. 5)." },
  { re: /\bletzte\s+(?:chance|gelegenheit|möglichkeit|moeglichkeit)\b/i, hinweis: "„Letzte Chance“ ist Druck — verboten." },
  { re: /\b(?:sonst|andernfalls|ansonsten)\b[^.!?\n]{0,80}\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs)/i, hinweis: "Drohkulisse („sonst Gericht/SCHUFA/Inkasso“) — verboten." },
  { re: /\b(?:wenn|falls)\s+sie\s+(?:nicht|jetzt\s+nicht)\b[^.!?\n]{0,80}\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs|teurer|verlieren)/i, hinweis: "Bedingte Drohung („wenn Sie nicht … dann …“) — verboten." },
  // Umgekehrte Reihenfolge („… kommt das Gericht, wenn Sie nicht zahlen“) — dieselbe Drohung (aus Teams 1 Fassung, E-408).
  { re: /\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs)[^.!?\n]{0,80}\b(?:wenn|falls)\s+sie\s+(?:nicht|jetzt\s+nicht)\b/i, hinweis: "Bedingte Drohung („… Gericht, wenn Sie nicht …“) — verboten." },
  { re: /\bsie\s+haben\b[^.!?\n]{0,24}\b(?:keine|kein)\s+(?:andere\s+)?(?:wahl|möglichkeit|moeglichkeit|alternative)\b/i, hinweis: "Ausnutzen der Lage („keine andere Wahl“) — verboten." },
  { re: /\bjetzt\s+oder\s+nie\b|\bsofort\s+entscheiden\b|\b(?:das\s+angebot|der\s+preis)\s+gilt\s+nur\s+(?:jetzt|heute|solange)\b/i, hinweis: "Entscheidungsdruck — verboten." },
];
/** Der erste Druck-Treffer (Hinweis) oder null. Rein. */
export function druckFinden(text: string): string | null {
  const t = String(text ?? "");
  for (const m of DRUCK_MUSTER) if (m.re.test(t)) return m.hinweis;
  return null;
}

/** „Lastschrift“ ist ausgeschlossen (Justin 19.10.: der Kunde überweist aktiv und selbst) — außer im Verbotssatz. */
export function lastschriftFinden(text: string): string | null {
  const t = String(text ?? "");
  const m = /\b(?:lastschrift|sepa-?mandat|einzugsermächtigung|einzugsermaechtigung|abbuchen|abbuchung|einziehen)\b/i.exec(t);
  if (!m) return null;
  const satz = t.slice(Math.max(0, t.lastIndexOf(".", m.index) + 1), t.indexOf(".", m.index) === -1 ? t.length : t.indexOf(".", m.index) + 1);
  if (/\b(?:kein|keine|nicht|nie|ausgeschlossen|gibt es nicht|bieten wir nicht)\b/i.test(satz)) return null;
  return m[0];
}

/** Vertrag per Stimme/Text „geschlossen“ — verboten: der Kunde unterschreibt selbst (E-329, § 9 Abs. 2 FAGG). */
export function vertragZusageFinden(text: string): string | null {
  const m = /\b(?:dann\s+sind\s+wir\s+(?:uns\s+)?einig|(?:der\s+)?vertrag\s+(?:ist\s+)?(?:hiermit\s+)?(?:abgeschlossen|zustande\s+gekommen|geschlossen)|(?:das|es)\s+gilt\s+als\s+(?:abgeschlossen|vereinbart)|ich\s+(?:buche|schließe|schliesse)\s+(?:das|den\s+vertrag)\s+(?:jetzt\s+)?(?:für\s+sie\s+)?ab)\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}

/** Nennt die Zeile das Anliegen (Rate, Antrag, Paket, Betrag)? Vor der Identitätsbestätigung verboten (Dritte am Telefon). */
export function anliegenGenannt(text: string): boolean {
  return /\b(?:rate|raten|antrag|paket|limit|überweis|ueberweis|zahlung|euro|verwendungszweck)\b|€/i.test(String(text ?? ""));
}

// ── Wer spricht? (E-409 Fund 7) ────────────────────────────────────────────
/**
 * Nur was ARAS sagt: aus „ARAS: … / KUNDE: …“ bleiben die Aras-Zeilen (ohne Marke), Kundenzeilen fallen weg; eine
 * Zeile ohne Marke gehört zum Sprecher davor (ohne jede Marke: alles Aras — so gibt Teams 1 Live-Prüfung ihn schon). Rein.
 */
export function arasText(text: string): string {
  let wer: "aras" | "kunde" = "aras";
  const aus: string[] = [];
  for (const zeile of String(text ?? "").split("\n")) {
    const m = /^\s*(ARAS|KUNDE)\s*:\s?/i.exec(zeile);
    if (m) wer = m[1].toUpperCase() === "KUNDE" ? "kunde" : "aras";
    if (wer === "aras") aus.push(m ? zeile.slice(m[0].length) : zeile);
  }
  return aus.join("\n");
}

/** Das Transkript als Text mit Sprecher-Marken (eine Zeile je Beitrag) — für das Modell und den Karten-Ausschnitt. Rein. */
export function transkriptText(zeilen: readonly TranskriptZeile[] | null | undefined): string {
  return (zeilen ?? []).filter((z) => String(z.text ?? "").trim()).map((z) => `${z.wer === "kunde" ? "KUNDE" : "ARAS"}: ${String(z.text).replace(/\s+/g, " ").trim()}`).join("\n");
}

// ── Identität vor Anliegen (E-409 Fund 8; kalibriert 22.10.2026) ───────────
const KI_HINWEIS_RE = /\b(?:ki|künstliche intelligenz|kuenstliche intelligenz|digitale[rn]?\s+assistent)\b/i;
/** Ein Name nach „Herr/Frau“ — jede Schrift („Yıldıztest“, „Ćorićmuster“), mit Doppelnamen und Titel („Frau Dr. …“). */
const NAME_NACH_ANREDE = String.raw`(?:herrn?|frau)\s+(?:(?:dr|mag|ing|di|prof)\.?\s+)*\p{L}[\p{L}'’-]*(?:\s+\p{L}[\p{L}'’-]*)?`;
/**
 * OFFENE Identitätsfrage — die Antwort ist ein Name („Mit wem spreche ich, bitte?“, Wien ultra: „mit wem sprech i?“).
 * Ein bloßes „Ja?“ darauf bestätigt nichts.
 */
const IDENT_OFFEN = new RegExp([
  String.raw`\bmit\s+wem\s+(?:spreche?|sprech|red(?:e)?|telefonier(?:e)?)\s+(?:ich|i)\b`,
  String.raw`\bmit\s+wem\s+(?:hab(?:e)?|hätte|haette)\s+(?:ich|i)\s+(?:das\s+vergnügen|das\s+vergnuegen|die\s+ehre|es\s+zu\s+tun)\b`,
  String.raw`\bwer\s+(?:ist|is)\s+(?:da\s+)?(?:dran|am\s+apparat|am\s+telefon)\b`,
  String.raw`\bwie\s+(?:ist|war|is)\s+(?:ihr|der)\s+name\b`,
  String.raw`\b(?:bestätigen|bestaetigen|bestätige|bestaetige|sagen|nennen|verraten)\s+(?:sie\s+)?(?:mir\s+)?(?:(?:bitte|kurz|noch|einmal|mal)\s+)*ihr(?:en)?\s+(?:vollen\s+)?(?:namen|geburtsdatum)\b`,
].join("|"), "iu");
/** GESCHLOSSENE Identitätsfrage — „Spreche ich mit Herrn …?“, „Bin ich richtig bei …?“, „Sind Sie Frau …?“, „Herr …?“. */
const IDENT_GESCHLOSSEN = new RegExp([
  String.raw`\b(?:spreche?|sprech)\s+(?:ich|i)\s+(?:da\s+|hier\s+|gerade\s+|direkt\s+|jetzt\s+)?(?:mit|mim|bei)\b`,
  String.raw`\bred(?:e)?\s+(?:ich|i)\s+(?:da\s+)?mit\b`,
  String.raw`\b(?:bin|wäre|waere)\s+(?:ich|i)\s+(?:da\s+|hier\s+)?richtig\s+bei\b`,
  String.raw`\b(?:sind|san)\s+(?:sie|s)\s+(?:selbst|selber|persönlich|persoenlich|(?:der|die)\s+(?:herr|frau)|herr|frau)\b`,
  String.raw`\bhab(?:e)?\s+(?:ich|i)\s+(?:da\s+)?(?:den\s+|die\s+)?(?:herrn?|frau)\b`,
  String.raw`\b(?:ist|is|wäre|waere)\s+(?:das\s+)?(?:der\s+|die\s+)?${NAME_NACH_ANREDE}\s*(?:zu\s+sprechen|da|am\s+apparat|erreichbar|selbst|selber)\b`,
  String.raw`\b(?:darf|kann|könnte|koennte)\s+(?:ich|i)\s+(?:kurz\s+|bitte\s+)?mit\s+(?:herrn?|frau)\b`,
  String.raw`\b(?:möchte|moechte|würde|wuerde)\s+(?:gerne?\s+)?(?:mit\s+)?${NAME_NACH_ANREDE}\s+sprechen\b`,
  String.raw`^\s*(?:(?:ah|oh|ja|so|okay|ok|mhm|hallo)\s*,?\s*)*${NAME_NACH_ANREDE}\s*\?\s*$`,
].join("|"), "iu");
/**
 * Die Begrüßung mit Namen („Grüß Sie, Herr Huber!“) — E-408 (Justin 20.10., Anruf 16): das ist zugleich die Frage, ob er es
 * ist. Sie zählt aber nur, solange danach keine ANDERE Frage kommt: Auf „… habens an Moment?“ beantwortet sein „Ja“ den
 * Moment, nicht die Identität (E-409 Kalibrierung, 22.10.2026).
 */
const GRUSS_MIT_NAME = new RegExp(String.raw`^\s*(?:(?:ah|oh|ja|so|okay|ok|mhm)\s*,?\s*)*(?:(?:ich\s+)?(?:grüße|gruesse|grüß|gruess)\s+(?:gott|sie|ihnen|di|dich)|griaß\s+(?:gott|di|eana|ihna)|grüezi|gruezi|guten\s+(?:tag|morgen|abend)|hallo|hi|servus)\s*,?\s+${NAME_NACH_ANREDE}\s*[!?.,]`, "iu");
/** Irgendeine Identitätsfrage (offen, geschlossen oder die Begrüßung mit Namen) — Wort für Wort wie bisher exportiert. */
const IDENTITAET_FRAGE = { test: (t: string) => saetze(t).some((s) => IDENT_OFFEN.test(s) || IDENT_GESCHLOSSEN.test(s) || GRUSS_MIT_NAME.test(s)) };
/** Klar „ja“ — nur als Antwort auf eine geschlossene Identitätsfrage (Füllwörter davor zählen nicht). */
const JA_KLAR = /^\s*(?:(?:mm+|mhm+|hm+|äh+m*|ähm|öhm|ah|oh|ach|also|na|so)\s*[,.!]?\s*)*(?:ja(?:wohl|a+)?|jo|jep|jap|jup|genau|richtig|korrekt|stimmt|exakt|freilich|natürlich|natuerlich|selbstverständlich|selbstverstaendlich|sicher|klar|yes)\b/i;
/** Eindeutig ER selbst — gilt nach jeder Frage („Ja, am Apparat“, „Bin ich“, „Ich bin's“, „Selber.“). */
const SELBST = /\bam\s+apparat\b|\b(?:das|des)\s+bin\s+(?:ich|i)\b|\b(?:ich|i)\s+bin(?:'s|’s|s|\s+es|\s+das)\b|(?:^|[,.!]\s*|\bja\s*,?\s*)bin\s+(?:ich|i)(?:\s+(?:selbst|selber|persönlich|persoenlich))?\s*(?:[,.!]|$)|\bhöchstpersönlich\b|\bhoechstpersoenlich\b|^\s*(?:(?:ja|jo|genau)\s*,?\s*)?(?:selbst|selber|persönlich|persoenlich)\s*[,.!]?\s*$/i;
/** … oder „nein“ / „hier ist seine Frau“ / „er is ned da“ — dann ist NICHT bestätigt. */
const VERNEINT = /\bnö(?![a-zäöüß])|\b(?:nein|nee|falsch\s+verbunden|nicht\s+(?:da|zu\s+sprechen|zu\s*hause|daheim|erreichbar|im\s+haus|am\s+apparat)|(?:ist|is)\s+(?:grad\s+|gerade\s+|jetzt\s+|leider\s+)?(?:nicht|ned|net)\s+(?:da|hier|erreichbar|zu\s*hause|daheim|im\s+haus)|bin\s+(?:ich\s+|i\s+)?(?:nicht|ned|net)|(?:ich|i)\s+bin(?:'s|’s|s|\s+es|\s+das)\s+(?:nicht|ned|net)|(?:seine|ihre|mein(?:e)?|mei)\s+(?:frau|mann|ehefrau|ehemann|gattin|gatte|tochter|sohn|mutter|vater|mama|papa|partnerin|partner|schwester|bruder|freundin|freund|oma|opa|kollegin|kollege)|(?:ich|i)\s+bin\s+(?:die|der|seine|ihre)\s+(?:frau|mann|tochter|sohn|mutter|vater|partnerin|partner|schwester|bruder|freundin|freund|kollegin|kollege))\b/i;
const ANFANG_ARAS = /\bhier\s+ist\b|\bvon\s+fiaon\b|\bmein\s+name\s+ist\b/i;
const ANFANG_KUNDE = /^\s*(?:hallo\b|ja,?\s*hallo\b|guten\s+(?:tag|morgen|abend)\b|moin\b|servus\b|grüß\s+gott\b|gruess\s+gott\b|wer\s+ist\s+da\b|ja\s*\?\s*$)/i;
/** Ein Gruß ohne Inhalt („Hallo?“, „Ja, hallo, schönen Tag“, „Grüß Gott“) — keine Antwort auf „Mit wem spreche ich?“. */
const GRUSS_WOERTER = new Set(["hallo", "ja", "jo", "jaja", "grüß", "gruess", "gruß", "gott", "sie", "servus", "guten", "tag", "morgen", "abend", "schönen", "schoenen",
  "hi", "moin", "griaß", "griass", "di", "bitte", "ähm", "äh", "mhm", "hm", "okay", "ok", "so", "na", "grüezi", "gruezi", "moment"]);
const WORT_TRENNER = new RegExp(String.raw`[^\p{L}'’]+`, "u");
const HAT_WORT = new RegExp(String.raw`\p{L}{2}`, "u");
const nurGruss = (t: string) => { const w = String(t ?? "").toLowerCase().split(WORT_TRENNER).filter(Boolean); return !w.length || w.every((x) => GRUSS_WOERTER.has(x)); };
/** Eine Frage des Kunden („Wer spricht?“, „Was wollen Sie?“). */
const FRAGESATZ = /\?\s*$|^\s*(?:(?:ja|äh|ähm|und|aber|also)\s*,?\s*)*(?:wer|was|wie|wo|wann|warum|wieso|weshalb|welche[rsnm]?|woher|wohin|worum)\b/i;

/** Sätze eines Beitrags (am Satzzeichen, am Gedankenstrich und am Zeilenende getrennt). Rein. */
function saetze(text: string): string[] {
  return String(text ?? "").split(/(?<=[.!?…])\s+|\s+[—–]\s*|[—–]\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}
/** Welche Frage stellt ARAS in diesem Beitrag ZULETZT? offen / geschlossen (auch die Begrüßung mit Namen) / andere / keine. */
function letzteFrage(text: string): "offen" | "geschlossen" | "andere" | null {
  let art: "offen" | "geschlossen" | "andere" | null = null;
  for (const s of saetze(text)) {
    if (IDENT_OFFEN.test(s)) art = "offen";
    else if (IDENT_GESCHLOSSEN.test(s) || GRUSS_MIT_NAME.test(s)) art = "geschlossen";
    else if (/\?\s*$/.test(s)) art = "andere";
  }
  return art;
}

export function identitaetGefragt(text: string): boolean { return IDENTITAET_FRAGE.test(String(text ?? "")); }
/** „Ja, am Apparat“ — klar ja, nicht verneint. Ob es zählt, hängt an der Frage davor (anliegenVorIdentitaet). Rein. */
export function identitaetBestaetigt(text: string): boolean { const t = String(text ?? ""); return (JA_KLAR.test(t) || SELBST.test(t)) && !VERNEINT.test(t); }

// ── Der Name als Bestätigung (E-409 Kalibrierung, 22.10.2026) ──────────────
/** Klein, Umlaute ausgeschrieben, ohne Akzente, nur Buchstaben — und die häufigsten Schreib-Varianten der Spracherkennung. */
function namensLaut(s: string): string {
  return String(s ?? "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/ł/g, "l").replace(/ø/g, "o")
    .replace(/[^a-z]+/g, "")
    .replace(/ph/g, "f").replace(/th/g, "t").replace(/ck/g, "k").replace(/dt/g, "t").replace(/tz/g, "z")
    .replace(/[ae]y|ai/g, "ei").replace(/y/g, "i").replace(/ie/g, "i").replace(/(.)\1+/g, "$1");
}
/** Wort-Abstand (Levenshtein), früh abgebrochen ab `max` + 1. Rein. */
function abstand(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let vor = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const jetzt = [i];
    let klein = i;
    for (let j = 1; j <= b.length; j++) { jetzt[j] = Math.min(vor[j] + 1, jetzt[j - 1] + 1, vor[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); klein = Math.min(klein, jetzt[j]); }
    if (klein > max) return max + 1;
    vor = jetzt;
  }
  return vor[b.length];
}
/** Namensteile ohne Vorsilben („von“, „van der“, „de“) und ohne zu kurze Teile. */
const NAMENS_VORSILBE = new Set(["von", "van", "vom", "zu", "de", "der", "den", "di", "da", "del", "la", "le", "dos", "das", "el", "al", "bin", "ibn", "ten", "ter"]);
function namensTeile(name: string | null | undefined, minLaenge: number): string[] {
  return String(name ?? "").split(/[\s\-–,.]+/).filter((t) => t && !NAMENS_VORSILBE.has(t.toLowerCase())).map(namensLaut).filter((t) => t.length >= minLaenge);
}
/** Wie viel Abweichung ein Name verträgt: kurz nichts, mittel einen Buchstaben, lang zwei. */
const toleranz = (n: string) => (n.length >= 7 ? 2 : n.length >= 4 ? 1 : 0);
/** Wörter, an die die Spracherkennung den Namen klebt („Mitmusterhuba“ = „Mit Musterhuber“). */
const KLEBE_VORSILBE = ["mit", "hier", "ja", "jo", "da", "ist", "is", "bin", "frau", "herr", "herrn"];

/**
 * Nennt dieser Kundenbeitrag den erwarteten Namen (Nachname oder Vorname aus dem Briefing)? Unscharf — Schreibfehler und
 * Dialekt der Erkennung — nur, wenn der Beitrag auf eine Identitätsfrage antwortet (`unscharf`); sonst nur genau.
 * Nicht in einer Frage nach jemand anderem („Herr Huber? Wer will das wissen?“), nicht bei falscher Anrede („Frau …“,
 * wenn ein Herr erwartet wird). Rein; der Name verlässt die Funktion nie.
 */
function nameGenannt(text: string, kunde: ErwarteterKunde, unscharf: boolean): boolean {
  // Vornamen strenger als Nachnamen: kurze Vornamen sind oft Alltagswörter („Ernst“, „Rosa“) — erst ab 6 Buchstaben einer daneben.
  const namen = [
    ...namensTeile(kunde.nachname, 3).map((n) => ({ n, tol: toleranz(n) })),
    ...namensTeile(kunde.vorname, 3).map((n) => ({ n, tol: n.length >= 6 ? 1 : 0 })),
  ];
  if (!namen.length) return false;
  const anrede = /^h/i.test(String(kunde.anrede ?? "")) ? "herr" : /^f/i.test(String(kunde.anrede ?? "")) ? "frau" : null;
  for (const satz of saetze(text)) {
    const woerter = satz.split(WORT_TRENNER).filter(Boolean);
    const laute = woerter.map(namensLaut);
    const frage = FRAGESATZ.test(satz);
    for (let i = 0; i < laute.length; i++) {
      const kandidaten = [laute[i]];
      if (i + 1 < laute.length) kandidaten.push(laute[i] + laute[i + 1]);
      for (const v of KLEBE_VORSILBE) if (laute[i].startsWith(v) && laute[i].length - v.length >= 3) kandidaten.push(laute[i].slice(v.length));
      const treffer = namen.some(({ n, tol }) => kandidaten.some((k) => (unscharf ? abstand(k, n, tol) <= tol : k === n)));
      if (!treffer) continue;
      const davor = String(woerter[i - 1] ?? "").toLowerCase();
      const mitAnrede = /^(?:herrn?|frau|hr|fr)$/.test(davor);
      // „Herr Huber? …“ fragt nach jemandem; „Frau Huber“, wenn Herr Huber erwartet wird, ist jemand anderes.
      if (mitAnrede && frage) continue;
      if (mitAnrede && anrede && !davor.startsWith(anrede === "herr" ? "h" : "f")) continue;
      return true;
    }
  }
  return false;
}

/**
 * Bestätigt dieser Kundenbeitrag, dass er selbst dran ist? `frage` = die letzte Identitätsfrage von ARAS davor.
 *   · sein Name (Nachname oder Vorname, unscharf nach einer Identitätsfrage) — „Mit Max Huber“, „Huber, Max“;
 *   · „am Apparat“, „bin ich“, „ich bin's“, „selber“ — nach jeder Frage;
 *   · ein klares „Ja“ / „Genau“ nur auf eine GESCHLOSSENE Identitätsfrage (nicht auf „habens an Moment?“);
 *   · kennt ARAS den Namen nicht: seine Antwort auf die offene Frage („Mit wem spreche ich?“), wenn sie kein Gruß und keine
 *     Gegenfrage ist.
 * Nie, wenn er verneint oder jemand anderes ist („Nein, hier ist seine Frau“). Rein.
 */
function bestaetigtIm(text: string, frage: "offen" | "geschlossen" | "andere" | null, kunde: ErwarteterKunde | null | undefined): boolean {
  const t = String(text ?? "");
  if (!t.trim() || VERNEINT.test(t)) return false;
  const nameBekannt = !!(namensTeile(kunde?.nachname, 3).length || namensTeile(kunde?.vorname, 3).length);
  if (nameBekannt && nameGenannt(t, kunde!, frage === "offen" || frage === "geschlossen")) return true;
  if (saetze(t).some((s) => SELBST.test(s) && !FRAGESATZ.test(s))) return true;
  if (frage === "geschlossen" && JA_KLAR.test(t)) return true;
  if (frage === "offen" && !nameBekannt && !nurGruss(t) && !saetze(t).every((s) => FRAGESATZ.test(s)) && HAT_WORT.test(t)) return true;
  return false;
}

/** Aufeinanderfolgende Zeilen desselben Sprechers als EIN Beitrag (die Erkennung zerlegt Sätze: „mit wem“ / „spreche ich bitte?“). */
function beitraege(zeilen: readonly TranskriptZeile[]): { wer: "kunde" | "aras"; text: string; zeilen: TranskriptZeile[] }[] {
  const aus: { wer: "kunde" | "aras"; text: string; zeilen: TranskriptZeile[] }[] = [];
  for (const z of zeilen) {
    const text = String(z.text ?? "").trim();
    if (!text) continue;
    const letzter = aus[aus.length - 1];
    if (letzter && letzter.wer === z.wer) { letzter.text = `${letzter.text} ${text}`; letzter.zeilen.push(z); }
    else aus.push({ wer: z.wer, text, zeilen: [z] });
  }
  return aus;
}

/**
 * Steht der Anfang des Gesprächs im Transkript? Ja, wenn der Kunde mit dem Abheben beginnt („Hallo?“) oder eine der
 * ersten zwei Aras-Zeilen die Begrüßung mit Namen, den KI-Hinweis oder die Identitätsfrage trägt. Ein Transkript, das
 * erst ab dem Aufnahme-Ja läuft, beginnt mitten im Gespräch — darauf lassen sich Anfangs-Regeln nicht anwenden. Rein.
 */
export function gespraechsAnfang(zeilen: readonly TranskriptZeile[] | null | undefined): boolean {
  if (!zeilen?.length) return false;
  if (zeilen[0].wer === "kunde" && ANFANG_KUNDE.test(zeilen[0].text)) return true;
  return zeilen.filter((z) => z.wer === "aras").slice(0, 2).some((z) => ANFANG_ARAS.test(z.text) || KI_HINWEIS_RE.test(z.text) || IDENTITAET_FRAGE.test(z.text));
}

/**
 * Die erste Aras-Zeile, die das Anliegen (Rate, Antrag, Paket, Betrag) nennt, BEVOR der Kunde bestätigt hat, dass er
 * selbst dran ist (bestaetigtIm) — über das ganze Gespräch, Beitrag für Beitrag. `kunde` = der erwartete Kunde aus dem
 * Briefing (ohne: Name unbekannt). Ohne den Gesprächsanfang im Transkript: null (nicht prüfbar). Rein.
 */
export function anliegenVorIdentitaet(zeilen: readonly TranskriptZeile[] | null | undefined, kunde?: ErwarteterKunde | null): string | null {
  if (!zeilen?.length || !gespraechsAnfang(zeilen)) return null;
  let frage: "offen" | "geschlossen" | "andere" | null = null;
  for (const b of beitraege(zeilen)) {
    if (b.wer === "aras") {
      if (anliegenGenannt(b.text)) return String((b.zeilen.find((z) => anliegenGenannt(z.text)) ?? b.zeilen[0]).text).slice(0, 160);
      frage = letzteFrage(b.text) ?? frage;
    } else if (bestaetigtIm(b.text, frage, kunde)) {
      return null;
    }
  }
  return null;
}

/** Hat ARAS gesagt, dass er eine KI ist? (ENTWURF § 2: „digitale Assistent, also eine KI“) */
export function kiHinweisGesagt(zeilen: readonly TranskriptZeile[] | null | undefined): boolean {
  return (zeilen ?? []).some((z) => z.wer === "aras" && KI_HINWEIS_RE.test(z.text));
}

export const KI_HINWEIS_SPAETESTENS_SEK = 20;
/** Ton-Regeln, die nur beim Schreiben gelten (Anrede setzt der Server, Herr/Frau kommt aus der gespeicherten Anrede). */
const TON_NUR_BEIM_SCHREIBEN = new Set(["mail_anrede", "herr_frau"]);
type Push = (regel: string, schwere: "hart" | "weich", treffer: string, hinweis: string) => void;

// ── Limit am Telefon (E-373; kalibriert 22.10.2026) ────────────────────────
// Maras weiße Liste fürs Schreiben (limitPruefen) passt nicht auf gesprochene Sprache: Jeder Wunschlimit-Satz, der nicht
// wörtlich ein Mail-Baustein war („Sein Wunschlimit sind fünfundzwanzigtausend“, „… mit Ihrem Wunschlimit, damit Sie schnell
// loslegen können“), wurde hart. Justins Regel E-373: das Wunschlimit wird verkauft, nie ein Bank-Vorbehalt im Verkauf.
// Am Telefon ist darum nur hart: (1) eine Zusage zu Limit, Rahmen oder Betrag ab 1.000 („garantiert“, „sicher“, „fix“,
// „bewilligt“, „genehmigt“, „zugesagt“, „auf jeden Fall“, „bekommen/erhalten/kriegen Sie …“) und (2) ein Limit — nicht das
// WUNSCHlimit — als Tatsache („Ihr Limit beträgt fünftausend Euro“, Justins Korrektur 1). Verneint („kann ich ned fix
// sagen“, „nicht garantiert“) oder als „ob …“ ist es keine Zusage.
const T_LIMIT = /(?:kredit|verfügungs|verfuegungs|karten|wunsch-?)?(?:limit|rahmen)/i;
const T_IM_RAHMEN = /\bim\s+rahmen\s+(?:der|des|ihres|ihrer|unseres|unserer|eines|einer|dieses|dieser)\b/gi;
/** Ein Betrag ab 1.000 — gesprochen („fünfundzwanzigtausend“) oder mit Währung (ein Datum wie „01.11.2026“ ist keiner). */
const T_BETRAG_GROSS = /tausend|\b\d{1,3}(?:[.'’\u00A0\u202F ]\d{3})+\s*(?:€|euro|eur\b|chf|franken)|(?:€|\beur|\bchf)\s*\d{1,3}(?:[.'’\u00A0\u202F ]\d{3})+|\b\d{4,}\s*(?:€|euro|eur\b|chf|franken)|\b\d+\s*k\b|\btsd\b/i;
/** Zusagewörter — „fix“ nur als Zusage, nicht als „fix im Antrag/notiert“. */
const T_ZUSAGE = /\b(?:garantier\w*|garantie|gesichert|bewilligt|genehmigt|zugesagt|fix(?!\s+(?:im|in|drin|eingetragen|notiert|vermerkt|gespeichert|hinterlegt)\b)|hundertprozentig|definitiv|ganz\s+bestimmt|auf\s+jeden\s+fall|steht\s+(?:schon\s+)?fest|geht\s+(?:\S+\s+){0,2}?klar|sicher(?:lich)?)\b|\b100\s*(?:%|prozent)/gi;
const T_BEKOMMEN = /\b(?:bekommen|bekommens|bekommt|bekommst|kriegen|kriegens|kriegt|erhalten|erhaltens|erhält|erhaelt)\b/i;
const T_VERNEINT_DAVOR = /\b(?:nicht|ned|net|nit|kein\w*|nie(?:mals)?|ob)\b(?:\s+\S+){0,3}\s*$/i;
const T_TATSACHE = /\b(?:ihr|ihre|sein|seine|das|der|dein)\s+(?:neue[sr]?\s+)?(?:kredit|verfügungs|verfuegungs|karten)?(?:limit|rahmen)\s+(?:beträgt|betraegt|liegt\s+(?:bei|auf)|ist|is|sind|san|wäre|waere|wird)\b[^.!?]{0,30}?(?:tausend|\d[\d.'’\u00A0\u202F ]*\s*(?:€|euro|eur\b|chf|franken|k\b))/i;
/**
 * Die Limit-Befunde eines Telefon-Transkripts (nur was ARAS sagt) — dieselbe Form wie limitPruefen: zusage (hart), freigabe
 * (hart). „ohne_bank“ gibt es am Telefon nicht (E-373: kein Bank-Vorbehalt im Verkauf). Rein.
 */
export function limitTelefonPruefen(text: string): { art: "zusage" | "freigabe"; satz: string }[] {
  const funde: { art: "zusage" | "freigabe"; satz: string }[] = [];
  for (const roh of saetze(text)) {
    // „Sicher, …“ / „Ja sicher!“ am Satzanfang ist Zustimmung, keine Zusage; „im Rahmen des …“ ist kein Kreditrahmen.
    const s = roh.replace(T_IM_RAHMEN, " ").replace(/^\s*(?:(?:ja|na|aber)\s*,?\s*)?sicher\s*[,!.]\s*/i, "");
    if (!T_LIMIT.test(s) && !T_BETRAG_GROSS.test(s)) continue;
    // Jedes Zusagewort für sich: „Ob … sicher …“ ist keine Zusage, ein späteres „garantiert“ im selben Satz schon.
    const zusage = Array.from(s.matchAll(T_ZUSAGE)).some((z) => !T_VERNEINT_DAVOR.test(s.slice(0, z.index ?? 0)) && !/^\s*(?:nicht|ned|net|nit)\b/i.test(s.slice((z.index ?? 0) + z[0].length)));
    if (zusage) { funde.push({ art: "zusage", satz: roh.slice(0, 160) }); continue; }
    // „bekommen/erhalten Sie …“ höchstens vier Wörter neben dem Limit oder Betrag („Die 25.000 bekommen Sie“).
    const woerter = s.split(/\s+/);
    const iB = woerter.findIndex((w) => T_BEKOMMEN.test(w));
    if (iB >= 0 && !T_VERNEINT_DAVOR.test(woerter.slice(0, iB).join(" ")) && woerter.some((w, i) => Math.abs(i - iB) <= 4 && (T_LIMIT.test(w) || T_BETRAG_GROSS.test(w)))) {
      funde.push({ art: "zusage", satz: roh.slice(0, 160) }); continue;
    }
    if (T_TATSACHE.test(s)) funde.push({ art: "freigabe", satz: roh.slice(0, 160) });
  }
  return funde;
}

/** Die Wortregeln (Wand, Limit, Kopplung, Drohung, Druck, Lastschrift) — dieselben für Schrift und Telefon; das Limit am Telefon gesprochen (limitTelefonPruefen). */
function wortRegeln(t: string, push: Push, telefon = false): void {
  for (const w of wandPruefen(t)) push(`wand_${w.art}`, w.art === "floskel" ? "weich" : "hart", w.treffer, w.hinweis);
  for (const l of telefon ? limitTelefonPruefen(t) : limitPruefen(t)) push(`limit_${l.art}`, l.art === "ohne_bank" ? "weich" : "hart", l.satz, l.art === "zusage" ? "Limit zugesagt — nie ‚garantiert‘, nie ‚sicher‘." : l.art === "freigabe" ? (telefon ? "Limit als Tatsache genannt — sag „Ihr Wunschlimit“, nie „Ihr Limit beträgt …“." : "Freigabe versprochen — über den Rahmen entscheidet die Partnerbank.") : "Limit ohne Bank-Satz genannt.");
  const kopp = kopplungFinden(t); if (kopp) push("kopplung", "hart", kopp, "Kündigung an Zahlung gekoppelt (§ 312k BGB).");
  const droh = drohungFinden(t); if (droh) push("drohung", "hart", droh, "Drohung — nie Gericht, Inkasso, SCHUFA, Anwalt.");
  const druck = druckFinden(t); if (druck) push("druck", "hart", druck, druck);
  const ls = lastschriftFinden(t); if (ls) push("lastschrift", "hart", ls, "Lastschrift ist ausgeschlossen — der Kunde überweist selbst.");
}

/** Die Telefon-Pflichten aus Zeiten und Transkript (Vertrag § 11). */
function telefonPflichten(tel: NonNullable<PruefKontext["telefon"]> | null, push: Push): void {
  if (!tel) return;
  const zeilen = tel.transkript ?? null;
  if (tel.kiHinweisSek == null && zeilen?.length && !kiHinweisGesagt(zeilen)) {
    // E-409 Fund 8: Fehlt der Gesprächsanfang im Transkript (es läuft erst ab dem Aufnahme-Ja), ist der Hinweis dort
    // gar nicht zu sehen — dann kein „Regelverstoß“, nur ein weicher Punkt (der Zeitpunkt ki_hinweis_am fehlt).
    if (gespraechsAnfang(zeilen)) push("ki_hinweis_fehlt", "hart", "", "KI-Hinweis nicht gesagt (KI-VO Art. 50).");
    else push("ki_hinweis_unbelegt", "weich", "", "KI-Hinweis nicht belegbar: das Transkript beginnt mitten im Gespräch, der Zeitpunkt fehlt.");
  }
  if (tel.kiHinweisSek != null && tel.kiHinweisSek > KI_HINWEIS_SPAETESTENS_SEK) push("ki_hinweis_spaet", "hart", `${Math.round(tel.kiHinweisSek)} s`, `KI-Hinweis erst nach ${Math.round(tel.kiHinweisSek)} s (erlaubt: ${KI_HINWEIS_SPAETESTENS_SEK} s).`);
  // Ob vor dem Ja aufgenommen wurde, entscheiden allein die Zeitstempel — die FRAGE „Darf ich aufzeichnen?“ ist keine Aufnahme.
  if (tel.aufnahmeGestartetSek != null && (tel.aufnahmeJaSek == null || tel.aufnahmeGestartetSek < tel.aufnahmeJaSek)) push("aufnahme_vor_ja", "hart", "", "Aufnahme vor dem hörbaren Ja gestartet (§ 201 StGB).");
  // Nein, später doch Ja, und erst danach gestartet: keine Aufnahme „trotz Nein“ (E-409 Kalibrierung).
  if (tel.aufnahmeNeinSek != null && tel.aufnahmeGestartetSek != null && !(tel.aufnahmeJaSek != null && tel.aufnahmeJaSek > tel.aufnahmeNeinSek && tel.aufnahmeGestartetSek >= tel.aufnahmeJaSek)) push("aufnahme_trotz_nein", "hart", "", "Aufnahme trotz Nein gestartet.");
  if (tel.amdWiderspruch) push("amd_widerspruch", "weich", "", "Twilio meldete Maschine, obwohl der Kunde sprach — Gespräch lief weiter (Quote beobachten).");
  if (tel.sperrwunschOhneSperre) push("sperrwunsch_ohne_sperre", "hart", "", "Kunde will nicht mehr angerufen werden — Sperre fehlt.");
  const vorab = anliegenVorIdentitaet(zeilen, tel.kunde ?? null);
  if (vorab) push("anliegen_vor_identitaet", "hart", vorab, "Rate/Antrag genannt, bevor der Kunde bestätigt hat, dass er selbst dran ist (sein Name oder ein klares Ja auf die Identitätsfrage).");
}

function sammler(): { punkte: PruefPunkt[]; push: Push } {
  const punkte: PruefPunkt[] = [];
  return { punkte, push: (regel, schwere, treffer, hinweis) => { punkte.push({ regel, schwere, treffer: String(treffer ?? "").slice(0, 160), hinweis: String(hinweis ?? "").slice(0, 240) }); } };
}

/**
 * Alle harten Regeln auf einen Text (Mail, WhatsApp) oder ein Transkript (Telefon).
 * Telefon: die Wortregeln nur auf das, was ARAS sagt (arasText — Kundenzeilen fallen weg, E-409 Fund 7).
 * Rein. Jeder Punkt: regel (fester Schlüssel), schwere, treffer, hinweis.
 */
export function harteRegeln(text: string, k: PruefKontext): PruefPunkt[] {
  const { punkte, push } = sammler();
  const t = k.kanal === "telefon" ? arasText(text) : String(text ?? "");
  wortRegeln(t, push, k.kanal === "telefon");
  const kanal: MaraKanal = k.kanal === "mail" ? "mail" : "whatsapp";
  // Die Ton-Prüfung gilt GESCHRIEBENEN Texten (Länge, Ausrufezeichen, Anrede-Form). Ein Telefon-Transkript ist gesprochen —
  // dort sind 1.000+ Zeichen normal; den Ton am Telefon beurteilt das Modell (20.10.2026, erste Live-Läufe).
  for (const b of k.kanal === "telefon" ? [] : tonPruefung(t, { kanal, land: k.land ?? null, mitarbeiter: k.mitarbeiter ?? null, kundeNamen: k.kundeNamen })) {
    // Zwei Ton-Regeln gelten dem MODELLTEXT vor dem Versand (der Server setzt die Anrede selbst) — eine gesendete
    // Mail trägt sie zu Recht. Für die Prüfung des Gesendeten sind sie kein Befund.
    if (TON_NUR_BEIM_SCHREIBEN.has(b.id)) continue;
    push(`ton_${b.id}`, b.schwere === "hart" ? "hart" : "weich", b.treffer, b.hinweis);
  }
  if (k.kanal === "telefon") {
    const v = vertragZusageFinden(t); if (v) push("vertrag_zusage", "hart", v, "Vertrag nie per Stimme schließen — Link zum Unterschreiben.");
    telefonPflichten(k.telefon ?? null, push);
  }
  return punkte;
}

// ── Teams 1 Form (E-408, shared/fiaon-aras-regeln.ts) — damit die Datei dort zur Weiterleitung werden kann ──────────
export type RegelZeile = TranskriptZeile;
export type RegelPunkt = PruefPunkt;
export type TelefonLage = Omit<NonNullable<PruefKontext["telefon"]>, "amdWiderspruch">;
/**
 * Die harten Telefon-Regeln für Aras’ Live-Prüfung (ohne Ton-Prüfung, wie Teams 1 telefonRegeln): Wortregeln auf das,
 * was ARAS sagt, Vertrag per Stimme, und — mit `tel` — die Pflichten aus Zeiten und Transkript. Rein.
 */
export function telefonRegeln(text: string, tel: TelefonLage | null = null): PruefPunkt[] {
  const { punkte, push } = sammler();
  const t = arasText(text);
  wortRegeln(t, push, true);
  const v = vertragZusageFinden(t); if (v) push("vertrag_zusage", "hart", v, "Vertrag nie per Stimme schließen — Link zum Unterschreiben.");
  telefonPflichten(tel, push);
  return punkte;
}

/** Was ein Telefon-Punkt bedeutet — für Teams 1 Live-Befund, der nur Schlüssel und Schwere speichert (kein Wortlaut). */
const TELEFON_HINWEIS: Record<string, string> = {
  ki_hinweis_fehlt: "KI-Hinweis nicht gesagt (KI-VO Art. 50).", ki_hinweis_spaet: "KI-Hinweis zu spät (erlaubt: 20 s).",
  ki_hinweis_unbelegt: "KI-Hinweis nicht belegbar.", aufnahme_vor_ja: "Aufnahme vor dem hörbaren Ja gestartet (§ 201 StGB).",
  aufnahme_trotz_nein: "Aufnahme trotz Nein gestartet.", sperrwunsch_ohne_sperre: "Kunde will nicht mehr angerufen werden — Sperre fehlt.",
  anliegen_vor_identitaet: "Rate/Antrag genannt, bevor der Kunde bestätigt hat, dass er selbst dran ist.",
  vertrag_zusage: "Vertrag nie per Stimme schließen — Link zum Unterschreiben.", druck: "Druck (KI-VO Art. 5) — verboten.",
  drohung: "Drohung — nie Gericht, Inkasso, SCHUFA, Anwalt.", lastschrift: "Lastschrift ist ausgeschlossen — der Kunde überweist selbst.",
  kopplung: "Kündigung an Zahlung gekoppelt (§ 312k BGB).", amd_widerspruch: "Twilio meldete Maschine, obwohl der Kunde sprach.",
  limit_zusage: "Limit zugesagt — nie ‚garantiert‘, nie ‚sicher‘.", limit_freigabe: "Limit als Tatsache genannt.",
  betrag_null: "„Null Euro“ gesagt.", antrag_durch: "Antrag als „durch/genehmigt“ dargestellt.", karte_versprochen: "Karte versprochen („bekommen/erhalten“).",
};

/**
 * Regeln, die am 22.10.2026 neu eingestellt wurden (E-409 Kalibrierung). Ein Live-Befund OHNE Regelstand dazu entstand mit
 * der alten Fassung — und ohne Wortlaut lässt er sich nicht nachprüfen (von den fünf alten Funden mit Transkript waren vier
 * Fehlalarme). Er bleibt sichtbar, zählt aber nicht mehr als Regelverstoß.
 */
const LIVE_NEU_KALIBRIERT = new Set(["anliegen_vor_identitaet", "limit_zusage", "limit_freigabe", "limit_ohne_bank"]);

/**
 * Teams 1 Live-Befund (fiaon_aras_anruf.pruefung = { live: true, stand?, punkte: [{ regel, schwere }] }) — bei Anrufen OHNE
 * Aufnahme-Ja die einzige Spur dessen, was gesagt wurde (der Wortlaut wird nie gespeichert). Rein; Unbekanntes fällt weg.
 * Ohne `stand` = PRUEF_REGEL_STAND (alte Fassung) werden die neu eingestellten Regeln zu „alt_…“ (weich, nicht nachprüfbar).
 */
export function liveBefundPunkte(roh: unknown): PruefPunkt[] {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return []; } }
  if (!o || typeof o !== "object" || o.live !== true || !Array.isArray(o.punkte)) return [];
  const alt = o.stand !== PRUEF_REGEL_STAND;
  return o.punkte.slice(0, 12).map((p: any) => {
    const regel = String(p?.regel ?? "").replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 60);
    const was = TELEFON_HINWEIS[regel] ?? regel.replace(/_/g, " ");
    if (alt && LIVE_NEU_KALIBRIERT.has(regel)) {
      return { regel: `alt_${regel}`, schwere: "weich" as const, treffer: "", hinweis: `Live-Prüfung ohne Aufnahme, alte Regel (vor dem 22.10.2026) — ohne Wortlaut nicht nachprüfbar, kein Regelverstoß: ${was}` };
    }
    return { regel, schwere: p?.schwere === "hart" ? "hart" as const : "weich" as const, treffer: "", hinweis: `Live-Prüfung ohne Aufnahme: ${was}` };
  }).filter((p: PruefPunkt) => p.regel);
}

/** Punkte zusammenlegen — jede Regel einmal (die erste Fundstelle zählt). Rein. */
export function punkteZusammen(...listen: PruefPunkt[][]): PruefPunkt[] {
  const gesehen = new Set<string>();
  const aus: PruefPunkt[] = [];
  for (const l of listen) for (const p of l) { if (gesehen.has(p.regel)) continue; gesehen.add(p.regel); aus.push(p); }
  return aus;
}

/** Das Modell-Urteil, wie es der Server (oder die Attrappe im Prüfstand) liefert. */
export interface ModellUrteil { urteil: PruefUrteil; punkte: PruefPunkt[]; begruendung: string }

/** Die rohe Modell-Antwort in eine sichere Form bringen — nichts Unbekanntes kommt durch. Rein. */
export function modellUrteilLesen(roh: unknown): ModellUrteil | null {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return null; } }
  if (!o || typeof o !== "object") return null;
  const urteil: PruefUrteil = o.urteil === "fehler" ? "fehler" : o.urteil === "auffaellig" ? "auffaellig" : "ok";
  const punkte: PruefPunkt[] = (Array.isArray(o.punkte) ? o.punkte : []).slice(0, 8).map((p: any) => ({
    regel: `modell_${String(p?.regel ?? "hinweis").replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 40)}`,
    schwere: p?.schwere === "hart" ? "hart" : "weich",
    treffer: String(p?.treffer ?? "").slice(0, 160),
    hinweis: String(p?.hinweis ?? "").slice(0, 240),
  }));
  return { urteil, punkte, begruendung: String(o.begruendung ?? "").slice(0, 600) };
}

// ── Was am Telefon Bestand hat (E-409 Kalibrierung, 22.10.2026) ───────────
/**
 * Die festen harten Regeln: Wortwand, Limit, Kopplung, Drohung, Druck, Lastschrift, Vertrag per Stimme, die Telefon-Pflichten
 * (KI-Hinweis und Aufnahme aus den Zeitstempeln, Sperrwunsch, Identität vor Anliegen) und ARAS’ eigene Wahrheitsregeln (E-408:
 * „null Euro“, „Antrag durch“, „Karte bekommen“). Ein „fehler“ zählt nur mit einem solchen Punkt — Karte und Stufen-Ampel.
 */
export const FESTE_HARTE_REGEL = /^(wand_(?!floskel)|limit_(zusage|freigabe)|kopplung$|drohung$|druck$|lastschrift$|vertrag_zusage$|ki_hinweis_|aufnahme_|sperrwunsch_|anliegen_vor_identitaet$|betrag_null$|antrag_durch$|karte_versprochen$)/;

/** Modell-Punkte, die am Telefon nie zählen: KI-Hinweis und Aufnahme entscheiden die Zeitstempel, die Identität der Code. */
const MODELL_ZEIT_ODER_ID = /ki[\s_-]*hinweis|kihinweis|\bals\s+ki\b|eine\s+ki\b|ki[\s_-]*offenleg|offenlegung|k(?:ü|ue)nstliche?\s+intelligenz|erste[nrs]?\s+satz|aufnahme|aufzeichn|mitschn|mitschneid|recording|identit|selbst\s+dran|\ban\s+dritte|dritte[nr]?\s+person|gegen(?:ü|ue)ber\s+dritten/i;
/** … Wienerisch, Lachen, Umgangssprache: Justin will Wien ultra mit Lachen — nie ein Punkt. */
const MODELL_TON = /^modell_(?:\w*_)?(?:ton|stil|sprache|dialekt|umgangs\w*|lachen|formulierung)/i;
const MODELL_WIENERISCH = /dialekt|mundart|umgangssprach|wienerisch|(?:ö|oe)sterreich|\bwien|lach|salopp|locker|informell|unprofessionell|slang|flapsig|f(?:ü|ue)llw(?:ö|oe)rt|jugendsprach|kumpelhaft/i;
/** … „Druck“ ohne Drohung und ohne Frist mit Folge („Geht sich des heute noch aus?“ steht so in Justins Skript). */
const MODELL_DRUCK = /druck|zeitfalle|dringlich|dr(?:ä|ae)ng|fordernd|\beile\b|zeitdruck|zahlungsaufforderung/i;
/** Eine echte Drohung oder Frist mit Folge im Wortlaut von ARAS. */
const MODELL_DROHWORT = /gericht|inkasso|anwalt|schufa|pf(?:ä|ae)nd|mahnbescheid|mahnverfahren|vollstreck|polizei|anzeige|letzte\s+chance|nur\s+(?:noch\s+)?heute|sonst\s+(?:\S+\s+){0,4}?(?:gericht|inkasso|anwalt|schufa|sperr|k(?:ü|ue)ndig|teurer|kosten|geb(?:ü|ue)hr|mahn)|andernfalls|ansonsten|konsequenz|folgen\s+haben|teurer|zus(?:ä|ae)tzliche\s+kosten|sperren\s+wir|gesperrt/i;
/** … Wunschlimit, Visa-Karte, Freischaltung ohne echtes Zusagewort: Justins Verkauf (E-373). */
const MODELL_VERKAUF = /wunsch-?limit|visa|kredit-?karte|\bkarte\b|kartn|account|zugang|freischalt|freigeschalt|freigeben|loslegen|nutzen\s+k(?:ö|oe)nnen/i;
const MODELL_ZUSAGEWORT = /garant|\bsicher\b|sicherlich|\bfix\b|bewilligt|genehmigt|zugesagt|bekommen|erhalten|kriegen|auf\s+jeden\s+fall|hundert\s*prozent|100\s*%|definitiv|versprech/i;
/** Was beim Modell am Telefon hart bleiben darf: Drohung, Garantie/Zusage, Lastschrift, Vertrag per Stimme, Kopplung. */
const MODELL_HART_ART = /droh|inkasso|gericht|anwalt|schufa|pf(?:ä|ae)nd|garant|zusage|lastschrift|sepa|abbuch|vertrag\w*[\s_]*(?:per\s+)?(?:stimme|zusage|abschluss|geschlossen)|kopplung|gekoppelt/i;

/**
 * Ein Modell-Punkt am Telefon nach Justins Vorgaben: null = verworfen (KI-Hinweis, Aufnahme, Identität, Wienerisch/Lachen,
 * „heute noch?“ ohne Drohung, Wunschlimit/Karte/Freischaltung ohne Zusagewort); hart bleibt nur Drohung, Garantie/Zusage,
 * Lastschrift, Vertrag per Stimme, Kopplung — alles andere wird weich. Rein.
 */
export function modellPunktTelefon(p: PruefPunkt): PruefPunkt | null {
  const regel = String(p?.regel ?? ""), hinweis = String(p?.hinweis ?? ""), treffer = String(p?.treffer ?? "");
  const was = `${regel.replace(/_/g, " ")} ${hinweis}`;
  // Steht in ARAS’ Worten eine echte Drohung oder Frist mit Folge, verwirft kein Filter den Punkt.
  const droh = MODELL_DROHWORT.test(treffer);
  if (!droh && MODELL_ZEIT_ODER_ID.test(was)) return null;
  if (!droh && (MODELL_TON.test(regel) || MODELL_WIENERISCH.test(hinweis)) && MODELL_WIENERISCH.test(`${was} ${treffer}`)) return null;
  if (!droh && MODELL_DRUCK.test(was)) return null;
  if (!droh && MODELL_VERKAUF.test(treffer) && !MODELL_ZUSAGEWORT.test(treffer)) return null;
  if (!droh && MODELL_TON.test(regel)) return { ...p, schwere: "weich" };
  const hart = p.schwere === "hart" && (MODELL_HART_ART.test(was) || droh);
  return { ...p, schwere: hart ? "hart" : "weich" };
}
/** Alle Modell-Punkte am Telefon durch modellPunktTelefon. Rein. */
export function modellPunkteTelefon(punkte: readonly PruefPunkt[]): PruefPunkt[] {
  return punkte.map(modellPunktTelefon).filter((p): p is PruefPunkt => !!p);
}

/**
 * Hat dieser harte Punkt nach den Regeln Bestand? Feste Regeln immer (am Telefon ohne die Schreib-Ton-Regeln); ein
 * Modell-Punkt nur am Telefon und nur, wenn er die Kalibrierung hart übersteht. Rein.
 */
export function punktMitBestand(p: PruefPunkt, kanal: PruefKanal | string): boolean {
  if (p?.schwere !== "hart") return false;
  const r = String(p.regel ?? "");
  if (kanal === "telefon" && r.startsWith("ton_")) return false;
  if (FESTE_HARTE_REGEL.test(r)) return true;
  if (kanal === "telefon" && r.startsWith("modell_")) return modellPunktTelefon(p)?.schwere === "hart";
  return false;
}

/** Punkte aus der Datenbank (JSONB oder Text) sicher lesen. Rein. */
export function punkteLesen(roh: unknown): PruefPunkt[] {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return []; } }
  return Array.isArray(o) ? o.filter((p: any) => p && typeof p === "object" && typeof p.regel === "string") : [];
}

/**
 * Zählt ein ARAS-Anruf in der Stufen-Ampel als Prüf-Fehler? Nur mit einem harten Punkt, der Bestand hat — aus der Prüfzeile
 * (Prüf-Mara), sonst aus dem Live-Befund; „In Ordnung“ von Justin zählt nie. Ein „fehler“ ohne solchen Punkt zählt nicht.
 * Ohne Prüfzeile und ohne Live-Befund gilt der Status (Altbestand, Prüfstände). Rein.
 */
export function anrufZaehltAlsPruefFehler(e: { status?: string | null; punkte?: unknown; entschieden?: string | null; live?: unknown }): boolean {
  if (e.entschieden === "in_ordnung") return false;
  if (e.punkte != null) return punkteLesen(e.punkte).some((p) => punktMitBestand(p, "telefon"));
  if (e.live != null) return liveBefundPunkte(e.live).some((p) => punktMitBestand(p, "telefon"));
  return e.status === "fehler";
}

/**
 * Das Urteil: ein harter Treffer = fehler; sonst auffällig, wenn das Modell es sagt oder mindestens
 * zwei weiche Punkte zusammenkommen; ein einzelner weicher Punkt bleibt „ok“ (steht trotzdem in den Punkten).
 * Am Telefon (E-409 Kalibrierung): die Modell-Punkte laufen durch modellPunkteTelefon; „fehler“ nur mit einem Punkt, der
 * Bestand hat; ein Modell-„fehler“ ohne solchen Punkt ist höchstens „auffällig“; verwirft die Kalibrierung ALLE Punkte des
 * Modells, zählt sein Urteil nicht (es waren Justins Vorgaben); „alt_…“ (nicht nachprüfbar) zählt nicht als weicher Punkt.
 * Rein.
 */
export function urteilBilden(harte: PruefPunkt[], modell: ModellUrteil | null, kanal?: PruefKanal): { urteil: PruefUrteil; punkte: PruefPunkt[] } {
  if (kanal === "telefon") {
    const mp = modellPunkteTelefon(modell?.punkte ?? []);
    const punkte = [...harte, ...mp];
    if (punkte.some((p) => punktMitBestand(p, "telefon"))) return { urteil: "fehler", punkte };
    const modellSagt: PruefUrteil = !modell || (modell.punkte.length > 0 && mp.length === 0) ? "ok" : modell.urteil;
    const weich = punkte.filter((p) => p.schwere === "weich" && !p.regel.startsWith("alt_")).length;
    if (modellSagt !== "ok" || punkte.some((p) => p.schwere === "hart") || weich >= 2) return { urteil: "auffaellig", punkte };
    return { urteil: "ok", punkte };
  }
  const punkte = [...harte, ...(modell?.punkte ?? [])];
  if (punkte.some((p) => p.schwere === "hart") || modell?.urteil === "fehler") return { urteil: "fehler", punkte };
  const weich = punkte.filter((p) => p.schwere === "weich").length;
  if (modell?.urteil === "auffaellig" || weich >= 2) return { urteil: "auffaellig", punkte };
  return { urteil: "ok", punkte };
}

/**
 * Eine Telefon-Prüfung aus der Zeit vor der Kalibrierung mit den Regeln von heute neu rechnen (E-409, 22.10.2026) — ohne
 * neue Modell-Frage: dieselben harten Regeln wie im Takt (Transkript nur ARAS, Zeiten, Live-Befund), die damaligen
 * Modell-Punkte durch modellPunkteTelefon; ein Modell-Urteil ohne eigene Punkte zählt nicht (was es meinte, steht nirgends). Rein.
 */
export function telefonPruefungNeuRechnen(e: {
  regelText: string; telefon: PruefKontext["telefon"]; live: PruefPunkt[]; altePunkte: unknown; modellHatGeurteilt: boolean;
}): { urteil: PruefUrteil; punkte: PruefPunkt[] } {
  const harte = punkteZusammen(harteRegeln(e.regelText, { kanal: "telefon", telefon: e.telefon ?? null }), e.live);
  const modell = punkteLesen(e.altePunkte).filter((p) => p.regel.startsWith("modell_"));
  const mu: ModellUrteil | null = e.modellHatGeurteilt && modell.length
    ? { urteil: modell.some((p) => p.schwere === "hart") ? "fehler" : "auffaellig", punkte: modell, begruendung: "" }
    : null;
  return urteilBilden(harte, mu, "telefon");
}

/** Karte nur bei Auffälligem — und die Empfehlung dazu (Vertrag § 11). */
// Karte nur bei einem Regelverstoß („fehler“). „Auffällig“ zählt still in KI-Team › Qualität — keine Aufgabe für Justin
// (20.10.2026: in den ersten 5 Minuten 26 Karten, fast alle Hinweise auf Justins eigenen Verkaufssatz E-373).
export function karteNoetig(urteil: PruefUrteil): boolean { return urteil === "fehler"; }
/** Höchstens so viele neue Prüf-Mara-Karten je Tag (Berlin) — mehr zählt nur in der Statistik. */
export const KARTEN_JE_TAG = 5;
export function empfehlungFuer(urteil: PruefUrteil): "in_ordnung" | "anweisen" { return urteil === "fehler" ? "anweisen" : "in_ordnung"; }

/**
 * Stichprobe: gehört diese Zeile (id) bei der Quote (0–100 %) in die Prüfung? Deterministisch —
 * dieselbe Zeile bekommt bei derselben Quote immer dieselbe Antwort (kein Zufall, der den Prüfstand wackeln lässt).
 */
export function inStichprobe(id: number, quote: number): boolean {
  const q = Math.max(0, Math.min(100, Math.round(Number(quote) || 0)));
  if (q >= 100) return true;
  if (q <= 0) return false;
  let h = 2166136261;
  for (const z of `pruef:${Math.trunc(id)}`) { h ^= z.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 100) < q;
}

/** Die Prüfquoten (fiaon_settings.pruef_mara_quote) lesen — Vorgabe telefon 100, mail 20, whatsapp 20. Rein. */
export const QUOTE_VORGABE = { telefon: 100, mail: 20, whatsapp: 20 } as const;
export function quotenLesen(roh: unknown): { telefon: number; mail: number; whatsapp: number } {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  const z = (k: keyof typeof QUOTE_VORGABE) => {
    const n = Number(o?.[k]);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : QUOTE_VORGABE[k];
  };
  return { telefon: z("telefon"), mail: z("mail"), whatsapp: z("whatsapp") };
}

/** Fehlerquote je Schlüssel (Werkzeug/Spielart/Kanal) aus Zählzeilen — und die Vorschläge „gelb → grün“. Rein. */
export function fehlerquoteRechnen(
  zeilen: { kanal: string; schluessel: string | null; n: number; auffaellig: number }[],
  opt: {
    tage: number; gelb?: readonly string[];
    /**
     * E-409 Fund 16: je Werkzeug, das in den geprüften Fällen unter Gelb lief (fiaon_ki_pruefung.werkzeuge) — die Grundlage
     * für „gelb → grün“. Die Kanal-Schlüssel (postfach:…, aktion:…) heißen nie wie ein Werkzeug; ohne diese Liste kam nie ein Vorschlag.
     */
    werkzeuge?: { schluessel: string; n: number; auffaellig: number }[];
  } = { tage: 7 },
): { je: { kanal: string; schluessel: string; n: number; auffaellig: number; quote: number }[]; gesamt: { n: number; auffaellig: number; quote: number }; vorschlaege: string[] } {
  const je = zeilen.map((z) => {
    const n = Number(z.n) || 0, a = Number(z.auffaellig) || 0;
    return { kanal: z.kanal, schluessel: z.schluessel ?? "(ohne)", n, auffaellig: a, quote: n ? Math.round((a / n) * 1000) / 10 : 0 };
  }).sort((x, y) => y.quote - x.quote || y.n - x.n);
  const n = je.reduce((s, z) => s + z.n, 0), a = je.reduce((s, z) => s + z.auffaellig, 0);
  const vorschlaege: string[] = [];
  if (opt.tage >= 28) {
    const basis = opt.werkzeuge
      ? opt.werkzeuge.map((w) => { const n = Number(w.n) || 0, a = Number(w.auffaellig) || 0; return { schluessel: w.schluessel, n, quote: n ? Math.round((a / n) * 1000) / 10 : 0 }; })
      : je;
    for (const g of opt.gelb ?? []) {
      const z = basis.find((x) => x.schluessel === g);
      if (z && z.n >= 20 && z.quote < 2) vorschlaege.push(`„${g}“: ${z.n} Prüfungen in ${opt.tage} Tagen, ${z.quote} % auffällig — gelb → grün wäre vertretbar.`);
    }
  }
  return { je, gesamt: { n, auffaellig: a, quote: n ? Math.round((a / n) * 1000) / 10 : 0 }, vorschlaege };
}

/** Transkript-Ausschnitt für die Karte: nur der betroffene Satz, ≤ 300 Zeichen, ohne Vornamen der Mitarbeiter. Rein. */
export function ausschnittFuerKarte(text: string, treffer: string, mitarbeiter?: readonly MitarbeiterEintrag[] | null): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  let s = t;
  const i = treffer ? t.toLowerCase().indexOf(String(treffer).toLowerCase()) : -1;
  if (i >= 0) {
    const a = Math.max(0, t.lastIndexOf(". ", i) + 1), e = t.indexOf(". ", i);
    s = t.slice(a, e === -1 ? t.length : e + 1).trim();
  }
  for (const m of mitarbeiter ?? []) {
    if (m.vorname) s = s.replace(new RegExp(`\\b${m.vorname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), m.anrede ? `${m.anrede} ${m.nachname}` : m.nachname);
  }
  return s.length > 300 ? `${s.slice(0, 297)}…` : s;
}
