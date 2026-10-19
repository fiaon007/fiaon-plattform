// ═══════════════════════════════════════════════════════════════════════════
// DER GENANNTE TERMIN — Mara erkennt einen Termin, den der Kunde mit uns hat (19.10.2026, E-395)
//
// Der Anlass (Person 11521, Mail #7131): „ja bitte stornieren, wir haben heute um 11.00 uhr ein neues
// gespräch für einen firmenkredit.“ Daniel hatte am 16.10. notiert: „telefoniert am Montag 11 Uhr mit
// Justin.“ Mara hatte die Notiz vor sich, verband sie nicht mit „heute 11 Uhr“, trug nichts ein und
// schloss mit einem Verkaufssatz zur Visa-Karte. Justin: „Mara muss ab jetzt in mein Kalender den Termin
// eintragen, den Kunden einen guten Termin wünschen und sich zurücknehmen.“
//
// Hier steht nur die ERKENNUNG — rein, ohne Datenbank, im Prüfstand geprüft
// (scripts/pruef-mara-genannter-termin.ts). Eintragen tut der Server
// (server/lib/fiaon-mara-genannter-termin.ts), nie das Modell.
//
// Die Arten:
//   keiner       — kein Termin genannt (oder ein Rückrufwunsch: der läuft wie bisher über rueckruf_am)
//   vergangen    — der genannte Zeitpunkt ist vorbei („hatte gestern um 11 ein Gespräch“)
//   steht_schon  — für diese Zeit (±30 Min.) steht schon ein gebuchter Termin der Person
//   mit_uns      — belegt durch eine Team-Notiz mit derselben Uhrzeit ODER der Kunde sagt „mit Ihnen /
//                  Ihrem Berater / Herrn Stripling / FIAON / Justin“
//   dritte       — er nennt eine Bank, einen Notar, Anwalt … und keine Team-Notiz passt
//   unklar       — eine Uhrzeit mit Gesprächswort, aber weder Beleg noch Dritte
// ═══════════════════════════════════════════════════════════════════════════
import { uhrzeitenIn } from "./fiaon-mara-ton";

export interface TeamNotiz {
  am: string | Date;
  text: string;
  agentId: number | null;
  agentName: string | null;
}
export interface TerminMitarbeiter {
  id: number;
  vorname: string | null;
  nachname: string | null;
}
export interface BestehenderTerminKurz {
  id: number;
  /** Absoluter Zeitpunkt (ISO) oder Date. */
  beginn: string | Date;
  agentId: number;
  status: string;
}
export type GenanntArt = "keiner" | "vergangen" | "steht_schon" | "mit_uns" | "dritte" | "unklar";

export interface GenanntErgebnis {
  art: GenanntArt;
  /** Berliner Wandzeit „YYYY-MM-DD HH:MM“ — oder null, wenn kein Tag/keine Uhrzeit feststeht. */
  wandzeit: string | null;
  /** „11:00“ */
  uhrzeit: string | null;
  /** Woher wissen wir, dass es unser Termin ist? */
  beleg: "notiz" | "kunde" | null;
  notiz: TeamNotiz | null;
  /** Der Mitarbeiter, den Notiz oder Kunde nennen („mit Justin“ → 928) — sonst null (der Server wählt). */
  teilnehmerId: number | null;
  /** Firmenkredit, Firma, Global … → Gespräch für FIAON Global. */
  thema: "global" | null;
  bestehend: BestehenderTerminKurz | null;
  grund: string;
}

/** Interne Konten, deren Notizen kein Beleg sind (Automatik, Mara selbst). */
const AUTOMATIK_NAMEN = /^(system|postmeister|mara|admin|tageslauf|kunde|fiaon|fiaon ltd|zahlungspost|ki-assistent)\b/i;

