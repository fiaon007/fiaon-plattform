// ═══════════════════════════════════════════════════════════════════════════
// ARAS — DIE HARTEN TELEFON-REGELN (E-408, 20.10.2026)
//
// EINE Quelle mit Prüf-Mara (E-409): Wortwand, Druck, Lastschrift, Vertrag per Stimme, KI-Hinweis, Aufnahme nur nach
// dem Ja und „Anliegen erst nach der Identität“ (über das ganze Gespräch) kommen aus shared/fiaon-ki-pruefung-regeln.ts
// — diese Datei leitet sie nur weiter. Damit prüft die Live-Nachbereitung (fiaon-aras-nachbereitung.ts) genauso wie
// Prüf-Mara. Hier stehen nur Arasʼ eigene Zusatzregeln aus Justins Probeanrufen (20.10.): nie „null Euro“, keine
// vorgelesene Internetadresse, keine Anzahl ohne ihr Wort, eine Frage je Redebeitrag — und aus Justins Tests am
// 20.10. (Anrufe 5 und 6): kein Satz zweimal gleich, kein Füllwort als eigener Redebeitrag, nicht jeder Satz mit „Also“,
// nie Schluss ohne Abschied. Die Brücke nutzt dieselben Funktionen live (Wiederholungs- und Abschied-Wache).
// Geprüft in scripts/pruef-aras-plan.ts, scripts/pruef-aras-prompt.ts und scripts/pruef-aras-bruecke.ts (mit Rot-Proben).
// ═══════════════════════════════════════════════════════════════════════════
import {
  telefonRegeln as pruefTelefonRegeln, punkteZusammen, druckFinden, lastschriftFinden, vertragZusageFinden, type RegelPunkt, type TelefonLage, type RegelZeile,
} from "./fiaon-ki-pruefung-regeln";
import { wandPruefen, kopplungFinden, drohungFinden } from "./fiaon-wortverbote";
import { limitPruefen, BANK_SATZ_MUSTER } from "./fiaon-mara-ton";

export {
  druckFinden, lastschriftFinden, vertragZusageFinden, anliegenGenannt, anliegenVorIdentitaet, kiHinweisGesagt, KI_HINWEIS_SPAETESTENS_SEK,
  type RegelZeile, type RegelPunkt, type TelefonLage,
} from "./fiaon-ki-pruefung-regeln";

// ── Probe 20.10.2026 (Justins erster Anruf): Wahrheit und Ton am Telefon ─────────────────────────────────
/** „null Euro“ / „0 €“ — eine Anzahl wurde als Betrag gelesen („die erste Rate beträgt null Euro“). */
export function nullBetragFinden(text: string): string | null {
  const m = /\bnull\s+euro\b|(?<![\d.,])0(?:[.,]0+)?\s*(?:€|euro\b)|€\s*0(?:[.,]0+)?(?![\d.,])/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}
/** Eine vorgelesene Internetadresse („fiaon punkt com slash privacy“, fiaon.com/…, http …). */
export function urlFinden(text: string): string | null {
  const m = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|de|at|ch|net|org)\/\S*|\bpunkt\s+(?:com|de|at|ch)\b|\bslash\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}
/** Eine Anzahl ohne ihr Wort („0 offen“, „offen: 0“) — die Vorstufe zu „null Euro“. */
export function zahlOhneEinheitFinden(text: string): string | null {
  const m = /\b0\s+(?:offen|bezahlt|ausstehend)\b|\b(?:offen|bezahlt|ausstehend)\s*:\s*\d+\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}
/**
 * EIN Redebeitrag: höchstens eine Frage, und nach der Frage höchstens ein ganz kurzer Nachsatz („Ein kurzes Ja reicht.“).
 * Liefert den Grund oder null. Rein.
 */
