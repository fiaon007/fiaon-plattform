// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-LAGE — NEWS: Quellen und Regeln (E-508 Scheibe 2, 12.11.2026)
//
// Justin: „aktuelle News zu allen relevanten Themen, einfach seriös, Kanzlei-Stil“.
//
// Nur amtliche Quellen mit eigenem Feed (jede Adresse am 12.11.2026 abgerufen und geprüft): US-Notenbank, EZB
// (Presse und Referenzkurs EUR/USD), das US-Amtsblatt (Federal Register) für IRS, FinCEN und USCIS, die
// Einwanderungsbehörde USCIS, die Aufsichten FMA (Österreich) und FINMA (Schweiz). Jede Meldung trägt Quelle, Link
// und Datum. Eine kurze deutsche Fassung und der Satz „Was heißt das für unsere Mandanten“ kommen von der KI —
// fehlt sie (Pause, Deckel), steht die Meldung trotzdem da, im Original.
//
// Reine Rechnung, ohne Netz und ohne Datenbank: Feed lesen, Meldung gegen die Stichworte der Quelle prüfen,
// EZB-Kurs lesen, KI-Antwort prüfen. Nichts hiervon geht an Kunden.
// ═══════════════════════════════════════════════════════════════════════════

export type NewsThema = "zinsen" | "steuern" | "meldepflicht" | "visa" | "aufsicht";
export const NEWS_THEMA_NAME: Record<NewsThema, string> = {
  zinsen: "Zinsen & Geldpolitik", steuern: "IRS & Steuern", meldepflicht: "Meldepflichten", visa: "Visa & Einreise", aufsicht: "Aufsicht DACH",
};
export const NEWS_THEMEN: NewsThema[] = ["zinsen", "steuern", "meldepflicht", "visa", "aufsicht"];

export interface NewsQuelle {
  key: string; name: string; url: string; thema: NewsThema; sprache: "de" | "en";
  /** Mindestens eines dieser Stichworte muss in Titel oder Text stehen (klein geschrieben). Fehlt die Liste, zählt jede Meldung. */
  nur?: string[];
  /** Steht eines dieser Stichworte im Titel, fällt die Meldung weg. */
  ohne?: string[];
  /** Höchstens so viele neue Meldungen je Abruf. */
  max: number;
}

