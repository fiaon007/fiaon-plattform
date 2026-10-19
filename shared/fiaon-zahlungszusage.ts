// ═══════════════════════════════════════════════════════════════════════════
// DER GENANNTE ZAHLTAG PER MAIL — DIE REGEL (E-406 B1 Nachbesserung, 19.10.2026)
//
// Maras Mail zur frisch fälligen Rate (mara_rate_erinnerung) bietet als zweiten Weg: „Schreiben Sie mir einfach auf
// diese E-Mail, wann Sie zahlen, zum Beispiel „am Freitag“.“ Der unabhängige Prüfer fand: Die Antwort landet bei
// Mail-Mara (Postmeister), und dort schrieb NICHTS die Zusage fest — promised_payment_date blieb leer, die
// WhatsApp-Zentrale erinnerte weiter, der Betreuer sah keine „Zusage“. Nur WhatsApp-Mara (zahlungszusage_merken) und
// das Inkasso von Hand (ratenErgebnisAnwenden, „zahlt am“) hielten einen Zahltag fest.
//
// Jetzt erkennt der SERVER den Zahltag in seiner Mail (wie zahlung_suchen und angaben_aendern, E-401) und hält ihn
// fest, bevor Mara schreibt (server/lib/fiaon-mara-zahlungszusage.ts). Diese Datei ist rein (ohne Datenbank):
//   · zahltagErkennen — „am Freitag“, „am 23.10.“, „morgen“, „Ende des Monats“; „am 15.“ (ohne Monat), „nächste
//     Woche“, eine Verneinung oder zwei verschiedene Tage sind UNKLAR → Mara fragt nach (nie geraten, E-248 #621).
//     Bezugstag ist der Tag, an dem ER schrieb (nicht der Tag, an dem Mara liest).
//   · zusageUrteil — nur für offene, geschuldete Raten (FORDERUNG_AKTIV_SQL_FUER liest der Server), nur bis
//     ZUSAGE_HOECHSTENS_TAGE in der Zukunft (länger ist eine Pause, keine Zusage), nie in der Vergangenheit.
//   · zusageHinweis / zusageAntwortFunde — was Mara sagt, und die Wand: nie „notiert“, wenn nichts notiert ist;
//     nie „bis dahin keine Erinnerung“ (Rechnung und Mahnungen laufen weiter — E-182, der Mahnmotor wird nie gebremst).
// ═══════════════════════════════════════════════════════════════════════════

/** Weiter als so viele Tage ist es keine Zusage mehr, sondern eine Pause — Mara hält es nicht fest. */
export const ZUSAGE_HOECHSTENS_TAGE = 31;
/** Der Name in der Handlungsliste (wie das WhatsApp-Werkzeug). */
export const ZUSAGE_WERKZEUG = "zahlungszusage_merken";
/** Wer in der Mail festhält (Verlauf in der Akte). */
export const ZUSAGE_AGENT_NAME = "Mara (E-Mail)";
/** In diesen Lagen hat er eine Rate, zu der ein Zahltag gehört (Postmeister-Kundenlage). */
export const ZUSAGE_LAGEN: readonly string[] = ["aktiv", "rate_ueberfaellig", "gekuendigt"];

export type UnklarGrund = "ohne_monat" | "vage" | "frage" | "verneint" | "mehrere";

export type ZahltagErkennung =
  | { art: "tag"; datum: string; zitat: string; quelle: "kunde" | "rueckfrage" }
  | { art: "unklar"; grund: UnklarGrund; zitat: string };

// ── Datum (JJJJ-MM-TT, UTC-Mittag — keine Zeitzonenfalle) ────────────────
const iso = (j: number, m: number, t: number): string | null => {
  const d = new Date(Date.UTC(j, m - 1, t, 12));
  return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t ? d.toISOString().slice(0, 10) : null;
};
export function plusTage(tag: string, n: number): string {
  const [j, m, t] = tag.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t + n, 12)).toISOString().slice(0, 10);
}
const wochentag = (tag: string) => new Date(`${tag}T12:00:00Z`).getUTCDay(); // 0 = Sonntag
const letzterDesMonats = (j: number, m: number) => new Date(Date.UTC(j, m, 0, 12)).toISOString().slice(0, 10);
export function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}
const WOCHENTAGE = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
/** „Freitag, 23.10.“ — so liest der Kunde den Tag. */
export function tagText(tag: string): string {
  const [, m, t] = tag.split("-");
  const w = WOCHENTAGE[wochentag(tag)];
  return `${w[0].toUpperCase()}${w.slice(1)}, ${t}.${m}.`;
}