export function fragenImBeitrag(text: string): string | null {
  const t = String(text ?? "").trim();
  const fragen = (t.match(/\?/g) ?? []).length;
  if (fragen > 1) return `${fragen} Fragen in einem Redebeitrag`;
  if (fragen === 1) {
    const nach = t.slice(t.indexOf("?") + 1).replace(/[„“”"»«]/g, "").trim();
    const woerter = nach ? nach.split(/\s+/).filter(Boolean).length : 0;
    if (woerter > 5) return `nach der Frage geht es weiter („${nach.slice(0, 60)}“)`;
  }
  return null;
}

// ── Justins Tests 20.10. (Anrufe 5 und 6): menschlich statt Schleife ─────────────────────────────────────────
// Anruf 5: dreimal wortgleich derselbe Anlass-Satz auf „Um was geht's?“ — und ein „Also...“ mitten in seine Denkpause.
// Anruf 6: fast jeder Satz begann mit „Also/ähm“, Verkauf ohne eine Frage nach seinem Bedarf, aufgelegt ohne Abschied.

/** Wörter, die für den Vergleich zweier Sätze nichts zählen (Füllwörter, Zustimmungslaute). */
const VERGLEICH_RAUS = new Set(["also", "ähm", "ähmm", "äh", "ehm", "hm", "hmm", "mhm", "ach", "so", "na", "ja", "tja", "okay", "ok", "genau", "gut", "super"]);
/** Füllwörter, mit denen ein Mensch zum Reden ansetzt — als eigener Redebeitrag ein abgebrochener Ansatz („Also...“). „Hm“/„Mhm“ sind Zuhör-Laute. */
const ANSATZ = /^(?:also|ähm+|äh+|ehm|ach so|na ja|naja|tja|so|okay also|ja also)$/;
/** Füllwörter am Satzanfang (in den ersten drei Wörtern eines Redebeitrags). */
const FUELL_ANFANG = /^(?:also|ähm+|äh+|ehm|hm+|hmm|tja)$/;

/** Die Wörter eines Satzes, klein, ohne Satzzeichen und ohne Füllwörter — für den Vergleich. Rein. */
export function satzWoerter(text: string): string[] {
  return String(text ?? "").toLowerCase().replace(/[^a-zäöüß0-9]+/gi, " ").split(" ").filter((w) => w && !VERGLEICH_RAUS.has(w));
}
/** Wie ähnlich zwei Sätze sind (0–1): 1 − Wort-Abstand / Länge des längeren. Rein. */
export function satzAehnlichkeit(a: string | readonly string[], b: string | readonly string[]): number {
  const x = typeof a === "string" ? satzWoerter(a) : a, y = typeof b === "string" ? satzWoerter(b) : b;
  if (!x.length || !y.length) return 0;
  let vor = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const jetzt = [i];
    for (let j = 1; j <= y.length; j++) jetzt[j] = Math.min(vor[j] + 1, jetzt[j - 1] + 1, vor[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    vor = jetzt;
  }
  return 1 - vor[y.length] / Math.max(x.length, y.length);
}
/** Ab dieser Ähnlichkeit (normalisierter Text) gilt ein Redebeitrag als Wiederholung (Koordination 20.10.: ≥ 80 %; nach Justins
 *  Anruf 11 „wiederholt sich“ und Anruf 16 — „Wofür … die Karte?“ zweimal — strenger: ≥ 70 % gegen die letzten FÜNF). */
export const WIEDERHOLUNG_AB = 0.7;
/** So viele frühere Redebeiträge zählen für die Wiederholungs-Wache. */
export const WIEDERHOLUNG_FENSTER = 5;
/** Kürzere Sätze („Super, passt.“) zählen nicht — die darf ein Mensch zweimal sagen. */
export const WIEDERHOLUNG_MIN_WOERTER = 6;
/** Laufender Satz: erst ab so vielen Wörtern vergleichen (Anfang gegen den gleich langen Anfang der früheren Sätze). */
export const WIEDERHOLUNG_LAUFEND_WOERTER = 8;
/** Der versteckte Hinweis an die Stimme, wenn sie sich wiederholt (Wortlaut aus der Koordination, 20.10.2026). */
export const WIEDERHOLUNG_HINWEIS = "Du hast dich gerade wiederholt. Sag es anders, konkreter, und frag, was er genau wissen will.";

/**
 * Wiederholt sich Aras? `neu` gegen seine letzten drei Redebeiträge (`frueher`, ältester zuerst). `laufend`: der Satz ist
 * noch nicht fertig — dann zählt der gleich lange Anfang der früheren Sätze. Liefert die Ähnlichkeit oder null. Rein.
 */
export function wiederholtSich(neu: string, frueher: readonly string[], laufend = false): number | null {
  // Die Aufnahme-Frage darf Aras wörtlich noch einmal stellen (nach einer Gegenfrage) — das ist keine Schleife.
  if (/aufzeichn|aufnehm|mitschneid/i.test(neu)) return null;
  const w = satzWoerter(neu);
  if (w.length < (laufend ? WIEDERHOLUNG_LAUFEND_WOERTER : WIEDERHOLUNG_MIN_WOERTER)) return null;
  for (const f of frueher.slice(-WIEDERHOLUNG_FENSTER)) {
    const v = satzWoerter(f);
    if (v.length < WIEDERHOLUNG_MIN_WOERTER) continue;
    const q = satzAehnlichkeit(w, laufend ? v.slice(0, w.length) : v);
    if (q >= WIEDERHOLUNG_AB) return Math.round(q * 100) / 100;
  }
  return null;
}
/** Der erste Aras-Redebeitrag, der einen seiner drei vorigen wiederholt (Transkript). Rein. */
export function wiederholungFinden(zeilen: readonly RegelZeile[] | null | undefined): string | null {
  const aras = (zeilen ?? []).filter((z) => z.wer === "aras" && String(z.text ?? "").trim()).map((z) => String(z.text));
  for (let i = 1; i < aras.length; i++) if (wiederholtSich(aras[i], aras.slice(Math.max(0, i - WIEDERHOLUNG_FENSTER), i)) !== null) return aras[i].slice(0, 160);
  return null;
}
/** Ein Redebeitrag, der NUR ein Ansatz-Füllwort ist („Also...“, „Ähm“) — ein abgebrochener Anlauf. „Mhm“ beim Zuhören zählt nicht. Rein. */
export function nurFuellwort(text: string): boolean {
  const t = String(text ?? "").toLowerCase().replace(/[^a-zäöüß ]+/gi, " ").replace(/\s+/g, " ").trim();
  return !!t && ANSATZ.test(t);
}
/** Beginnt der Redebeitrag mit einem Füllwort (in den ersten drei Wörtern: „Also, …“, „Super. Ähm, also …“)? Rein. */
export function beginntMitFuellwort(text: string): boolean {
  const w = String(text ?? "").toLowerCase().replace(/[^a-zäöüß ]+/gi, " ").split(/\s+/).filter(Boolean).slice(0, 3);
  return w.some((x) => FUELL_ANFANG.test(x)) || /^ach so\b/i.test(String(text ?? "").trim());
}
/**
 * Wie viele Aras-Redebeiträge mit einem Füllwort beginnen (ohne den ersten Satz mit dem KI-Hinweis, ohne Zuhör-Laute).
 * Koordination 20.10.: höchstens jeder dritte — auch bei „viel“ (viel = lockerer, nicht mehr Füllwörter). Rein.
 */
export function fuellwortQuote(zeilen: readonly RegelZeile[] | null | undefined): { mit: number; von: number; quote: number } {
  const aras = (zeilen ?? []).filter((z) => z.wer === "aras" && satzWoerter(z.text).length >= 3).slice(1);
  const mit = aras.filter((z) => beginntMitFuellwort(z.text)).length;
  return { mit, von: aras.length, quote: aras.length ? Math.round((mit / aras.length) * 100) / 100 : 0 };
}
/** Höchstens jeder dritte Redebeitrag darf mit einem Füllwort beginnen (ab vier Redebeiträgen geprüft). */
export const FUELLWORT_QUOTE_HOECHSTENS = 0.34;
/** Ein Abschied („… einen schönen Tag noch“, „auf Wiederhören“) — die Brücke legt erst danach auf. */
export const ABSCHIED_RE = /sch(?:ö|oe)nen (?:tag|abend|nachmittag|vormittag|feierabend)|sch(?:ö|oe)ne(?:s)? (?:woche|wochenende)|auf wiederh(?:ö|oe)ren|auf wiederschauen|tsch(?:ü|ue)ss|alles gute|have a (?:lovely|nice|good) (?:day|evening)|goodbye/i;
export function abschiedGesagt(text: string): boolean { return ABSCHIED_RE.test(String(text ?? "")) || ABSCHIED_AT_RE.test(String(text ?? "")); }
/**
 * Österreichische Abschiede (stärkerer Dialekt, 20.10. abends: „Servus“ zum Abschied bei Kunden aus Österreich).
 * „Servus“ kann auch ein Gruß sein — die Brücke zählt diese Wörter darum erst, wenn das Gespräch schon läuft (nach 20 s).
 */
export const ABSCHIED_AT_RE = /\b(?:servus|baba|pfiat (?:di|eana|ihna|enk))\b/i;

/**
 * Eine Karte als sicher versprochen (Anruf 8, 20.10.: „… damit Sie schnellstmöglich Ihre eigene Visa-Kreditkarte
 * bekommen“) — über die Karte entscheidet die Partnerbank; E-373 sagt „… nutzen können“ / „… zu Ihrer Karte kommen“.
 * Ein Satz, der die Partnerbank oder ihre Entscheidung nennt, ist kein Versprechen. Rein.
 */
export function karteVersprochenFinden(text: string): string | null {
  const saetze = String(text ?? "").split(/(?<=[.!?…])\s+/);
  for (const satz of saetze) {
    if (/entscheid|partnerbank|\bob\s+sie\b/i.test(satz)) continue;
    const m = /\b(?:bekommen|erhalten|kriegen)\s+(?:sie\s+)?(?:dann\s+|direkt\s+|sofort\s+|auch\s+|garantiert\s+)?(?:ihre|die|eine)\s+(?:eigene\s+)?(?:visa[- ]?)?(?:kredit)?karte\b|\b(?:ihre|die|eine)\s+(?:eigene\s+)?(?:visa[- ]?)?(?:kredit)?karte\s+(?:\S+\s+){0,4}?(?:bekommen|erhalten|kriegen)\b/i.exec(satz);
    if (m) return m[0];
  }
  return null;
}

/**
 * Der Antrag als „durch“/„genehmigt“ dargestellt (Rauchtest 20.10.: „Ihr Antrag ist bei uns schon durch“) — er ist nur
 * abgeschickt; über die Karte entscheidet die Partnerbank. „durch die Partnerbank“ zählt nicht. Rein.
 */
export function antragDurchFinden(text: string): string | null {
  const m = /\b(?:antrag|der|er)\b[^.!?]{0,60}?\b(?:ist|sei|wäre|wurde|wird)\b[^.!?]{0,25}?\b(?:durch(?!\s+(?:die|den|das|der|dem|uns|unsere\w*|ihre\w*|eine\w*)\b)|genehmigt|bewilligt|angenommen|freigegeben)\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}

// ── Justin 20.10. (Anruf 16): Wortwahl ──────────────────────────────────────────────────────────────────────
/** „Super“ kam fünfmal — höchstens zweimal im ganzen Gespräch. Liefert die Anzahl. Rein. */
export function superZaehlen(text: string): number { return (String(text ?? "").match(/(?<![a-zäöüß])super(?![a-zäöüß])/gi) ?? []).length; }
export const SUPER_HOECHSTENS = 2;
/**
 * Bank-Vorbehalt im Verkauf (E-373, Anruf 16: „Die genauen Bedingungen legt allerdings die Partnerbank fest“, „… prüft die
 * Partnerbank ihn und entscheidet“) — die Partnerbank nur auf seine ausdrückliche Frage. Rein.
 */
export function bankVorbehaltFinden(text: string): string | null {
  const m = /\b(?:die\s+)?(?:genauen\s+)?bedingungen\s+legt\s+(?:allerdings\s+|aber\s+)?die\s+partnerbank\b[^.!?]*|\b(?:prüft|prueft)\s+(?:die|unsere)\s+partnerbank\b[^.!?]*|\bpartnerbank\s+(?:prüft|prueft)\b[^.!?]*/i.exec(String(text ?? ""));
  return m ? m[0].slice(0, 160) : null;
}
/** Leersätze („Schauen wir uns an, wie ich das am besten erkläre.“) — Füllung statt Inhalt. Rein. */
export function leersatzFinden(text: string): string | null {
  const m = /\bschauen\s+wir\s+(?:uns\s+)?(?:mal\s+)?an,?\s+wie\s+ich\s+das\s+(?:am\s+besten\s+)?erkläre\b|\blassen\s+sie\s+mich\s+(?:kurz\s+)?(?:überlegen|ueberlegen|nachdenken|erklären)\b|\bgute\s+frage\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}

/** Für die Nachbereitung: wie das Gespräch endete — „Aras hat beendet“ ohne Abschied ist ein Befund. */
export type ArasTelefonLage = TelefonLage & { arasBeendet?: boolean };

/**
 * Alle harten Telefon-Regeln auf das, was ARAS gesagt hat (+ Zeiten des Gesprächs): die von Prüf-Mara (eine Quelle)
 * und Arasʼ Zusatzregeln. Rein. Gespeichert wird nur der Befund (Schlüssel + Schwere), nie der Wortlaut ohne Aufnahme-Ja.
 */
export function telefonRegeln(text: string, tel: ArasTelefonLage | null = null): RegelPunkt[] {
  const zusatz: RegelPunkt[] = [];
  const t = String(text ?? "");
  const nb = nullBetragFinden(t); if (nb) zusatz.push({ regel: "betrag_null", schwere: "hart", treffer: nb.slice(0, 160), hinweis: "„Null Euro“ / „0 €“ gesagt — ein Betrag nur aus einem Betragsfeld, eine Anzahl ist nie ein Betrag." });
  const url = urlFinden(t); if (url) zusatz.push({ regel: "url_vorgelesen", schwere: "weich", treffer: url.slice(0, 160), hinweis: "Internetadresse vorgelesen — der Link kommt aufs Handy." });
  const durch = antragDurchFinden(t); if (durch) zusatz.push({ regel: "antrag_durch", schwere: "hart", treffer: durch.slice(0, 160), hinweis: "Antrag als „durch/genehmigt“ dargestellt — er ist abgeschickt; über die Karte entscheidet die Partnerbank." });
  const karte = karteVersprochenFinden(t); if (karte) zusatz.push({ regel: "karte_versprochen", schwere: "hart", treffer: karte.slice(0, 160), hinweis: "Karte versprochen („bekommen/erhalten“) — E-373: „… nutzen können“; über die Karte entscheidet die Partnerbank." });
  const bank = bankVorbehaltFinden(t); if (bank) zusatz.push({ regel: "bank_vorbehalt_verkauf", schwere: "weich", treffer: bank, hinweis: "Bank-Vorbehalt im Verkauf (E-373) — die Partnerbank nur auf seine ausdrückliche Frage." });
  const supers = superZaehlen(t); if (supers > SUPER_HOECHSTENS) zusatz.push({ regel: "super_zu_oft", schwere: "weich", treffer: `${supers}×`, hinweis: "„Super“ höchstens zweimal im Gespräch — sonst „Sehr gut“, „Prima“, „Schön“." });
  const leer = leersatzFinden(t); if (leer) zusatz.push({ regel: "leersatz", schwere: "weich", treffer: leer, hinweis: "Leersatz statt Inhalt — direkt die Sache sagen." });
  const zeilen = tel?.transkript ?? null;
  if (zeilen?.length) {
    const w = wiederholungFinden(zeilen);
    if (w) zusatz.push({ regel: "wiederholung", schwere: "weich", treffer: w, hinweis: "Einen Satz wortgleich wiederholt — auf eine Nachfrage anders und konkreter antworten." });
    const allein = zeilen.find((z) => z.wer === "aras" && nurFuellwort(z.text));
    if (allein) zusatz.push({ regel: "fuellwort_allein", schwere: "weich", treffer: String(allein.text).slice(0, 160), hinweis: "Ein Füllwort als eigener Redebeitrag („Also...“) — ins Wort gefallen statt ausreden lassen." });
    const q = fuellwortQuote(zeilen);
    if (q.von >= 4 && q.quote > FUELLWORT_QUOTE_HOECHSTENS) zusatz.push({ regel: "fuellwort_satzanfang", schwere: "weich", treffer: `${q.mit} von ${q.von}`, hinweis: "Zu viele Sätze beginnen mit „Also/Ähm“ — Füllwörter nur, wo ein Mensch nachdenkt." });
    if (tel?.arasBeendet && !zeilen.filter((z) => z.wer === "aras").slice(-3).some((z) => abschiedGesagt(z.text))) {
      zusatz.push({ regel: "abschied_fehlt", schwere: "weich", treffer: "", hinweis: "Aufgelegt ohne Abschied — erst bestätigen, nächster Schritt, Abschied mit Namen." });
    }
  }
  return punkteZusammen(pruefTelefonRegeln(t, tel), zusatz);
}

// ── Der Freitext-Auftrag aus der Akte (Nachtrag Akte-Steuerung, Punkt 2) ─────────────────────────────────
// „Was soll Aras sagen oder erledigen?“ — geht als Abschnitt „Auftrag des Betreuers“ ins Briefing. Darum dieselbe
// Wand wie für alles, was Aras sagt: keine Limit-Zusage, kein Bank-Vorbehalt im Verkauf (E-373), keine Drohung,
// kein Druck, keine Lastschrift, kein Vertrag per Stimme — und nichts, was beim Menschen bleibt.
const BLEIBT_BEIM_MENSCHEN = /\b(?:kündig\w*|kuendig\w*|widerruf\w*|erstatt\w*|rückerstatt\w*|beschwerde\w*|anwalt\w*|rechtsanwalt\w*|behörde\w*|verbraucherzentrale)\b/i;

/** Prüft den Freitext-Auftrag. Rein. `hinweise` sind ganze Sätze für den Betreuer (warum es so nicht geht und was stattdessen). */
export function auftragPruefen(text: string): { ok: boolean; hinweise: string[] } {
  const t = String(text ?? "");
  const h: string[] = [];
  if (!t.trim()) return { ok: true, hinweise: [] };
  for (const l of limitPruefen(t)) {
    if (l.art === "zusage") h.push("Kein Limit zusagen — das Wunschlimit ist sein Wunsch; was er bekommt, steht in seiner Bestätigung.");
    if (l.art === "freigabe") h.push("Keine Freigabe versprechen — über den Rahmen entscheidet die Partnerbank, das sagt Aras nur auf direkte Frage.");
  }
  if (BANK_SATZ_MUSTER.test(t) || /\bwir\s+sind\s+(?:keine|nicht\s+die)\s+bank\b/i.test(t)) h.push("Kein Bank-Vorbehalt im Gespräch (E-373) — Aras verkauft den Wunsch, nicht den Vorbehalt.");
  if (drohungFinden(t) || druckFinden(t)) h.push("Kein Druck und keine Drohung (kein Gericht, kein Inkasso, keine SCHUFA, keine erfundene Frist) — Aras bleibt ruhig und freundlich.");
  if (kopplungFinden(t)) h.push("Die Kündigung hängt nie an einer Zahlung — bitte so nicht an Aras geben.");
  if (lastschriftFinden(t)) h.push("Lastschrift gibt es nicht — der Kunde überweist selbst.");
  if (vertragZusageFinden(t)) h.push("Einen Vertrag schließt Aras nie am Telefon — er schickt den Link zum Unterschreiben.");
  if (BLEIBT_BEIM_MENSCHEN.test(t)) h.push("Kündigung, Widerruf, Erstattung, Beschwerde und Rechtliches bleiben bei dir — Aras verbindet dann zu dir oder bucht einen Rückruf.");
  for (const w of wandPruefen(t)) if (w.art !== "floskel") h.push(`„${w.treffer}“: ${w.hinweis}`.slice(0, 240));
  const eindeutig = Array.from(new Set(h));
  return { ok: eindeutig.length === 0, hinweise: eindeutig.slice(0, 4) };
}