/** Gesprächswörter — ohne sie ist eine Uhrzeit kein Termin („um 11 Uhr überwiesen“). */
const GESPRAECH = /\b(termin\w*|gespr[äa]ch\w*|telefonat\w*|telefonier\w*|sprechen|besprechen|call|meeting|besprechung|treffen|videocall|zoom|teams-?call|beratung(?:sgespr[äa]ch)?|appointment)\b/i;
/** Ein Rückrufwunsch („rufen Sie mich um 17 Uhr an“) ist KEIN vereinbarter Termin — er läuft über rueckruf_am. */
const RUECKRUF_WUNSCH = /\b(rufen\s+sie\s+mich|ruf(?:t|en)?\s+mich|bitte\s+um\s+(?:einen\s+)?r[üu]ckruf|r[üu]ckruf\s+(?:bitte|w[üu]nsch)|k[öo]nn(?:t)?en\s+sie\s+mich\s+[^.?!]{0,40}anrufen|call\s+me|please\s+call)\b/i;
/** Zeichen, dass das Gespräch schon vereinbart ist (nicht erst gewünscht). */
const VEREINBART = /\b(wir\s+haben|ich\s+habe|habe\s+(?:ich\s+)?(?:heute|morgen|am)|haben\s+(?:heute|morgen|am)|ist\s+(?:vereinbart|ausgemacht|geplant)|vereinbart|ausgemacht|abgesprochen|telefonier(?:e|en)\s+(?:heute|morgen|am|um)|sprechen\s+(?:heute|morgen|am|um|uns)|steht|i\s+have|we\s+have)\b/i;
/** Er sagt, mit wem: mit uns. */
const MIT_UNS = /\bmit\s+(?:ihnen|euch|dir|ihrem\s+(?:berater|kollegen|team|chef|gesch[äa]ftsf[üu]hrer)|ihrer\s+(?:beraterin|kollegin)|dem\s+(?:berater|gesch[äa]ftsf[üu]hrer|gr[üu]nder)\s+von\s+fiaon|fiaon|herrn?\s+schwarzott|justin)\b|\bwith\s+(?:you|your\s+(?:advisor|colleague|team)|fiaon|mr\.?\s+schwarzott|justin)\b/i;
/** Dritte — ein Gespräch, das nicht uns gehört. */
const DRITTE = /\b(bank|hausbank|sparkasse|volksbank|raiffeisen\w*|ubs|postfinance|credit\s+suisse|commerzbank|deutsche\s+bank|ing\b|dkb|notar\w*|anwalt|anw[äa]lt\w*|rechtsanw\w*|steuerberat\w*|treuh[äa]nd\w*|treuhand|arzt|[äa]rztin|amt\b|beh[öo]rde|jobcenter|finanzamt|gericht|schuldnerberat\w*|makler\w*|versicherung)\b/i;
/** Firmenthema → FIAON Global. */
const GLOBAL_THEMA = /\b(firmenkredit\w*|gesch[äa]ftskredit\w*|unternehmens\w*|firma|firmen\w*|gmbh|ag\b|business|global|betrieb\w*|kmu|startkapital|investor\w*)\b/i;
/**
 * Absage oder Verschiebung eines Termins (aus fiaon-whatsapp-mara.ts hierher gezogen — E-401 Nachbesserung; dort
 * unverändert im Gebrauch). Breit: auch „kann … nicht“, „passt … nicht“, „schaffe … nicht“, „andere Zeit“.
 */
export const TERMIN_AENDERN = /\babsag\w*|\bsag\w*\s+(?:\w+\s+){0,3}?ab\b|\bverschieb\w*|\bverleg\w*|\bandere[nrs]?\s+(?:zeit|termin|tag|uhrzeit)|\bkann\s+(?:\w+\s+){0,4}?nicht\b|\bpasst\s+(?:\w+\s+){0,2}?nicht\b|\bschaffe\s+(?:\w+\s+){0,2}?nicht\b/i;
/** Dieselbe Absicht, aber nur als ausdrückliches Verb — im ganzen Text (die „Absage der Bank“ ist kein Absagen). */
const TERMIN_AENDERN_VERB = /\b(?:absagen|abzusagen|abgesagt|sage\s+(?:\w+\s+){0,3}?ab|verschieben|verschiebe|verschoben|verlegen|verlege)\b/i;
/**
 * Ein ZEITANGEBOT des Kunden — „Ich habe morgen um 14 Uhr Zeit“, „bin ab 14 Uhr erreichbar“, „um 14 Uhr passt es mir“,
 * „ich kann um 14 Uhr“. Das ist ein Rückrufwunsch (E-236: läuft über rueckruf_am / rueckruf_eintragen), kein Termin,
 * der schon feststeht — auch wenn „mit Ihnen“ dabeisteht (Prüfer-Fund E-401: wurde als vereinbart eingetragen).
 */
const ZEIT_ANGEBOT = /\b(?:zeit|erreichbar|frei|verf(?:ü|ue)gbar)\b|\bpasst\s+(?:es\s+|das\s+)?(?:mir|uns)\b|\b(?:ich|wir)\s+(?:kann|k(?:ö|oe)nn(?:en|te|ten))\b|\bkann\s+(?:ich|wir)\b/i;

const WOCHENTAGE: Record<string, number> = {
  sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** Berliner Kalendertag + Wochentag + Wandzeit von `d` — über formatToParts (Zeit-Falle 04.09.2026: nie Number(format())). */
export function berlinWand(d: Date): { j: number; m: number; t: number; wt: number; hhmm: string } {
  const teile = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(d);
  const v = (typ: string) => teile.find((p) => p.type === typ)?.value ?? "";
  const wt = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v("weekday"));
  return { j: Number(v("year")), m: Number(v("month")), t: Number(v("day")), wt, hhmm: `${v("hour")}:${v("minute")}` };
}

function tagPlus(j: number, m: number, t: number, plus: number): { j: number; m: number; t: number } {
  const d = new Date(Date.UTC(j, m - 1, t + plus));
  return { j: d.getUTCFullYear(), m: d.getUTCMonth() + 1, t: d.getUTCDate() };
}
const iso = (x: { j: number; m: number; t: number }) => `${x.j}-${String(x.m).padStart(2, "0")}-${String(x.t).padStart(2, "0")}`;

/** Uhrzeiten wie uhrzeitenIn — dazu „11 am“ / „2 pm“ und „14h“ (Schweiz). */
export function uhrzeitenGenannt(text: string): string[] {
  const aus = uhrzeitenIn(text);
  const t = String(text ?? "");
  for (const m of Array.from(t.matchAll(/(?<![\d.:])(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi))) {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === "pm") h += 12;
    const s = `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
    if (!aus.includes(s)) aus.push(s);
  }
  for (const m of Array.from(t.matchAll(/(?<![\d.:])(\d{1,2})h(\d{2})?\b/gi))) {
    const h = Number(m[1]);
    if (h > 23) continue;
    const s = `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
    if (!aus.includes(s)) aus.push(s);
  }
  return aus;
}