// ── Wörter ────────────────────────────────────────────────────────────────
const L = String.raw`(?<![\p{L}])`;
const R = String.raw`(?![\p{L}])`;
/** Er will zahlen: ein Zahlwort im Präsens/Futur (Partizipien wie „überwiesen“ zählen nicht). */
const ZAHL_VERB = new RegExp(`${L}(?:(?:be|ein)?zahl(?:e|en|t|st)|(?:ü|ue)berweis(?:e|en|t|ung)|begleich(?:e|en|t)?|ausgleich(?:e|en)|`
  + String.raw`(?:zahlung|rate|betrag|geld|gehalt|lohn|rente|summe)\s+(?:kommt|folgt|erfolgt|geht\s+raus|ist\s+(?:da|drauf|unterwegs)))${R}`, "iu");
const VERGANGEN_HILF = new RegExp(`${L}(?:habe|hab|hatte|haben|hätte|wurde|wurden|worden|bereits|schon|gestern|vorhin)${R}`, "iu");
const VERGANGEN_PART = new RegExp(`${L}(?:bezahlt|gezahlt|(?:ü|ue)berwiesen|beglichen|ausgeglichen|eingezahlt)${R}`, "iu");
const FUTUR = new RegExp(`${L}(?:werde|werden|wird)${R}`, "iu");
const NEIN = new RegExp(`${L}(?:nicht|kein|keine|keinen|keinem|nie|niemals|weder)${R}`, "iu");
/** „Keine Sorge“, „kein Problem“, „nicht später als …“ — Floskeln, keine Verneinung des Zahltags. */
const FLOSKEL = new RegExp(String.raw`${L}(?:kein(?:e|en)?\s+(?:sorge|sorgen|problem|thema|stress|angst)|nicht\s+(?:vergessen|wahr|fr(?:ü|ue)her|eher|vorher|sp(?:ä|ae)ter)(?:\s+als)?)${R}`, "giu");
const verneint = (t: string) => NEIN.test(String(t ?? "").replace(FLOSKEL, " "));
/** Eine Frage, die einen Tag VORSCHLÄGT („Kann ich auch am Freitag zahlen?“) — sonst ist eine Frage unklar. */
const VORSCHLAG_FRAGE = new RegExp(`${L}(?:kann|darf|könnte|koennte|dürfte|duerfte|reicht|passt|geht|ok|okay|in\\s+ordnung)${R}`, "iu");
/** Wörter eines Termins oder Anrufs — ein Tag daneben ist kein Zahltag. */
const TERMIN_WORT = new RegExp(`${L}(?:termin\\w*|anruf\\w*|r(?:ü|ue)ckruf\\w*|zur(?:ü|ue)ckrufen|telefon\\w*|gespr(?:ä|ae)ch\\w*|uhr)${R}`, "iu");
const KONTRAST = new RegExp(String.raw`[,–-]?\s+(?:aber|sondern|jedoch|doch|dafür|dafuer|allerdings)${R}\s*`, "iu");
const KURZES_JA = new RegExp(`^\\s*(?:ja|jo|jep|jawohl|genau|richtig|stimmt|korrekt|gern|gerne|ok|okay|passt|einverstanden)${R}`, "iu");

const MONATE: [RegExp, number][] = [
  [/^j(?:a|ä)n(?:uar)?$|^jänner$/i, 1], [/^feb(?:ruar)?$/i, 2], [/^m(?:ä|ae)rz$|^m(?:ä|ae)r$/i, 3], [/^apr(?:il)?$/i, 4],
  [/^mai$/i, 5], [/^jun(?:i)?$/i, 6], [/^jul(?:i)?$/i, 7], [/^aug(?:ust)?$/i, 8], [/^sep(?:t|tember)?$/i, 9],
  [/^okt(?:ober)?$/i, 10], [/^nov(?:ember)?$/i, 11], [/^dez(?:ember)?$/i, 12],
];
const MONAT_MUSTER = String.raw`januar|jänner|jan|februar|feb|märz|maerz|mär|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|dezember|dez`;
const monatNr = (w: string) => MONATE.find(([r]) => r.test(w.replace(/\.$/, "")))?.[1] ?? null;

/** Jahr zu Tag und Monat ohne Jahr: dieses, außer der Tag liegt weit zurück (dann das nächste). */
function mitJahr(t: number, m: number, bezug: string, jahr?: number | null): string | null {
  const j0 = jahr ?? Number(bezug.slice(0, 4));
  const d = iso(j0, m, t);
  if (!d) return null;
  if (jahr == null && tageZwischen(d, bezug) > 180) return iso(j0 + 1, m, t);
  return d;
}

