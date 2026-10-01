// ═══════════════════════════════════════════════════════════════════════════
// MARAS TERMINE FÜR DEN CHEF — Form, Gruppen, Reihenfolge (29.09.2026, E-260)
//
// Justin: „ALLE Termine, die MARA macht, muss ich sehen können als Chef auf
// einer eigenen übersichtlichen cleanen Seite." — der Reiter „Termine" im
// Mara-Steuerpult (/chef/s/mara?reiter=termine).
//
// WARUM IN shared/: Die Gruppen und die Reihenfolge brauchen der Server
// (GET /chef/mara/termine), die Seite (ChefMaraTermine.tsx) und der Prüfstand
// (scripts/pruef-mara-termine.ts). Eine Regel, ein Ort (AGENTS.md, „Eine
// Filterregel gehört in shared/"). Alles hier ist rein: `jetzt` kommt als
// Parameter, Berliner Kalendertage über formatToParts (Zeit-Falle 04.09.2026).
// ═══════════════════════════════════════════════════════════════════════════
import { uhrzeitenIn } from "./fiaon-mara-ton";

/** Die Wege, auf denen Mara einen Termin macht — maßgeblich ist NUR fiaon_termine.herkunft (Analyse E-260, 1.2). */
export const MARA_WEGE = ["mara_whatsapp", "mara_mail", "mara_whatsapp_link"] as const;
export type MaraWegTermin = (typeof MARA_WEGE)[number];
export const istMaraWeg = (h: unknown): h is MaraWegTermin => (MARA_WEGE as readonly string[]).includes(String(h ?? ""));

/** Ein Termin gilt 15 Minuten nach Beginn noch als „jetzt" — danach wartet der Kunde. */
export const JETZT_SPIELRAUM_MIN = 15;
/**
 * Ein gebuchter Termin, der in höchstens so vielen Minuten beginnt, geht in der
 * Glasfläche einem wartenden Kunden vor — der Kunde erwartet den Anruf genau jetzt.
 */
export const JETZT_VORLAUF_MIN = 15;
/**
 * Offene, nie abgearbeitete verpasste Termine: so viele Tage zurück — dieselbe
 * Grenze wie /agent/termine (server/routes/fiaon-termin.ts). Gegenprüfung 29.09.:
 * vorher 3 Tage, sechs wartende Kunden (einer A, in Justins eigenem Kalender) fehlten.
 */
export const VERPASST_OFFEN_TAGE = 14;

export type TerminGruppe = "jetzt" | "wartet" | "heute" | "morgen" | "woche" | "spaeter" | "erledigt";
export const TERMIN_GRUPPEN: { key: TerminGruppe; titel: string; leer: string }[] = [
  { key: "jetzt", titel: "Jetzt", leer: "Gerade steht kein Termin an." },
  { key: "wartet", titel: "Kunde wartet", leer: "Niemand wartet." },
  { key: "heute", titel: "Heute", leer: "Heute steht kein Termin mehr an." },
  { key: "morgen", titel: "Morgen", leer: "Morgen steht noch nichts." },
  { key: "woche", titel: "Diese Woche", leer: "Diese Woche steht sonst nichts." },
  { key: "spaeter", titel: "Später", leer: "Später steht nichts." },
  { key: "erledigt", titel: "Erledigt & abgesagt · 3 Tage", leer: "In den letzten drei Tagen ist nichts abgeschlossen." },
];

export type TerminFilter = "alle" | "mara" | "abwesend";

/** Stufe, wie die Telefonkartei sie nennt (KarteiLage) — hier nur die, die in eine Reihenfolge gehören. */
export type TerminStufe = "A" | "B" | "C" | "rate" | "bezahlt" | "abbrecher" | "ausgeschlossen" | "storniert";