/**
 * Der Tag, den der Text nennt — relativ zu `jetzt` (Berlin). null = kein Tag genannt.
 * „heute“ (auch „heute Morgen“), „morgen“, „übermorgen“, Wochentag („am Montag“ — heute, wenn heute Montag
 * ist; liegt die Uhrzeit dann schon hinter uns, rechnet genannterTermin eine Woche weiter), „20.10.“, „20.10.2026“.
 * „Guten Morgen“ ist kein Tag.
 */
export function tagGenannt(text: string, jetzt: Date): { tag: string; art: "relativ" | "datum" | "wochentag" } | null {
  const t = String(text ?? "").toLowerCase().replace(/\b(guten|schönen|good)\s+(morgen|morning)\b/g, " ");
  const n = berlinWand(jetzt);
  if (/\b(vorgestern)\b/.test(t)) return { tag: iso(tagPlus(n.j, n.m, n.t, -2)), art: "relativ" };
  if (/\b(gestern|yesterday)\b/.test(t)) return { tag: iso(tagPlus(n.j, n.m, n.t, -1)), art: "relativ" };
  if (/\b(heute|today)\b/.test(t)) return { tag: iso(n), art: "relativ" };
  // E-397 (19.10.2026): „\bü…“ greift nie — ü ist für \b kein Wortzeichen, „übermorgen“ wurde nicht erkannt.
  if (/(?:^|[^a-zäöüß])(übermorgen|uebermorgen)\b/.test(t)) return { tag: iso(tagPlus(n.j, n.m, n.t, 2)), art: "relativ" };
  if (/\b(morgen|tomorrow)\b/.test(t)) return { tag: iso(tagPlus(n.j, n.m, n.t, 1)), art: "relativ" };
  const datum = t.match(/(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?(?![\d])/);
  if (datum) {
    const tg = Number(datum[1]); const mo = Number(datum[2]);
    if (tg >= 1 && tg <= 31 && mo >= 1 && mo <= 12) {
      let jahr = datum[3] ? Number(datum[3].length === 2 ? `20${datum[3]}` : datum[3]) : n.j;
      // Ohne Jahr und schon vorbei (mehr als 2 Tage) → nächstes Jahr.
      if (!datum[3] && Date.UTC(jahr, mo - 1, tg) < Date.UTC(n.j, n.m - 1, n.t) - 2 * 86_400_000) jahr += 1;
      return { tag: iso({ j: jahr, m: mo, t: tg }), art: "datum" };
    }
  }
  for (const [name, wt] of Object.entries(WOCHENTAGE)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      const plus = (wt - n.wt + 7) % 7;
      return { tag: iso(tagPlus(n.j, n.m, n.t, plus)), art: "wochentag" };
    }
  }
  return null;
}

/** Eine Woche weiter (für „am Montag um 11“, am Montag nach 11 Uhr gesagt). */
function wochePlus(tag: string): string {
  const [j, m, t] = tag.split("-").map(Number);
  return iso(tagPlus(j, m, t, 7));
}

/** „mit Justin“, „mit Herrn Stripling“ → der Mitarbeiter (Vor- oder Nachname, nur eindeutig). */
export function mitarbeiterGenannt(text: string, liste: TerminMitarbeiter[]): number | null {
  const t = String(text ?? "");
  const treffer = new Set<number>();
  for (const m of Array.from(t.matchAll(/\b(?:mit|with|bei)\s+(?:herrn?|frau|mr\.?|mrs\.?|ms\.?)?\s*([A-Za-zÄÖÜäöüß-]{3,})/gi))) {
    const wort = m[1].toLowerCase();
    for (const a of liste) {
      if ([a.vorname, a.nachname].some((x) => String(x ?? "").toLowerCase() === wort)) treffer.add(a.id);
    }
  }
  return treffer.size === 1 ? Array.from(treffer)[0] : null;
}

/** Ist das eine Notiz eines Menschen aus dem Team (kein Automatik-Eintrag)? */
export function istTeamNotiz(n: TeamNotiz): boolean {
  return n.agentId != null && !AUTOMATIK_NAMEN.test(String(n.agentName ?? "").trim());
}

function minutenAbstand(wand: string, beginn: string | Date): number {
  const b = berlinWand(new Date(beginn));
  const [d, hm] = wand.split(" ");
  const [h, mi] = hm.split(":").map(Number);
  const [bh, bmi] = b.hhmm.split(":").map(Number);
  const [dj, dm, dt] = d.split("-").map(Number);
  const tage = (Date.UTC(dj, dm - 1, dt) - Date.UTC(b.j, b.m - 1, b.t)) / 86_400_000;
  return Math.abs(tage * 1440 + (h * 60 + mi) - (bh * 60 + bmi));
}

/**
 * Die Erkennung. `kundeText` = NUR sein eigener Teil (ohne zitierten Verlauf — sonst wird „um 09:38
 * schrieb Mara“ ein Termin). `notizen` = Notizen der letzten 14 Tage (Server filtert, hier nochmals).
 */