/** Die Satzteile seiner Nachricht — ein Punkt hinter einer Ziffer („23.10.“) oder einer Abkürzung trennt nicht. */
export function saetzeZerlegen(text: string): { text: string; frage: boolean }[] {
  const t = String(text ?? "").replace(/\r/g, "").replace(/[ \t\u00a0]+/g, " ");
  const aus: { text: string; frage: boolean }[] = [];
  let start = 0;
  const abk = new RegExp(String.raw`(?:^|[^\p{L}])(?:z|b|bzw|ca|evtl|ggf|usw|nr|str|inkl|zzgl|d|h|u|a|vgl|bspw|tel|mo|di|mi|do|fr|sa)$`, "iu");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    let ende = c === "\n" || c === "!" || c === "?" || c === ";";
    if (c === ".") {
      const vor = t.slice(Math.max(0, i - 8), i);
      const rest = t.slice(i + 1);
      ende = !/\d$/.test(vor) && !abk.test(vor) && (/^\s+[A-ZÄÖÜ]/.test(rest) || /^\s*$/.test(rest));
    }
    if (ende) {
      const s = t.slice(start, i + 1).trim();
      if (s) aus.push({ text: s, frage: c === "?" });
      start = i + 1;
    }
  }
  const s = t.slice(start).trim();
  if (s) aus.push({ text: s, frage: false });
  return aus;
}

interface Ausdruecke { tage: string[]; ohneMonat: boolean; vage: boolean }