export const NEWS_QUELLEN: NewsQuelle[] = [
  { key: "fed", name: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_monetary.xml", thema: "zinsen", sprache: "en", max: 6 },
  // Die EZB veröffentlicht vor allem Reden — hier zählen nur Beschlüsse und Zinsen.
  { key: "ezb", name: "Europäische Zentralbank", url: "https://www.ecb.europa.eu/rss/press.html", thema: "zinsen", sprache: "en", max: 4,
    nur: ["monetary policy decision", "interest rate", "key ecb", "exchange rate", "combined monetary policy"] },
  { key: "irs", name: "Federal Register · IRS", url: "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=internal-revenue-service", thema: "steuern", sprache: "en", max: 8,
    nur: ["foreign", "corporation", "partnership", "llc", "limited liability", "5472", "1120", "1065", "w-8", "w-7", "itin", "ein ", "employer identification", "withholding", "nonresident", "treaty", "reporting", "information return", "disregarded"],
    ohne: ["proposed extension of information collection", "comment request", "requesting comment", "agency information collection", "submission for omb review"] },
  { key: "fincen", name: "Federal Register · FinCEN", url: "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=financial-crimes-enforcement-network", thema: "meldepflicht", sprache: "en", max: 6,
    ohne: ["comment request", "requesting comment", "agency information collection", "submission for omb review"] },
  { key: "uscis-fr", name: "Federal Register · USCIS", url: "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=u-s-citizenship-and-immigration-services", thema: "visa", sprache: "en", max: 4,
    ohne: ["comment request", "requesting comment", "agency information collection"] },
  // Der Nachrichten-Feed der USCIS ist voller Strafverfolgung — hier zählen nur Visa, Gebühren und Verfahren für Unternehmer.
  { key: "uscis", name: "USCIS", url: "https://www.uscis.gov/news/rss-feed/59144", thema: "visa", sprache: "en", max: 4,
    nur: ["e-2", "e-1", "l-1", "eb-5", "eb-1", "o-1", "h-1b", "investor", "entrepreneur", "premium processing", "fee rule", "filing fee", "visa bulletin", "treaty", "form i-129", "form i-140", "international entrepreneur"],
    ohne: ["sentenced", "charged", "convicted", "pleads", "pleaded", "indicted", "arrested", "fraud ring", "smuggling", "denaturalized", "voting"] },
  { key: "fma", name: "FMA Österreich", url: "https://www.fma.gv.at/feed/", thema: "aufsicht", sprache: "de", max: 5,
    // Die täglichen Anleger-Warnungen und Einzelzulassungen sind keine Lage für uns.
    ohne: ["warnt vor", "zulassungserteilung", "hinweis für kund", "stellenausschreibung", "karriere"] },
  { key: "finma", name: "FINMA Schweiz", url: "https://www.finma.ch/de/rss/news/", thema: "aufsicht", sprache: "de", max: 5,
    ohne: ["sanktionen:", "sanktionsmeldung"] },
];
export const NEWS_QUELLE_NACH_KEY = new Map(NEWS_QUELLEN.map((q) => [q.key, q]));

/** Der EZB-Referenzkurs der letzten 90 Tage (eine Datei, werktäglich gegen 16 Uhr aktualisiert). */
export const NEWS_EZB_KURS_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
/** Ältere Meldungen holt der Abruf nicht mehr ab. */
export const NEWS_MAX_ALTER_TAGE = 30;
/** So viele Meldungen zeigt die Seite höchstens. */
export const NEWS_ANZEIGE_MAX = 36;
/** Tagesdeckel der KI-Kurzfassungen in US-Dollar (fiaon_settings chef_news_ki_deckel_usd überschreibt ihn). */
export const NEWS_KI_DECKEL_USD = 1;
export const NEWS_KI_JE_LAUF = 8;
export const NEWS_KI_VERSUCHE_MAX = 3;
export const NEWS_SCHLUESSEL = { kurs: "chef_kurs_eurusd", kiAn: "chef_news_ki_an", kiDeckel: "chef_news_ki_deckel_usd", abrufAm: "chef_news_abruf_am" } as const;

// ── Feed lesen (RSS 2.0 und Atom) ────────────────────────────────────────────
export interface FeedPosten { titel: string; link: string; datum: string | null; text: string }

const ZEICHEN: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", bdquo: "„" };
/** Aus einem Feld Klartext machen: CDATA auspacken, Auszeichnung entfernen, Zeichenkürzel auflösen, Leerraum glätten. */
export function feldText(roh: string | undefined | null): string {
  let s = String(roh ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Zweimal: Feeds liefern Auszeichnung oft doppelt verpackt (&lt;p&gt;…).
  for (let i = 0; i < 2; i++) {
    s = s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([a-zA-Z]+);/g, (m, n) => ZEICHEN[n] ?? m);
    s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  }
  return s.replace(/\s+/g, " ").trim();
}
const feld = (block: string, namen: string[]): string | null => {
  for (const n of namen) {
    const m = block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i"));
    if (m) return m[1];
  }
  return null;
};
/** Ein Datum aus dem Feed als ISO-Zeitpunkt — oder null, wenn es nicht lesbar ist. Zweistellige Jahre („26“) zählen als 20xx. */
export function feedDatum(roh: string | null): string | null {
  const s = feldText(roh).replace(/^(\w{3}, \d{1,2} \w{3}) (\d{2}) /, "$1 20$2 ");
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
export function feedLesen(xml: string): FeedPosten[] {
  const aus: FeedPosten[] = [];
  const bloecke = String(xml ?? "").match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) ?? [];
  for (const b of bloecke) {
    const titel = feldText(feld(b, ["title"]));
    let link = feldText(feld(b, ["link"]));
    if (!link) { const m = b.match(/<link[^>]*href=["']([^"']+)["']/i); link = m ? feldText(m[1]) : ""; }
    if (!link) link = feldText(feld(b, ["guid", "id"]));
    link = link.replace(/^(https?:\/\/[^/]+)\/\//, "$1/");
    if (!titel || !/^https:\/\//i.test(link)) continue;
    // Der Zusatz mancher Feeds („Der Beitrag … erschien zuerst auf …“) ist kein Inhalt der Meldung.
    const text = feldText(feld(b, ["description", "summary", "content:encoded", "content"])).replace(/\s*Der Beitrag .{0,300}? erschien zuerst auf .{0,80}$/i, "").trim();
    aus.push({ titel: titel.slice(0, 400), link: link.slice(0, 600), datum: feedDatum(feld(b, ["pubDate", "published", "updated", "dc:date"])), text: text === titel ? "" : text.slice(0, 2400) });
  }
  return aus;
}
/** Passt die Meldung zur Quelle? (Stichworte der Quelle; nichts davon ist eine Wertung der Meldung.) */
export function postenPasst(q: NewsQuelle, p: FeedPosten): boolean {
  const titel = p.titel.toLowerCase(); const alles = `${titel} ${p.text.toLowerCase()} `;
  if (q.ohne?.some((w) => titel.includes(w))) return false;
  if (q.nur && !q.nur.some((w) => alles.includes(w))) return false;
  return true;
}

// ── EZB-Referenzkurs ─────────────────────────────────────────────────────────
export interface KursTag { tag: string; kurs: number }
/** Liest die USD-Kurse aus der EZB-Datei (Tages- oder 90-Tage-Datei), älteste zuerst. */
export function ezbKursLesen(xml: string): KursTag[] {
  const aus: KursTag[] = [];
  const re = /<Cube\s+time=["'](\d{4}-\d{2}-\d{2})["']\s*>([\s\S]*?)<\/Cube>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(xml ?? "")))) {
    const k = m[2].match(/currency=["']USD["']\s+rate=["']([0-9.]+)["']/);
    const kurs = k ? Number(k[1]) : NaN;
    if (Number.isFinite(kurs) && kurs > 0.5 && kurs < 2) aus.push({ tag: m[1], kurs });
  }
  return aus.sort((a, b) => a.tag.localeCompare(b.tag));
}
export interface KursStand { tag: string; kurs: number; vortag: KursTag | null; veraenderungProzent: number | null; vor30: KursTag | null; verlauf: KursTag[] }
export function kursStand(werte: KursTag[]): KursStand | null {
  if (!werte.length) return null;
  const l = werte[werte.length - 1]; const v = werte.length > 1 ? werte[werte.length - 2] : null;
  const grenze = new Date(Date.parse(`${l.tag}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  const vor30 = [...werte].reverse().find((w) => w.tag <= grenze) ?? null;
  return { tag: l.tag, kurs: l.kurs, vortag: v, veraenderungProzent: v ? Math.round(((l.kurs - v.kurs) / v.kurs) * 10_000) / 100 : null, vor30, verlauf: werte.slice(-60) };
}

// ── KI-Kurzfassung ───────────────────────────────────────────────────────────
export const NEWS_KI_ANWEISUNG = [
  "Du schreibst für die Geschäftsführung von FIAON Global. FIAON Global gründet US-Gesellschaften (LLC) für Unternehmer aus Deutschland, Österreich und der Schweiz",
  "und begleitet sie bei EIN, ITIN, US-Konto, Geschäftskreditkarten und Finanzierung.",
  "Du bekommst eine amtliche Meldung (Quelle, Titel, Text). Antworte NUR mit JSON: {\"kurz\": string, \"bedeutung\": string, \"relevanz\": 0|1|2|3}.",
  "kurz: höchstens zwei kurze deutsche Sätze, in einfachen Worten, nur was in der Meldung steht. Nichts erfinden, keine Zahl nennen, die nicht in der Meldung steht.",
  "bedeutung: genau ein deutscher Satz — was heißt das für unsere Mandanten (Unternehmer mit US-LLC aus DE/AT/CH)? Gibt es keinen Bezug, schreibe genau: „Kein direkter Bezug.“",
  "relevanz: 3 = betrifft unsere Mandanten direkt (Meldepflicht, Frist, Gebühr, Zins, Visum für Unternehmer), 2 = wichtig zu wissen, 1 = Randthema, 0 = kein Bezug.",
  "Keine Rechts- oder Steuerberatung im Wortlaut, keine Versprechen, keine Handlungsaufforderung an Kunden.",
].join(" ");
export interface NewsKi { kurz: string; bedeutung: string; relevanz: number }
/** Prüft die Antwort der KI — nur ein sauberes Objekt mit zwei Sätzen und einer Stufe 0–3 gilt. */
export function newsKiLesen(roh: string): NewsKi | null {
  let j: any;
  try { j = JSON.parse(String(roh ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return null; }
  const kurz = feldText(j?.kurz); const bedeutung = feldText(j?.bedeutung); const r = Number(j?.relevanz);
  if (kurz.length < 12 || kurz.length > 420 || bedeutung.length < 8 || bedeutung.length > 320) return null;
  if (!Number.isInteger(r) || r < 0 || r > 3) return null;
  return { kurz, bedeutung, relevanz: r };
}
export function newsKiEingabe(q: NewsQuelle, p: { titel: string; text: string }): string {
  return `Quelle: ${q.name} (${NEWS_THEMA_NAME[q.thema]})\nTitel: ${p.titel}\nText: ${p.text ? p.text.slice(0, 1600) : "(kein Text im Feed — nur der Titel)"}`;
}

// ── Die Antwort des Servers ──────────────────────────────────────────────────
export interface NewsMeldung {
  id: number; quelle: string; quelleName: string; thema: NewsThema; sprache: "de" | "en";
  titel: string; link: string; datum: string | null; tag: string | null;
  kurz: string | null; bedeutung: string | null; relevanz: number | null; text: string | null;
}
export interface NewsAntwort {
  ok: true; stand: string;
  kurs: KursStand | null;
  meldungen: NewsMeldung[];
  /** Wann zuletzt abgerufen wurde und wie es um die KI-Kurzfassung steht — die Seite sagt es ehrlich. */
  abrufAm: string | null;
  ki: { an: boolean; grund: string | null; ohneKurzfassung: number };
  quellen: { key: string; name: string; thema: NewsThema; url: string }[];
  darfSteuern: boolean;
}