export interface TerminZeile {
  id: number;
  beginn: string;
  dauerMin: number;
  status: "gebucht" | "verpasst" | "erledigt" | "abgesagt";
  /** Nur bei „verpasst": schon abgearbeitet (erledigt_am gesetzt)? */
  abgeschlossen: boolean;
  abgesagtVon: string | null;
  angelegtAm: string;
  art: { text: string; ton: string; erklaerung: string };
  weg: { herkunft: string | null; text: string };
  mara: {
    weg: MaraWegTermin; text: string; kanal: "WhatsApp" | "E-Mail";
    /**
     * Maras Zusage an den Kunden: die erste WhatsApp NACH der Buchung, die genau
     * eine Uhrzeit — die des Termins — und den passenden Tag nennt und nicht
     * fragt (zusagePasst). null, wenn keine passt oder der Termin seitdem verschoben wurde.
     */
    zusage: string | null;
    /**
     * Der Beginn, den Maras Protokoll bei der Buchung festhielt — nur gesetzt, wenn
     * der Termin SEITDEM verschoben wurde (dann gilt ihre Zusage nicht mehr).
     */
    verschobenVon: string | null;
    anliegen: string | null;
    pruefungOk: boolean | null;
    pruefung: string | null;
  } | null;
  /** Mara-Termin, jünger als MARA_NEU_STUNDEN. */
  neu: boolean;
  bei: { id: number; vorname: string; name: string; istVertreter: boolean };
  betreuer: { id: number; vorname: string } | null;
  /** Liegt der Termin bei einem Abwesenden und vor „bis"? Dann ruft der Vertreter an. */
  beiAbwesendem: boolean;
  person: { id: number; name: string; stufe: TerminStufe | null; stufeText: string | null; stand: string | null };
  /** Die offene Zahlung aus der Telefonkartei (karteEinzeln → zahlung, E-181) — null ohne offene Zahlung. */
  geld: { art: "bestellung" | "rate"; betragCents: number | null; referenz: string; rateNr: number | null; faelligAm: string | null; zahlungsseite: string } | null;
  telefonWaehlbar: string | null;
  telefonAnzeige: string | null;
  akteLink: string | null;
  /** Andere offene Termine, die sich damit überschneiden (egal bei wem) — der Vertreter ruft sie alle an. */
  gleichzeitigMit: { id: number; uhrzeit: string; bei: string }[];
  /** Startgespräch und FIAON Global schließt man in der Akte ab (Freischaltung, Firmen-Cockpit). */
  abschliessbar: boolean;
  notiz: string | null;
  gruppe: TerminGruppe;
}

export interface TeamRueckruf {
  id: number; am: string; agentVorname: string | null; personId: number | null; ref: string | null;
  name: string; notiz: string | null; telefonWaehlbar: string | null; telefonAnzeige: string | null; akteLink: string | null;
}

export interface AbwesenheitSicht {
  /** In Kraft (gesetzt, nicht abgelaufen, Vertreter kann anrufen). */
  an: boolean;
  /** Gesetzt und nicht abgelaufen — auch wenn sie wegen `problem` gerade nicht greift. */
  gesetzt: boolean;
  bis: string | null;
  /** Ist eine gesetzte Abwesenheit schon vorbei (oder beendet)? Dann wann. */
  endeteAm: string | null;
  endeteWie: "abgelaufen" | "beendet" | null;
  vertreter: { id: number; name: string; vorname: string; anrufName: string } | null;
  /** Warum eine gesetzte Abwesenheit gerade nicht greift — roter Satz. */
  problem: string | null;
  fuer: number[];
  abwesend: { id: number; vorname: string }[];
  team: { id: number; vorname: string }[];
  kandidaten: { id: number; name: string; vorname: string; zeiten: boolean }[];
  /** „09:00–13:00, 14:00–18:00" — die Zeiten des Vertreters heute. */
  zeitenHeute: string | null;
  /** Freie Plätze des Vertreters vor „bis" ab jetzt (mit dem, was er ohnehin anruft). */
  freieHeute: number | null;
  freieBisEnde: number | null;
  verlauf: { am: string; von: string; was: string }[];
  /** Vorschläge für „bis" (ISO) — der nächste Werktag 09:00 u. a. */
  vorschlaege: { text: string; iso: string }[];
}