/** Alle Tagesangaben in einem Satzteil — bezogen auf den Tag, an dem er schrieb. Rein. */
export function tagesangaben(teil: string, bezug: string): Ausdruecke {
  // „Guten Morgen“ ist ein Gruß, kein Zahltag.
  let x = ` ${String(teil ?? "").toLowerCase()} `.replace(/(?:guten|sch(?:ö|oe)nen|einen\s+sch(?:ö|oe)nen)\s+(?:morgen|tag|abend)/gi, " · ");
  const tage: string[] = [];
  let ohneMonat = false, vage = false;
  const weg = (m: string) => { x = x.replace(m, " · "); };

  // 1. 23.10. / 23.10.2026 / 23. 10. — nie eine Uhrzeit, ein Betrag oder ein Prozentwert.
  for (const m of Array.from(x.matchAll(/(?<![\d.,])(\d{1,2})\.\s?(\d{1,2})(?:\.(?:\s?(\d{4})|(\d{2}))?)?(?![\d,])(?!\s*(?:uhr|h\b|€|eur|euro|prozent|%))/g))) {
    const j = m[3] ? Number(m[3]) : m[4] ? 2000 + Number(m[4]) : null;
    const d = Number(m[2]) >= 1 && Number(m[2]) <= 12 ? mitJahr(Number(m[1]), Number(m[2]), bezug, j) : null;
    if (d) { tage.push(d); weg(m[0]); }
  }
  // 2. 23. Oktober / 23 okt 2026
  for (const m of Array.from(x.matchAll(new RegExp(String.raw`(?<![\d])(\d{1,2})\.?\s*(${MONAT_MUSTER})\.?(?:\s+(\d{4}))?${R}`, "giu")))) {
    const mon = monatNr(m[2]);
    const d = mon ? mitJahr(Number(m[1]), mon, bezug, m[3] ? Number(m[3]) : null) : null;
    if (d) { tage.push(d); weg(m[0]); }
  }
  // 3. Monatsende / Ende des Monats / Ende Oktober / Ende nächsten Monats
  const bj = Number(bezug.slice(0, 4)), bm = Number(bezug.slice(5, 7));
  for (const m of Array.from(x.matchAll(new RegExp(String.raw`${L}(?:zum\s+)?(?:monatsende|ende\s+(?:des\s+|diese[sn]\s+)?monats|ende\s+(?:des\s+)?(n(?:ä|ae)chsten|kommenden)\s+monats|ende\s+(${MONAT_MUSTER}))${R}`, "giu")))) {
    if (m[1]) tage.push(letzterDesMonats(bm === 12 ? bj + 1 : bj, bm === 12 ? 1 : bm + 1));
    else if (m[2]) { const mon = monatNr(m[2])!; tage.push(letzterDesMonats(mon < bm ? bj + 1 : bj, mon)); }
    else tage.push(letzterDesMonats(bj, bm));
    weg(m[0]);
  }
  // 4. in drei Tagen / in zwei Wochen
  const ZAHL: Record<string, number> = { ein: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, vierzehn: 14 };
  for (const m of Array.from(x.matchAll(new RegExp(String.raw`${L}in\s+(\d{1,2}|ein|einem|einer|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|vierzehn)\s+(tag|tagen|woche|wochen)${R}`, "giu")))) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : ZAHL[m[1]];
    if (n) { tage.push(plusTage(bezug, /^woche/.test(m[2]) ? n * 7 : n)); weg(m[0]); }
  }
  // 5. heute / morgen / übermorgen („heute morgen“ ist heute, „morgen früh“ ist morgen)
  if (new RegExp(`${L}(?:ü|ue)bermorgen${R}`, "iu").test(x)) { tage.push(plusTage(bezug, 2)); x = x.replace(/(?:ü|ue)bermorgen/gi, " · "); }
  if (new RegExp(`${L}heute${R}`, "iu").test(x)) { tage.push(bezug); x = x.replace(/heute(?:\s+(?:morgen|früh|frueh|abend|nachmittag|mittag|noch))?/gi, " · "); }
  if (new RegExp(`${L}morgen${R}`, "iu").test(x)) { tage.push(plusTage(bezug, 1)); x = x.replace(/morgen/gi, " · "); }
  // 6. Wochentage — „nächste Woche Mittwoch“ ist in der nächsten Kalenderwoche, sonst der nächste solche Tag.
  const naechsteWoche = new RegExp(String.raw`${L}(?:n(?:ä|ae)chste[nrs]?|kommende[nrs]?)\s+woche${R}`, "iu").test(x);
  const dieseWoche = new RegExp(String.raw`${L}(?:diese[nrs]?)\s+woche${R}`, "iu").test(x);
  for (const m of Array.from(x.matchAll(new RegExp(String.raw`${L}(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo\.|di\.|mi\.|do\.|fr\.|sa\.)(?:s|abend|vormittag|nachmittag|mittag)?${R}`, "giu")))) {
    const kurz = m[1].replace(".", "");
    const ziel = WOCHENTAGE.findIndex((w) => w.startsWith(kurz));
    if (ziel < 0) continue;
    const wb = wochentag(bezug);
    const isoB = wb === 0 ? 7 : wb, isoZ = ziel === 0 ? 7 : ziel;
    if (naechsteWoche) tage.push(plusTage(bezug, 7 - isoB + isoZ));
    else if (dieseWoche) { if (isoZ >= isoB) tage.push(plusTage(bezug, isoZ - isoB)); else vage = true; }
    else { const d = (ziel - wb + 7) % 7; tage.push(plusTage(bezug, d === 0 ? 7 : d)); }
    weg(m[0]);
  }
  // 7. Ohne Monat („am 15.“, „zum 1.“, „zahlen an 1“) und vage Angaben — unklar, Mara fragt nach.
  if (new RegExp(String.raw`${L}(?:am|an|bis|zum|ab|den)\s+(?:dem\s+)?\d{1,2}(?:\.|${R})(?!\s*[\d.,])(?!\s*(?:uhr|h\b|€|eur|euro|tage|wochen|monat))`, "iu").test(x)) ohneMonat = true;
  if (!naechsteWoche || !tage.length) {
    if (new RegExp(String.raw`${L}(?:n(?:ä|ae)chste[nrs]?\s+(?:woche|monat)|kommende[nrs]?\s+(?:woche|monat)|anfang\s+(?:der\s+|des\s+|n(?:ä|ae)chste[nrs]?\s+)?(?:woche|monat\w*)|monatsanfang|mitte\s+(?:der\s+|des\s+|n(?:ä|ae)chste[nrs]?\s+)?(?:woche|monat\w*)|ende\s+der\s+woche|wochenende|in\s+den\s+n(?:ä|ae)chsten\s+tagen|demn(?:ä|ae)chst|bald(?:igst|m(?:ö|oe)glichst)?|zeitnah|sobald|so\s+schnell\s+wie\s+m(?:ö|oe)glich|asap|wenn\s+(?:mein|das|der|die)\s+(?:gehalt|geld|lohn|rente))${R}`, "iu").test(x)) vage = true;
  }
  return { tage: Array.from(new Set(tage)), ohneMonat, vage };
}

const zitatAus = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 160);
/** Höchstens zwölf Wörter — „Am Freitag.“, „Mach ich am Freitag, danke!“ (Gruß und Name eingerechnet). */
const kurzeAntwort = (t: string) => String(t ?? "").trim().split(/\s+/).filter(Boolean).length <= 12;
/** Er will etwas anderes (Rechnung schicken, Link, Karte, Adresse …) — dann ist ein Tag daneben kein Zahltag. */
const ANDERER_WUNSCH = new RegExp(String.raw`${L}(?:schick\w*|send\w*|rechnung\w*|beleg\w*|link\w*|karte\w*|adresse\w*|unterlagen|k(?:ü|ue)ndig\w*|storn\w*|widerruf\w*|frage\w*)${R}`, "iu");