export function genannterTermin(ein: {
  kundeText: string;
  jetzt: Date;
  notizen: TeamNotiz[];
  mitarbeiter: TerminMitarbeiter[];
  bestehende: BestehenderTerminKurz[];
}): GenanntErgebnis {
  const leer: GenanntErgebnis = {
    art: "keiner", wandzeit: null, uhrzeit: null, beleg: null, notiz: null, teilnehmerId: null, thema: null, bestehend: null, grund: "",
  };
  const text = String(ein.kundeText ?? "").replace(/https?:\/\/\S+/g, " ").slice(0, 1500);
  if (!GESPRAECH.test(text)) return { ...leer, grund: "kein Gesprächswort" };
  const zeiten = uhrzeitenGenannt(text);
  if (!zeiten.length) return { ...leer, grund: "keine Uhrzeit" };
  if (RUECKRUF_WUNSCH.test(text) && !VEREINBART.test(text)) return { ...leer, grund: "Rückrufwunsch (läuft über rueckruf_am)" };
  // E-401 Nachbesserung (Prüfer-Fund): Er will einen Termin ABSAGEN oder VERSCHIEBEN — das ist kein genannter Termin.
  // Vorher wurde daraus „steht schon“: Mara wünschte ein gutes Gespräch zur alten Zeit, das Verschieben ging verloren.
  if (terminAendernIn(text)) return { ...leer, grund: "Er will einen Termin absagen oder verschieben — das läuft über den Termin-Weg (E-236/E-260)" };

  const uhrzeit = zeiten[0];
  const thema = GLOBAL_THEMA.test(text) ? "global" as const : null;
  const jetztWand = berlinWand(ein.jetzt);
  const jetztText = `${iso(jetztWand)} ${jetztWand.hhmm}`;

  // Sein Tag: aus seinem Text (am Wochentag nach der Uhrzeit → nächste Woche).
  const tagVon = (txt: string, bezug: Date): string | null => {
    const g = tagGenannt(txt, bezug);
    if (!g) return null;
    const bw = berlinWand(bezug);
    if (g.art === "wochentag" && g.tag === iso(bw) && uhrzeit <= bw.hhmm) return wochePlus(g.tag);
    return g.tag;
  };
  const seinTag = tagVon(text, ein.jetzt);

  // Die passende Team-Notiz: ein Mensch, höchstens 14 Tage alt, dieselbe Uhrzeit — und, wenn beide einen
  // Tag nennen, derselbe Tag („Rückruf am Donnerstag um 15 Uhr“ belegt nicht „heute um 15 Uhr bei der Bank“).
  const vierzehn = ein.jetzt.getTime() - 14 * 86_400_000;
  const notiz = ein.notizen
    .filter((n) => istTeamNotiz(n) && new Date(n.am).getTime() >= vierzehn && uhrzeitenGenannt(n.text).includes(uhrzeit))
    .filter((n) => { const nt = tagVon(n.text, new Date(n.am)); return !seinTag || !nt || nt === seinTag; })
    .sort((a, b) => new Date(b.am).getTime() - new Date(a.am).getTime())[0] ?? null;

  // E-401 Nachbesserung (Prüfer-Fund): „Ich habe morgen um 14 Uhr Zeit für ein Gespräch mit Ihnen“ ist ein ZEITANGEBOT —
  // ein Rückrufwunsch (E-236), kein vereinbarter Termin. Ohne Team-Notiz derselben Uhrzeit und ohne „wie besprochen /
  // vereinbart“ bleibt es der Rückruf-Weg (rueckruf_am bzw. rueckruf_eintragen mit Raster und Arbeitszeiten).
  if (!notiz && zeitAngebotIn(text) && !STARK_VEREINBART.test(text)) {
    return { ...leer, grund: "Zeitangebot — ein Rückrufwunsch (läuft über rueckruf_am / rueckruf_eintragen)" };
  }

  // Der Tag: aus seinem Text; sonst aus der Notiz (relativ zum Notiztag); sonst heute, wenn die Uhrzeit noch kommt.
  let tag = seinTag;
  if (!tag && notiz) tag = tagVon(notiz.text, new Date(notiz.am));
  if (!tag && notiz && uhrzeit > jetztWand.hhmm) tag = iso(jetztWand);
  if (!tag) {
    return { ...leer, art: DRITTE.test(text) ? "dritte" : "unklar", uhrzeit, thema, notiz, grund: "Uhrzeit ohne Tag" };
  }
  const wandzeit = `${tag} ${uhrzeit}`;
  if (wandzeit <= jetztText) return { ...leer, art: "vergangen", wandzeit, uhrzeit, thema, grund: "Zeitpunkt liegt in der Vergangenheit" };
  // Höchstens 14 Tage voraus — weiter weg ist es kein Gespräch, das Mara heute einträgt.
  const [tj, tm, tt] = tag.split("-").map(Number);
  if (Date.UTC(tj, tm - 1, tt) - Date.UTC(jetztWand.j, jetztWand.m - 1, jetztWand.t) > 14 * 86_400_000) {
    return { ...leer, art: "unklar", wandzeit, uhrzeit, thema, grund: "mehr als 14 Tage voraus" };
  }

  const bestehend = ein.bestehende.find((b) => b.status === "gebucht" && minutenAbstand(wandzeit, b.beginn) <= 30) ?? null;
  if (bestehend) return { ...leer, art: "steht_schon", wandzeit, uhrzeit, thema, bestehend, notiz, teilnehmerId: bestehend.agentId, beleg: notiz ? "notiz" : null, grund: "Termin steht schon" };

  const genanntVonKunde = mitarbeiterGenannt(text, ein.mitarbeiter);
  if (notiz) {
    const ausNotiz = mitarbeiterGenannt(notiz.text, ein.mitarbeiter);
    return {
      ...leer, art: "mit_uns", wandzeit, uhrzeit, beleg: "notiz", notiz,
      teilnehmerId: ausNotiz ?? genanntVonKunde ?? notiz.agentId ?? null,
      thema: thema ?? (GLOBAL_THEMA.test(notiz.text) ? "global" : null),
      grund: "Team-Notiz mit derselben Uhrzeit",
    };
  }
  if (genanntVonKunde != null || MIT_UNS.test(text)) {
    return { ...leer, art: "mit_uns", wandzeit, uhrzeit, beleg: "kunde", teilnehmerId: genanntVonKunde, thema, grund: "Kunde nennt uns als Gesprächspartner" };
  }
  if (DRITTE.test(text)) return { ...leer, art: "dritte", wandzeit, uhrzeit, thema, grund: "Gespräch mit Dritten" };
  return { ...leer, art: "unklar", wandzeit, uhrzeit, thema, grund: "kein Beleg, wer das Gespräch führt" };
}