export interface TerminUebersicht {
  ok: true;
  stand: string;
  abwesenheit: AbwesenheitSicht;
  zaehler: {
    wartet: number; heute: number; morgen: number; woche: number; spaeter: number; erledigt: number;
    offen: number; mara: number; maraOffen: number; beiAbwesenden: number; geldOffenCents: number;
  };
  termine: TerminZeile[];
  teamRueckrufe: TeamRueckruf[];
  uebergaben: {
    offen: number; letzte48h: number;
    /**
     * Vertretung (01.10.2026): Wohin NEUE Übergaben von Mara gehen — an den Vertreter (ist er ein
     * Mitarbeiter; Heikles zusätzlich aufs Board) oder aufs Board des Betreibers. Fehlt = Board (E-260).
     */
    neueAn?: { art: "vertreter" | "board"; name: string | null };
  };
}

// ── Berliner Kalender ──────────────────────────────────────────────────────
const TAG = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
/** Der Berliner Kalendertag als „JJJJ-MM-TT". */
export function berlinTagIso(d: Date): string {
  const t: Record<string, string> = {};
  for (const p of TAG.formatToParts(d)) t[p.type] = p.value;
  return `${t.year}-${t.month}-${t.day}`;
}
/** JJJJ-MM-TT plus n Kalendertage. */
export function tagPlus(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** ISO-Wochentag eines Kalendertags: 1 = Montag … 7 = Sonntag. */
export function wochentagIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/**
 * Die Stufe aus priority_tier — für Zeilen ohne Kartei-Karte (erledigt, abgesagt).
 * DIESELBE Regel wie lageVon in server/lib/fiaon-telefonkartei.ts (Hausregel:
 * C = Lead ohne Antrag, A/B/C nie anders deuten). Gegenprüfung 29.09.: vorher
 * wurde aus Tier 3 immer „C" — Abbrecher (tier_reason antrag_abgebrochen) standen
 * als „Lead ohne Antrag" da, Ausgeschlossene ohne Stufe. Die Telefonkartei rechnet
 * mit offener Bestellung/Rate genauer; ohne diese Angaben: Tier 0 = bezahlt,
 * ohne Tier = B mit Antrag, sonst C.
 */
export function stufeAusTier(tier: unknown, tierReason: unknown, hatAntrag: boolean): TerminStufe | null {
  if (tier === null || tier === undefined || tier === "") return hatAntrag ? "B" : "C";
  const t = Number(tier);
  if (t === 1) return "A";
  if (t === 2) return "B";
  if (t === 3) return String(tierReason ?? "").trim() === "nur_lead" ? "C" : "abbrecher";
  if (t === 0) return "bezahlt";
  if (t === -1) return "ausgeschlossen";
  return null;
}

const WOCHENTAG_NAMEN = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
const MONAT_NAMEN = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const TEILE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function berlinTeile(d: Date): { tag: string; t: number; m: number; wt: number; uhr: string } {
  const x: Record<string, string> = {};
  for (const p of TEILE.formatToParts(d)) x[p.type] = p.value;
  const tag = `${x.year}-${x.month}-${x.day}`;
  return { tag, t: Number(x.day), m: Number(x.month), wt: wochentagIso(tag) % 7, uhr: `${x.hour}:${x.minute}` };
}

/**
 * Ist dieser Text Maras ZUSAGE für genau diesen Termin? Rein.
 *   · genau EINE Uhrzeit, und zwar die des Termins (ein Angebot „18:30, 9:30
 *     oder 20:10?" ist keine Zusage),
 *   · keine Frage am Ende,
 *   · der Tag passt, gerechnet ab dem Versand: „heute", „morgen", „übermorgen",
 *     ein Wochentag, „1. Oktober" oder „01.10." müssen den Termintag treffen.
 * Gegenprüfung 29.09.: vorher zählte die erste Nachricht ab 60 s VOR der Buchung
 * mit der Uhrzeit — bei drei Terminen war das Maras Angebot, bei einem meinte das
 * „morgen" im Zitat einen anderen Tag.
 */
export function zusagePasst(text: string, beginn: string | Date, gesendetAm: string | Date): boolean {
  const b = new Date(beginn);
  const g = new Date(gesendetAm);
  if (Number.isNaN(b.getTime()) || Number.isNaN(g.getTime())) return false;
  const roh = String(text ?? "").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
  if (!roh || /\?\s*$/.test(roh)) return false;
  const bt = berlinTeile(b);
  const zeiten = uhrzeitenIn(roh);
  if (zeiten.length !== 1 || zeiten[0] !== bt.uhr) return false;
  const klein = roh.toLowerCase().replace(/guten\s+morgen/g, " ");
  const abstandTage = Math.round((Date.parse(`${bt.tag}T12:00:00Z`) - Date.parse(`${berlinTeile(g).tag}T12:00:00Z`)) / 86_400_000);
  // „ü" ist für \b kein Wortzeichen — deshalb die Grenze von Hand.
  if (/(?<![a-zäöüß])übermorgen(?![a-zäöüß])/.test(klein)) { if (abstandTage !== 2) return false; }
  else if (/\bmorgen\b/.test(klein)) { if (abstandTage !== 1) return false; }
  else if (/\bheute\b/.test(klein)) { if (abstandTage !== 0) return false; }
  const tage = WOCHENTAG_NAMEN.filter((w) => new RegExp(`\\b${w}\\b`).test(klein));
  if (tage.length && !tage.includes(WOCHENTAG_NAMEN[bt.wt])) return false;
  for (const m of Array.from(klein.matchAll(/(?<![\d.])(\d{1,2})\.\s*([a-zä]+)/g))) {
    const mon = MONAT_NAMEN.indexOf(m[2]);
    if (mon >= 0 && (Number(m[1]) !== bt.t || mon + 1 !== bt.m)) return false;
  }
  for (const m of Array.from(klein.matchAll(/(?<![\d.:])(\d{1,2})\.(\d{1,2})\.(?!\d)/g))) {
    if (Number(m[2]) > 12) continue; // „um 9.30." ist eine Uhrzeit, kein Datum
    if (Number(m[1]) !== bt.t || Number(m[2]) !== bt.m) return false;
  }
  return true;
}

/** Offen = noch anzurufen: gebucht, oder verpasst und von niemandem abgearbeitet. */
export function istOffen(t: Pick<TerminZeile, "status" | "abgeschlossen">): boolean {
  return t.status === "gebucht" || (t.status === "verpasst" && !t.abgeschlossen);
}

/**
 * Die Gruppe eines Termins — ohne „jetzt" (das ist genau EINER und wird über
 * alle Zeilen bestimmt, siehe gruppieren).
 */
export function gruppeOhneJetzt(t: Pick<TerminZeile, "status" | "abgeschlossen" | "beginn">, jetzt: Date): Exclude<TerminGruppe, "jetzt"> {
  if (!istOffen(t)) return "erledigt";
  const b = new Date(t.beginn);
  if (t.status === "verpasst" || b.getTime() < jetzt.getTime() - JETZT_SPIELRAUM_MIN * 60_000) return "wartet";
  const heute = berlinTagIso(jetzt);
  const tag = berlinTagIso(b);
  if (tag === heute) return "heute";
  if (tag === tagPlus(heute, 1)) return "morgen";
  const sonntag = tagPlus(heute, 7 - wochentagIso(heute));
  if (tag <= sonntag) return "woche";
  return "spaeter";
}

/** Rang der Stufe in „Kunde wartet": A → B → Rate offen → C → Bezahlt → Rest (Entscheidung F7). */
export const STUFE_RANG: Record<string, number> = { A: 0, B: 1, rate: 2, C: 3, bezahlt: 4 };

/** Wartet der Kunde (verpasst und offen, oder mehr als 15 Minuten über der Zeit)? Rein. */
export function istWartend(t: Pick<TerminZeile, "status" | "abgeschlossen" | "beginn">, jetzt: Date): boolean {
  return gruppeOhneJetzt(t, jetzt) === "wartet";
}

/**
 * Was die Glasfläche gerade zeigt (die Zeile mit gruppe „jetzt"):
 *   „jetzt"     — ein gebuchter Termin, der gerade dran ist (≤ 15 Min. bis Beginn),
 *   „wartet"    — ein Kunde, der wartet (der dringendste: A vor B vor Rate vor C),
 *   „naechster" — der nächste gebuchte Termin.
 */
export function fokusArt(t: Pick<TerminZeile, "status" | "abgeschlossen" | "beginn">, jetzt: Date): "jetzt" | "wartet" | "naechster" {
  if (istWartend(t, jetzt)) return "wartet";
  return new Date(t.beginn).getTime() <= jetzt.getTime() + JETZT_VORLAUF_MIN * 60_000 ? "jetzt" : "naechster";
}

/**
 * Alle Zeilen einer Gruppe zuordnen und ordnen:
 *   · „jetzt" = GENAU EINE Zeile, die Glasfläche — wen Justin als Nächstes anruft:
 *     ein gebuchter Termin, der gerade dran ist (≤ 15 Min. bis Beginn, bis 15 Min.
 *     danach); sonst der dringendste wartende Kunde; sonst der nächste gebuchte
 *     Termin. Gegenprüfung 29.09.: vorher nahm das Glas nur gebuchte Termine — es
 *     zeigte „Als Nächstes 15:40", während drei Kunden warteten, und im Leerzustand
 *     „keinen offenen Termin mehr" über der roten Liste.
 *   · „wartet" nach Stufe, dann Betrag absteigend, dann der neueste zuerst,
 *   · sonst nach Uhrzeit; „erledigt" der jüngste zuerst.
 */
export function gruppieren<T extends Pick<TerminZeile, "id" | "status" | "abgeschlossen" | "beginn" | "person" | "geld">>(
  zeilen: T[], jetzt: Date,
): (T & { gruppe: TerminGruppe })[] {
  const mit = zeilen.map((z) => ({ ...z, gruppe: gruppeOhneJetzt(z, jetzt) as TerminGruppe }));
  const rang = (z: T) => STUFE_RANG[String(z.person.stufe ?? "")] ?? 9;
  const wartReihe = (a: T, b: T) => rang(a) - rang(b)
    || (Number(b.geld?.betragCents ?? 0) - Number(a.geld?.betragCents ?? 0))
    || b.beginn.localeCompare(a.beginn) || a.id - b.id;
  const gebucht = mit.filter((z) => z.gruppe !== "wartet" && z.gruppe !== "erledigt" && z.status === "gebucht")
    .sort((a, b) => a.beginn.localeCompare(b.beginn) || a.id - b.id);
  const wartende = mit.filter((z) => z.gruppe === "wartet").sort(wartReihe);
  const naechster = gebucht[0] ?? null;
  const dran = !!naechster && new Date(naechster.beginn).getTime() <= jetzt.getTime() + JETZT_VORLAUF_MIN * 60_000;
  const fokus = dran ? naechster : wartende[0] ?? naechster;
  if (fokus) fokus.gruppe = "jetzt";
  return mit.sort((a, b) => {
    const ga = TERMIN_GRUPPEN.findIndex((g) => g.key === a.gruppe);
    const gb = TERMIN_GRUPPEN.findIndex((g) => g.key === b.gruppe);
    if (ga !== gb) return ga - gb;
    if (a.gruppe === "wartet") return wartReihe(a, b);
    if (a.gruppe === "erledigt") return b.beginn.localeCompare(a.beginn) || b.id - a.id;
    return a.beginn.localeCompare(b.beginn) || a.id - b.id;
  });
}

/** Der Filter über den Zeilen — „Nur Mara" und „Bei Abwesenden". */
export function filtern<T extends Pick<TerminZeile, "mara" | "beiAbwesendem">>(zeilen: T[], f: TerminFilter): T[] {
  if (f === "mara") return zeilen.filter((z) => !!z.mara);
  if (f === "abwesend") return zeilen.filter((z) => z.beiAbwesendem);
  return zeilen;
}

/** Andere offene Termine, die sich mit diesem überschneiden (mit Dauer). */
export function ueberschneidungen<T extends Pick<TerminZeile, "id" | "beginn" | "dauerMin" | "status" | "abgeschlossen">>(z: T, alle: T[]): T[] {
  if (z.status !== "gebucht") return [];
  const von = new Date(z.beginn).getTime();
  const bis = von + (z.dauerMin || 20) * 60_000;
  return alle.filter((x) => x.id !== z.id && x.status === "gebucht" && (() => {
    const v = new Date(x.beginn).getTime();
    return v < bis && v + (x.dauerMin || 20) * 60_000 > von;
  })());
}