/**
 * Nennt er einen Zahltag? Rein.
 *   · `bezug` — der Tag (JJJJ-MM-TT, Berlin), an dem er schrieb.
 *   · `zahlFrage` — er antwortet auf eine Frage nach dem Zahltag (Betreff seiner Rate, „wann Sie zahlen“): Dann reicht
 *     eine kurze Antwort aus nur einem Tag („Am Freitag.“) — auch ohne Zahlwort.
 *   · `letzteMara` — Maras letzte Antwort: Bestätigt er ihre Rückfrage („Meinen Sie Freitag, den 23.10.?“ → „Ja“), gilt
 *     ihr Tag.
 * null = kein Zahltag (keine Zusage, Vergangenheit, „habe überwiesen“, „kann nicht zahlen“ ohne Tag).
 */
export function zahltagErkennen(text: string, bezug: string, opt: { zahlFrage?: boolean; letzteMara?: string | null } = {}): ZahltagErkennung | null {
  const roh = String(text ?? "").trim();
  if (!roh || !/^\d{4}-\d{2}-\d{2}$/.test(bezug)) return null;
  const tage: { datum: string; zitat: string }[] = [];
  const unklar: { grund: UnklarGrund; zitat: string }[] = [];
  for (const s of saetzeZerlegen(roh)) {
    if (!ZAHL_VERB.test(s.text)) continue;
    if (VERGANGEN_HILF.test(s.text) && VERGANGEN_PART.test(s.text) && !FUTUR.test(s.text)) continue;
    for (const teil of s.text.split(KONTRAST)) {
      const a = tagesangaben(teil, bezug);
      if (!a.tage.length && !a.ohneMonat && !a.vage) continue;
      if (verneint(teil)) { unklar.push({ grund: "verneint", zitat: zitatAus(s.text) }); continue; }
      if (s.frage && !VORSCHLAG_FRAGE.test(s.text)) { unklar.push({ grund: "frage", zitat: zitatAus(s.text) }); continue; }
      if (a.tage.length) tage.push(...a.tage.map((datum) => ({ datum, zitat: zitatAus(s.text) })));
      else unklar.push({ grund: a.ohneMonat ? "ohne_monat" : "vage", zitat: zitatAus(s.text) });
    }
  }
  // Kurze Antwort auf „wann zahlen Sie?“ — ein Tag, kein Termin, keine Verneinung.
  if (!tage.length && !unklar.length && opt.zahlFrage && kurzeAntwort(roh) && !verneint(roh) && !TERMIN_WORT.test(roh)
    && !ANDERER_WUNSCH.test(roh) && !(VERGANGEN_HILF.test(roh) && VERGANGEN_PART.test(roh))) {
    const a = tagesangaben(roh, bezug);
    if (a.tage.length) tage.push(...a.tage.map((datum) => ({ datum, zitat: zitatAus(roh) })));
    else if (a.ohneMonat || a.vage) unklar.push({ grund: a.ohneMonat ? "ohne_monat" : "vage", zitat: zitatAus(roh) });
  }
  // „Die Rate vom 18.10. zahle ich am 23.10.“ — ein vergangener Tag neben einem künftigen ist der Rückbezug.
  const alle = Array.from(new Set(tage.map((t) => t.datum)));
  const kuenftig = alle.filter((d) => d >= bezug);
  const verschieden = kuenftig.length ? kuenftig : alle;
  if (verschieden.length === 1) return { art: "tag", datum: verschieden[0], zitat: tage.find((t) => t.datum === verschieden[0])!.zitat, quelle: "kunde" };
  if (verschieden.length > 1) return { art: "unklar", grund: "mehrere", zitat: tage[0].zitat };
  // „Ja“ auf Maras Rückfrage mit genau einem Tag.
  if (!unklar.length && opt.letzteMara && KURZES_JA.test(roh) && roh.length <= 200 && !verneint(roh)) {
    const fragen = saetzeZerlegen(String(opt.letzteMara)).filter((s) => s.frage);
    const letzte = fragen[fragen.length - 1];
    if (letzte && !TERMIN_WORT.test(letzte.text)) {
      const a = tagesangaben(letzte.text, bezug);
      if (a.tage.length === 1 && !a.ohneMonat) return { art: "tag", datum: a.tage[0], zitat: zitatAus(roh), quelle: "rueckfrage" };
    }
  }
  if (!unklar.length) return null;
  const rang: UnklarGrund[] = ["ohne_monat", "vage", "frage", "verneint"];
  unklar.sort((a, b) => rang.indexOf(a.grund) - rang.indexOf(b.grund));
  return { art: "unklar", grund: unklar[0].grund, zitat: unklar[0].zitat };
}