// ── DIE ANTWORT: ZURÜCKNEHMEN ────────────────────────────────────────────
/**
 * Verkauf in einer Antwort, die nur einen guten Termin wünschen soll (Justin: „sich zurücknehmen“).
 * Liefert den Treffer oder null. „Firmenkredit“ ist kein Verkauf; „Kreditkarte“ ist es.
 */
export function verkaufNebenTermin(antwort: string): string | null {
  const t = String(antwort ?? "");
  const m = t.match(/\b(visa\w*|\w*kreditkarte\w*|wunschlimit\w*|partnerbank\w*|aktivierung\w*|freischalt\w*|zahlen\s+sie\s+jetzt|jetzt\s+(?:zahlen|bezahlen|überweisen|starten)|überweisen\s+sie|bezahlen\s+sie|antrag\s+(?:starten|stellen)|(?:doch|gern)\s+(?:zu|mit)\s+ihrer\s+eigenen|wenn\s+sie\s+(?:später\s+)?doch)\b/i);
  return m ? m[0] : null;
}

/** „ist eingetragen / steht im Kalender / habe ich notiert“ — darf nur stehen, wenn wirklich eingetragen wurde. */
export function sagtEingetragen(antwort: string): string | null {
  const t = String(antwort ?? "");
  const m = t.match(/(?:termin|gespr[äa]ch|telefonat|call)[^.!?\n]{0,80}\b(eingetragen|im\s+kalender|notiert|vorgemerkt|festgehalten)\b|\b(eingetragen|notiert|vorgemerkt)\b[^.!?\n]{0,40}(?:termin|gespr[äa]ch|telefonat)/i);
  return m ? m[0] : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUF WHATSAPP (19.10.2026, E-401 2/6) — derselbe genannte Termin, aber im Gespräch
//
// Auf WhatsApp handelt Mara Zeiten selbst aus (E-236: freie_zeiten → rueckruf_eintragen). Eine Uhrzeit ist dort
// darum oft KEIN vereinbarter Termin, sondern die Antwort auf Maras Zeitangebot („Morgen 14 Uhr passt“) oder ein
// Wunsch („Können wir morgen um 14 Uhr telefonieren?“) — das bleibt der Rückruf-Weg, unverändert. Der genannte
// Termin gilt auf WhatsApp nur, wenn er schon feststeht:
//   · nie als Antwort auf eine Nachricht von uns mit Uhrzeit oder Zeitfrage (das ist das Aushandeln, E-236),
//   · „steht_schon“ immer (er nennt einen Termin, der im Kalender steht — auch als Frage „steht morgen 14 Uhr?“),
//   · nie, wenn jeder Satz mit der Uhrzeit eine Frage oder ein Wunsch ist („Können wir …?“, „Ich möchte …“),
//   · mit Team-Notiz derselben Uhrzeit: ja; „mit Herrn …/mit Ihnen“ ohne Notiz und „unklar“: nur, wenn der Satz
//     sagt, dass es vereinbart ist („wir haben … ein Gespräch“, „wie besprochen“, „ist ausgemacht“),
//   · bei Dritten (Bank, Notar …): ja — es wird nichts eingetragen, Mara wünscht nur Erfolg und verkauft nicht.
// Rein, ohne Datenbank (scripts/pruef-mara-wa-genannter-termin.ts). Die Mail-Erkennung oben bleibt unverändert.
// ═══════════════════════════════════════════════════════════════════════════

/** Ausdrücklich vereinbart — gilt auch in einem Satz mit „können/möchte“ („wie besprochen, können wir um 11 …“). */
const STARK_VEREINBART = /\bwie\s+(?:\S+\s+){0,2}?(?:besprochen|vereinbart|ausgemacht|abgesprochen|verabredet)\b|\b(?:ist|sind|wurde|war|haben\s+wir|hatten\s+wir|hab(?:e)?\s+(?:ich|wir))\s+(?:\S+\s+){0,4}?(?:vereinbart|ausgemacht|abgesprochen|verabredet|festgelegt|festgemacht)\b|\b(?:vereinbart|ausgemacht|abgesprochen|verabredet)(?:e[nrs]?)?\b/i;
/** Vereinbart, wenn der Satz kein Wunsch ist: „wir haben heute um 11.00 uhr ein Gespräch“, „wir telefonieren morgen um 14“ (Punkt nur zwischen Ziffern). */
const VEREINBART_WA = new RegExp([
  String.raw`\b(?:wir\s+haben|ich\s+habe|hab(?:e)?\s+ich|haben\s+wir|ich\s+hab)\b(?:[^.!?\n]|\.(?=\d)){0,70}\b(?:termin\w*|gespr(?:ä|ae|a)ch\w*|telefonat\w*|call|meeting|besprechung|treffen|beratung\w*|videocall|zoom)`,
  String.raw`\b(?:wir\s+)?(?:telefonieren|sprechen|h(?:ö|oe)ren|treffen)\s+(?:uns\s+)?(?:ja\s+|doch\s+)*(?:heute|morgen|(?:ü|ue)bermorgen|am|um)\b`,
  String.raw`\b(?:i|we)\s+have\b(?:[^.!?\n]|\.(?=\d)){0,50}\b(?:call|meeting|appointment)\b`,
].join("|"), "i");
/** Ein Wunsch oder eine Bitte — kein vereinbarter Termin („Können wir …“, „Ich möchte …“, „Wäre 14 Uhr möglich“). */
const WUNSCH_WA = /\b(?:k(?:ö|oe)nn(?:en|te|ten|t)|kann\s+(?:ich|man)|w(?:ü|ue)rde(?:n)?|m(?:ö|oe)chte(?:n)?|h(?:ä|ae)tte(?:n)?\s+gern|w(?:ä|ae)re|ginge|wollen|will|w(?:ü|ue)nsche|bitte\s+um|geht\s+(?:es|das|auch))\b|\bcould\s+we\b|\bcan\s+(?:we|you)\b|\b(?:zeit|erreichbar|frei|verf(?:ü|ue)gbar)\b/i;
/** „Steht morgen 14 Uhr?“, „Bleibt es bei 14 Uhr?“ — eine Rückfrage zum stehenden Termin, kein Wunsch nach einem anderen. */
const BESTAETIGUNGS_FRAGE = /\b(?:steht|bleibt\s+es|gilt|klappt|findet\s+(?:\w+\s+){0,3}statt|ist\s+(?:\w+\s+){0,3}(?:noch\s+)?(?:aktuell|g(?:ü|ue)ltig|fest))\b/i;
/**
 * Fragt unsere letzte Nachricht nach einer Zeit für ein Gespräch? („Wann passt es Ihnen?“, „Welche Uhrzeit …?“,
 * „Wann erreiche ich Sie?“) — nicht „Wann können Sie die Rate zahlen?“.
 */
export function fragtNachZeit(raus: string): boolean {
  return (String(raus ?? "").match(/[^.!?\n]*\?/g) ?? []).some((f) =>
    /\b(?:wann|welche[nrs]?\s+(?:zeit|uhrzeit|tageszeit)|uhrzeit|zeitfenster|passt\s+(?:es\s+|das\s+)?ihnen)\b/i.test(f)
    && /\b(?:anruf\w*|r(?:ü|ue)ckruf\w*|zur(?:ü|ue)ckruf\w*|telefon\w*|sprech\w*|erreich\w*|zeit\w*|uhr\w*|termin\w*|gespr(?:ä|ae)ch\w*|melde\w*|ruf\w*|passt|passen|besten)\b/i.test(f));
}

/** Ein Satz seiner Nachricht mit Uhrzeit — und der Teilsatz (an Komma, „und“, „aber“ getrennt), in dem sie steht. */
export interface UhrzeitSatz { satz: string; teil: string; frage: boolean }
/**
 * Die Sätze seiner Nachricht, in denen eine Uhrzeit steht — getrennt an ! ? und Zeilenende (Punkte stehen in
 * „11.00 Uhr“ und „23.10.“). `frage`: der Teilsatz mit der Uhrzeit ist der letzte eines Fragesatzes
 * („Können wir um 11 telefonieren?“ ja; „Ich habe um 11 einen Termin, können Sie …?“ nein).
 */
export function saetzeMitUhrzeit(text: string): UhrzeitSatz[] {
  const aus: UhrzeitSatz[] = [];
  for (const roh of String(text ?? "").replace(/https?:\/\/\S+/g, " ").match(/[^!?\n]+[!?]*/g) ?? []) {
    const satz = roh.trim();
    if (!satz || !uhrzeitenGenannt(satz).length) continue;
    const teile = satz.split(/,\s*|;\s*|\s+und\s+|\s+aber\s+/i).map((x) => x.trim()).filter(Boolean);
    const i = Math.max(0, teile.findIndex((x) => uhrzeitenGenannt(x).length > 0));
    aus.push({ satz, teil: teile[i] ?? satz, frage: /\?\s*$/.test(satz) && i === teile.length - 1 });
  }
  return aus;
}

/** Will er einen Termin absagen oder verschieben? Ausdrückliches Verb im Text oder TERMIN_AENDERN im Teilsatz mit der Uhrzeit. Rein. */
export function terminAendernIn(text: string): boolean {
  const t = String(text ?? "");
  if (TERMIN_AENDERN_VERB.test(t)) return true;
  return saetzeMitUhrzeit(t).some((s) => TERMIN_AENDERN.test(s.teil));
}
/** Bietet er eine Zeit an („habe um 14 Uhr Zeit“, „bin erreichbar“)? Geprüft im Teilsatz mit der Uhrzeit. Rein. */
export function zeitAngebotIn(text: string): boolean {
  return saetzeMitUhrzeit(text).some((s) => ZEIT_ANGEBOT.test(s.teil));
}
/** „wie besprochen“, „ist vereinbart“ … — ausdrücklich vereinbart. Rein. */
export function starkVereinbart(text: string): boolean {
  return STARK_VEREINBART.test(String(text ?? ""));
}
/**
 * Fragt er SELBST nach Karte, Link oder Zahlung („schicken Sie mir bitte den Link für die Karte“, „wie kann ich die Rate
 * zahlen?“)? Dann ist das Erfüllen seiner Bitte kein Verkauf — auch neben einem genannten Termin (Prüfer-Fund E-401). Rein.
 */
export function fragtSelbstNachLinkOderZahlung(text: string): boolean {
  const t = String(text ?? "");
  const sache = /\b(?:link\w*|zahlungs\w*|überweisungs\w*|ueberweisungs\w*|kartenlink|kreditkarte|karte|konto|iban|bankverbindung|rechnung|rate|zahlen|bezahlen|überweisen|ueberweisen)\b/i;
  const bitte = /\b(?:schick\w*|send\w*|geben\s+sie|brauche|br(?:ä|ae)uchte|h(?:ä|ae)tte\s+gern\w*|wo\s+(?:finde|ist|sehe|kann)|wie\s+(?:kann|zahle|bezahle|überweise|ueberweise|komme)|m(?:ö|oe)chte\s+(?:\w+\s+){0,3}(?:zahlen|bezahlen|überweisen|ueberweisen|beantragen|haben))\b/i;
  return t.split(/(?<=[.!?])\s+|\n+/).some((satz) => sache.test(satz) && bitte.test(satz));
}

/**
 * Gilt der erkannte Termin auf WhatsApp? `letzteRaus` = unsere letzte Nachricht vor seiner (Mara, Team oder Vorlage).
 * false heißt: nichts eintragen, kein Hinweis — der bisherige Weg (Rückruf, Termin im STAND) läuft unverändert.
 */
export function genanntAufWhatsApp(e: GenanntErgebnis, ein: { kundeText: string; letzteRaus?: string | null }): { gilt: boolean; grund: string } {
  if (e.art === "keiner" || e.art === "vergangen") return { gilt: false, grund: e.grund || e.art };
  const raus = String(ein.letzteRaus ?? "").replace(/https?:\/\/\S+/g, " ");
  if (raus && (uhrzeitenGenannt(raus).length > 0 || fragtNachZeit(raus))) {
    return { gilt: false, grund: "Antwort auf unsere Nachricht mit Uhrzeit oder Zeitfrage — das Aushandeln läuft über rueckruf_eintragen (E-236)" };
  }
  const saetze = saetzeMitUhrzeit(ein.kundeText);
  const wunsch = (s: UhrzeitSatz) => s.frage || WUNSCH_WA.test(s.teil);
  if (e.art === "steht_schon") {
    // E-401 Nachbesserung (Prüfer-Fund): Will er ändern (Absage/Verschieben — oder eine ZWEITE Uhrzeit, ein Wunsch, der
    // keine Rückfrage zum stehenden Termin ist), gilt der genannte Termin NICHT: Das Verschieben läuft über
    // rueckruf_eintragen (verschieben: true) — vorher wünschte Mara ein gutes Gespräch zur alten Zeit.
    if (terminAendernIn(ein.kundeText)) return { gilt: false, grund: "Er will den stehenden Termin absagen oder verschieben (Termin-Weg)" };
    if (uhrzeitenGenannt(ein.kundeText).length > 1) return { gilt: false, grund: "Er nennt eine zweite Uhrzeit — ein Wunsch, den Termin zu ändern (Termin-Weg)" };
    if (saetze.some((s) => wunsch(s) && !BESTAETIGUNGS_FRAGE.test(s.satz))) return { gilt: false, grund: "Wunsch zum stehenden Termin — das ist der Termin-Weg" };
    return { gilt: true, grund: "Termin steht schon" };
  }
  const vereinbart = saetze.some((s) => STARK_VEREINBART.test(s.satz) || (VEREINBART_WA.test(s.satz) && !wunsch(s)));
  if (saetze.length > 0 && saetze.every((s) => wunsch(s) && !STARK_VEREINBART.test(s.satz))) {
    return { gilt: false, grund: "Frage oder Wunsch nach einem Gespräch — das ist der Rückruf-Weg" };
  }
  if (e.beleg === "notiz") return { gilt: true, grund: "Team-Notiz mit derselben Uhrzeit" };
  if (e.art === "dritte") return { gilt: true, grund: "Gespräch mit Dritten — nichts eintragen, nichts verkaufen" };
  if (vereinbart) return { gilt: true, grund: e.art === "mit_uns" ? "Er sagt, dass es mit uns vereinbart ist" : "vereinbart, aber unklar, mit wem" };
  return { gilt: false, grund: e.art === "mit_uns" ? "Wunsch, mit uns zu sprechen — nicht vereinbart (Rückruf-Weg)" : "unklar und nicht als vereinbart gesagt" };
}

/**
 * Der eine warme Satz zum genannten Termin (E-395 im Hinweis, E-401 auch als sicherer Satz auf WhatsApp).
 * `mit` = Nennform im Dativ („Herrn Stripling“), `zeit` = so, wie der Kunde es liest („heute um 11 Uhr“).
 */
export function genanntSatz(ein: { art: GenanntArt; eingetragen: boolean; zeit: string | null; mit: string | null }): string {
  const zeit = ein.zeit ?? "zur genannten Zeit";
  if (ein.art === "steht_schon") return `Ihr Gespräch ${zeit}${ein.mit ? ` mit ${ein.mit}` : ""} steht bei uns — ich wünsche Ihnen ein richtig gutes Gespräch!`;
  if (ein.art === "mit_uns" && ein.eingetragen) return `Ihr Gespräch ${zeit}${ein.mit ? ` mit ${ein.mit}` : ""} ist bei uns eingetragen — ich wünsche Ihnen ein richtig gutes Gespräch!`;
  if (ein.art === "dritte") return `Ich wünsche Ihnen für Ihren Termin ${zeit} viel Erfolg!`;
  return `Ich wünsche Ihnen für Ihr Gespräch ${zeit} alles Gute!`;
}

/**
 * Die Antwortprüfung neben einem genannten Termin — dieselben Regeln wie im Postfach (fiaon-postmeister-agent.ts,
 * E-395), für WhatsApp gebündelt: kein Verkauf, „eingetragen“ nur, wenn eingetragen, der eingetragene Termin steht
 * mit Uhrzeit drin. Auf WhatsApp dazu kein Verkaufs- oder Zahlungslink (der WhatsApp-Auftrag endet sonst mit dem
 * persönlichen Link); sein Bereich (fiaon.com/login) und Rechtstexte bleiben erlaubt.
 */
export function genanntAntwortFunde(antwort: string, gt: {
  /** true = eingetragen, steht schon, oder ein Rückruf wurde in diesem Lauf eingetragen. */
  darfEingetragen: boolean;
  /** „HH:MM“ des eingetragenen bzw. stehenden Termins — muss in der Antwort stehen (null = keine Pflicht). */
  uhrzeitPflicht: string | null;
  /** Der Satz, den die Antwort sonst sagen soll. */
  satz: string | null;
  linkVerboten?: boolean;
  /**
   * E-401 Nachbesserung: Er fragt SELBST nach Karte, Link oder Zahlung (fragtSelbstNachLinkOderZahlung) — dann ist das
   * Erfüllen seiner Bitte kein Verkauf: „Visa“, „Kreditkarte“, „Partnerbank“ und sein Link sind dann frei.
   */
  verkaufErlaubt?: boolean;
}): string[] {
  const t = String(antwort ?? "");
  const funde: string[] = [];
  const verkauf = gt.verkaufErlaubt ? null : verkaufNebenTermin(t);
  if (verkauf) funde.push(`Verkauf neben einem genannten Termin („${verkauf}“) — Justin: „einen guten Termin wünschen und sich zurücknehmen“; nimm den Satz heraus`);
  // Sein Bereich (Login, Unterlagen) und Rechtstexte sind Service — Zahlungsseite, Antrag, Auskunft, Terminlink nicht.
  const link = gt.linkVerboten ? t.match(/(?:https?:\/\/)?(?:www\.)?fiaon\.com\/(?!(?:login|app|mein-bereich|dashboard|agb|datenschutz|impressum|widerruf\w*|kontakt|ratgeber)(?:[\/?#\s.,;:!)“"]|$))\S+/i) : null;
  if (link) funde.push(`Kein Link neben einem genannten Termin („${link[0].slice(0, 60)}“) — wünsche ein gutes Gespräch und nimm dich zurück`);
  const eing = sagtEingetragen(t);
  if (eing && !gt.darfEingetragen) funde.push(`Die Antwort sagt, der Termin sei eingetragen („${eing}“) — eingetragen ist nichts; wünsche nur ein gutes Gespräch`);
  if (gt.uhrzeitPflicht && !uhrzeitenIn(t).includes(gt.uhrzeitPflicht)) {
    funde.push(`Die Antwort nennt den eingetragenen Termin nicht — ein Satz: „${gt.satz ?? "Ihr Gespräch ist bei uns eingetragen — ich wünsche Ihnen ein richtig gutes Gespräch!"}“`);
  }
  return funde;
}
