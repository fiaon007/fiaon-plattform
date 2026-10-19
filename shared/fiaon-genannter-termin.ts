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
  if (/\b(übermorgen|uebermorgen)\b/.test(t)) return { tag: iso(tagPlus(n.j, n.m, n.t, 2)), art: "relativ" };
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