/** Antwortet er auf eine Frage nach dem Zahltag? Betreff seiner Rate oder Maras „wann … zahlen“. Rein. */
export function zahlFrage(betreff: string | null | undefined, letzteMara: string | null | undefined): boolean {
  return /kurz\s+von\s+mara\b[^\n]{0,40}\bmonatsrate/i.test(String(betreff ?? ""))
    || /\bwann\b[^?]{0,80}(?:zahl\w*|(?:ü|ue)berweis\w*)[^?]{0,80}\?/i.test(String(letzteMara ?? ""));
}

/** Darf der Server in dieser Lage einen Zahltag festhalten? Nie bei Bestreiten, Widerruf, Anwalt, Recht, Global. Rein. */
export function zusageErlaubt(e: { lage: string; flags?: Record<string, unknown> | null; global?: boolean; vorgeschichte?: boolean }): boolean {
  const f = e.flags ?? {};
  return ZUSAGE_LAGEN.includes(e.lage) && !e.global && !e.vorgeschichte
    && !f.bestreitet && !f.widerruf && !f.droht_anwalt && !f.rechtlich;
}

// ── Das Urteil ────────────────────────────────────────────────────────────
/** Eine offene, geschuldete Rate seiner Bestellungen (der Server liest sie mit FORDERUNG_AKTIV_SQL_FUER). */
export interface ZusageRate { id: number; nr: number; ref: string; faellig: string; zusage: string | null; cents?: number }

export type ZusageUrteil =
  | { art: "merken"; datum: string; raten: ZusageRate[]; schon: boolean }
  | { art: "unklar"; grund: UnklarGrund }
  | { art: "vergangen"; datum: string }
  | { art: "zu_weit"; datum: string }
  | { art: "keine_rate" }
  | { art: "puenktlich"; datum: string; naechste: ZusageRate };

/** Was mit seinem Zahltag geschieht. `heute` = jetzt (Berlin). Rein. */
export function zusageUrteil(e: { erkennung: ZahltagErkennung | null; heute: string; raten: ZusageRate[]; personZusage: string | null }): ZusageUrteil | null {
  if (!e.erkennung) return null;
  const raten = [...e.raten].sort((a, b) => a.faellig.localeCompare(b.faellig) || a.nr - b.nr);
  if (!raten.length) return { art: "keine_rate" };
  if (e.erkennung.art === "unklar") return { art: "unklar", grund: e.erkennung.grund };
  const datum = e.erkennung.datum;
  if (datum < e.heute) return { art: "vergangen", datum };
  if (tageZwischen(e.heute, datum) > ZUSAGE_HOECHSTENS_TAGE) return { art: "zu_weit", datum };
  const ziel = raten.filter((r) => r.faellig <= datum);
  if (!ziel.length) return { art: "puenktlich", datum, naechste: raten[0] };
  const schon = String(e.personZusage ?? "").slice(0, 10) === datum && ziel.every((r) => String(r.zusage ?? "").slice(0, 10) === datum);
  return { art: "merken", datum, raten: ziel, schon };
}

// ── Was Mara sagt ─────────────────────────────────────────────────────────
/** Der eine Satz, mit dem Mara den festgehaltenen Tag bestätigt. */
export function zusageSatz(datum: string): string {
  return `Danke — ich habe mir Ihren Zahltag notiert: ${tagText(datum)}`;
}

const UNKLAR_TEXT: Record<UnklarGrund, string> = {
  ohne_monat: "Er nennt einen Tag ohne Monat",
  vage: "Er nennt keinen genauen Tag",
  frage: "Er fragt nach dem Tag, statt ihn zu nennen",
  verneint: "Er schreibt, an welchem Tag er NICHT zahlen kann",
  mehrere: "Er nennt mehrere Tage",
};

/** Der Block für Maras Auftrag (vorab). Rein. */
export function zusageHinweis(u: ZusageUrteil, erk?: ZahltagErkennung | null): string {
  const kopf = `ZAHLTAG (${ZUSAGE_WERKZEUG} ist gelaufen — der Server hat seine Mail gelesen; nicht noch einmal fragen, was hier steht):`;
  const keineRuhe = "Versprich NICHT, dass bis dahin keine Erinnerung kommt — Rechnung und automatische Erinnerungen laufen weiter.";
  const zitat = erk?.zitat ? ` Seine Worte: „${erk.zitat}“.` : "";
  switch (u.art) {
    case "merken": {
      const raten = u.raten.map((r) => `Rate ${r.nr} (fällig ${r.faellig.split("-").reverse().join(".")})`).join(", ");
      return `${kopf} FESTGEHALTEN${u.schon ? " (stand schon so in der Akte)" : ""}: Er zahlt ${raten} am ${tagText(u.datum)}${zitat} `
        + `SO ANTWORTEST DU: Danke ihm herzlich und bestätige den Tag in einem Satz: „${zusageSatz(u.datum)}“ Keine Bitte, HEUTE zu zahlen — er hat seinen Tag genannt. `
        + `Die Zahlungsseite (Knopf) gibst du ihm für diesen Tag mit, mit Betrag und Verwendungszweck. Kein Termin nötig. ${keineRuhe}`;
    }
    case "unklar":
      return `${kopf} NICHT FESTGEHALTEN — ${UNKLAR_TEXT[u.grund]}.${zitat} SO ANTWORTEST DU: Frag ihn freundlich in EINEM Satz nach dem genauen Tag — `
        + `mit Wochentag und Datum als Frage, so: „Meinen Sie [Wochentag], den [TT.MM.]?“ (mit SEINEM Tag). Sagt er Ja, hält der Server ihn fest. `
        + `Schreib NICHT „notiert“ oder „festgehalten“. ${keineRuhe}`;
    case "vergangen":
      return `${kopf} NICHT FESTGEHALTEN — der Tag, den er nannte (${tagText(u.datum)}), ist schon vorbei.${zitat} Frag freundlich, ob seine Zahlung unterwegs ist, und gib ihm die Zahlungsseite. Schreib NICHT „notiert“.`;
    case "zu_weit":
      return `${kopf} NICHT FESTGEHALTEN — ${tagText(u.datum)} ist mehr als ${ZUSAGE_HOECHSTENS_TAGE} Tage entfernt; das ist eine Pause, kein Zahltag.${zitat} `
        + `Sag keine Pause und keine Stundung zu. Biete ihm einen Rückruf an (terminlink_bauen) — am Telefon findet sein Betreuer mit ihm gemeinsam eine Lösung. Schreib NICHT „notiert“.`;
    case "keine_rate":
      return `${kopf} NICHTS FESTZUHALTEN — er hat keine offene Rate.${zitat} Danke ihm; keine Zahlungsbitte für eine Rate. Schreib NICHT „notiert“.`;
    case "puenktlich":
      return `${kopf} NICHTS FESTZUHALTEN — seine nächste Rate (Rate ${u.naechste.nr}) ist erst am ${u.naechste.faellig.split("-").reverse().join(".")} fällig; ${tagText(u.datum)} ist vorher.${zitat} Danke ihm — er ist pünktlich. Schreib NICHT „notiert“.`;
  }
}

/** Für werkzeugDaten und den Prüfstand. Rein. */
export function zusageKurz(u: ZusageUrteil): Record<string, unknown> {
  return u.art === "merken" ? { art: u.art, datum: u.datum, raten: u.raten.map((r) => r.nr), schon: u.schon }
    : u.art === "unklar" ? { art: u.art, grund: u.grund }
    : u.art === "keine_rate" ? { art: u.art }
    : u.art === "puenktlich" ? { art: u.art, datum: u.datum, naechste: u.naechste.nr }
    : { art: u.art, datum: u.datum };
}

/** Die Zeile für die Handlungsliste der Postmeister-Zeile. Rein. */
export function zusageHandlung(u: ZusageUrteil, o: { geschrieben: boolean }): string {
  switch (u.art) {
    case "merken": return `${ZUSAGE_WERKZEUG}: ${o.geschrieben ? "festgehalten" : "stand schon"} — zahlt ${u.raten.map((r) => `Rate ${r.nr}`).join(", ")} am ${tagText(u.datum)} (Akte, Inkasso „Zusagen“, Wiedervorlage danach)`;
    case "unklar": return `${ZUSAGE_WERKZEUG}: nicht festgehalten (${UNKLAR_TEXT[u.grund]}) — Mara fragt nach`;
    case "vergangen": return `${ZUSAGE_WERKZEUG}: nicht festgehalten (${tagText(u.datum)} ist vorbei)`;
    case "zu_weit": return `${ZUSAGE_WERKZEUG}: nicht festgehalten (${tagText(u.datum)} — mehr als ${ZUSAGE_HOECHSTENS_TAGE} Tage, Rückruf angeboten)`;
    case "keine_rate": return `${ZUSAGE_WERKZEUG}: nichts festzuhalten (keine offene Rate)`;
    case "puenktlich": return `${ZUSAGE_WERKZEUG}: nichts festzuhalten (Rate ${u.naechste.nr} ist erst später fällig)`;
  }
}

/**
 * „Gerade schwierig diesen Monat?“ — die Fußnote der Raten-Mail führt zum Rückruf. Schreibt er stattdessen „kann nicht
 * zahlen“ per Mail und nennt keinen Tag, bietet Mara denselben Weg an: Eine Ratenpause setzt per Mail niemand von selbst,
 * am Telefon findet sein Betreuer mit ihm die Lösung (im Inkasso ist die Pause ein Klick). Rein.
 */
export function schwierigHinweis(): string {
  return "ER KANN GERADE NICHT ZAHLEN: keine Zahlungsbitte, kein Druck. Zeig Verständnis und biete ihm einen Rückruf an (terminlink_bauen — er wählt "
    + "selbst seine Zeit): Am Telefon findet sein Betreuer mit ihm gemeinsam eine Lösung. Sag keine Pause, Stundung oder Verschiebung zu — "
    + "das entscheidet ihr am Telefon. Nennt er einen Tag, an dem es wieder geht, hält der Server ihn fest.";
}

// ── Die Antwortprüfung ───────────────────────────────────────────────────
const BEHAUPTET = new RegExp(String.raw`${L}(?:notiert|notiere|festgehalten|halte\b[^.!?\n]{0,50}\bfest|vorgemerkt|merke\s+mir|gemerkt|eingetragen|trage\b[^.!?\n]{0,50}\bein|gespeichert|vermerkt)${R}`, "iu");
const ZAHLTAG_WORT = new RegExp(String.raw`${L}(?:zahltag|zahlungstag|zahlungsdatum|zahlungstermin|zahlungszusage|ihre\s+zusage)${R}`, "iu");
const ANDERES_DING = new RegExp(String.raw`${L}(?:termin\w*|gespr(?:ä|ae)ch\w*|r(?:ü|ue)ckruf\w*|anruf\w*|telefon\w*|uhr|adresse|anschrift|e-?mail\w*|nummer|unterlagen|k(?:ü|ue)ndigung\w*|widerruf\w*|werbe\w*|abmeld\w*|eingang|eingegangen|gefunden|gemeldet|zahlungsmeldung|beleg\w*|kontoauszug\w*)${R}`, "iu");
const KEINE_ERINNERUNG = new RegExp(String.raw`${L}(?:keine|nicht\s+mehr)\s+(?:weitere[nr]?\s+|neue[nr]?\s+)?(?:zahlungs)?(?:erinnerung|mahnung)\w*|${L}(?:erinnerung|mahnung)\w*\s+(?:\S+\s+){0,3}?(?:pausier\w*|ruh\w*|aus(?:gesetzt|setzen)|gestoppt|angehalten)${R}`, "iu");

/**
 * Mängel der Antwort rund um den Zahltag (fehlend → zweiter Entwurf, hält er sie nicht: Entwurf). Rein.
 *   · „notiert/festgehalten“ zu einem Tag, den der Server NICHT festgehalten hat (auch ohne Lage: dann hat niemand etwas
 *     festgehalten);
 *   · bei festgehaltenem Tag: ein anderes Datum im selben Satz;
 *   · „bis dahin keine Erinnerung“ — Rechnung und Mahnungen laufen weiter (nur, wenn ein Zahltag Thema war).
 */
export function zusageAntwortFunde(text: string, u: ZusageUrteil | null, bezug?: string): string[] {
  const funde: string[] = [];
  const heute = bezug ?? new Date().toISOString().slice(0, 10);
  for (const s of saetzeZerlegen(text)) {
    if (!BEHAUPTET.test(s.text) || ANDERES_DING.test(s.text) || s.frage) continue;
    const a = tagesangaben(s.text, heute);
    if (!ZAHLTAG_WORT.test(s.text) && !a.tage.length) continue;
    if (!u || u.art !== "merken") {
      funde.push(`Die Antwort sagt, sein Zahltag sei notiert („${zitatAus(s.text).slice(0, 90)}“) — festgehalten ist nichts${u ? ` (${u.art === "unklar" ? UNKLAR_TEXT[u.grund].toLowerCase() : u.art === "zu_weit" ? "mehr als einen Monat entfernt" : u.art === "vergangen" ? "der Tag ist vorbei" : "keine offene Rate, die bis dahin fällig ist"})` : ""}. ${u?.art === "unklar" ? "Frag nach dem genauen Tag." : "Nimm den Satz heraus."}`);
      continue;
    }
    const numerisch = Array.from(s.text.matchAll(/(?<![\d.,])(\d{1,2})\.\s?(\d{1,2})\.(?:\s?\d{2,4})?/g))
      .map((m) => `${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`);
    if (numerisch.some((md) => md !== u.datum.slice(5))) funde.push(`Die Antwort nennt einen anderen Tag als den festgehaltenen (${tagText(u.datum)}) — nimm genau diesen Satz: „${zusageSatz(u.datum)}“`);
  }
  if (u) {
    const ruhe = String(text ?? "").match(KEINE_ERINNERUNG);
    if (ruhe) funde.push(`„${ruhe[0]}“ — Rechnung und automatische Erinnerungen laufen weiter; versprich keine Ruhe bis zum Zahltag`);
  }
  return funde;
}
