// ═══════════════════════════════════════════════════════════════════════════
// ARAS — DER AUFTRAGS-CHAT IN DER AKTE (E-408, Akte-Steuerung, 20.10.2026)
//
// Justin (20.10.2026): „wenn man ARAS in der Akte öffnet muss man ARAS ja genau anweisen können was sie den Kunden fragen
// bzw. sagen soll – am besten öffnet sich so ein kurzer Chat wo genau abgefragt wird damit ARAS perfekt arbeiten kann“
//
// REIN (Browser und Server, offline geprüft in scripts/pruef-aras-briefing-chat.ts). Hier steht der LEITFADEN — der Weg durch
// den Chat, der immer trägt, auch ohne KI (KI-Pause, Kostendeckel, lokal ohne Schlüssel):
//   1. Eröffnung: EIN Vorschlag aus dem, was beim Kunden offen ist (Beträge und Tage aus der Akte) + zwei, drei Knöpfe.
//      Geht Anrufen gerade nicht: der Grund in EINEM Satz und „Soll Mara stattdessen schreiben?“ — nie nur ein grauer Knopf.
//   2. Höchstens drei Rückfragen: worum (nur bei „Etwas anderes“) · was genau sagen oder fragen · worauf achten.
//   3. Die Auftragskarte: Ziel · Sagen · Fragen · Nicht versprechen · Achten auf · Wann. Was die Karte zeigt, bekommt ARAS
//      Wort für Wort (auftragTextAusKarte, höchstens AUFTRAG_MAX_ZEICHEN — dieselbe Grenze wie jeder Auftrag aus der Akte).
// WAND: Jeder Satz des Mitarbeiters läuft zuerst durch DIESELBE Prüfung wie der Auftrag (auftragPruefen in
// shared/fiaon-aras-regeln.ts). Was so nicht geht, beantwortet ARAS im Chat mit einer besseren Formulierung („Das darf ich so
// ned sagen — wie wär's mit: …“) — es erreicht nie die Karte. „Versprich ihm kein Limit“ ist dagegen ein Verbot, kein
// Versprechen: ARAS sagt dann, dass das bei ihr ohnehin fix ist (und nimmt es nicht in den Auftrag).
// Die KI (server/lib/fiaon-aras-briefing-chat.ts) darf Antworten natürlicher machen und Freitext in die Karte sortieren; ihre
// Antwort prüft modellAntwortLesen (Form, Längen, Wand, keine Beträge oder Tage, die nicht in der Akte stehen) — sonst gilt
// der Leitfaden.
// ═══════════════════════════════════════════════════════════════════════════
import { auftragPruefen, druckFinden, lastschriftFinden, vertragZusageFinden, karteVersprochenFinden, antragDurchFinden } from "./fiaon-aras-regeln";
import { drohungFinden, kopplungFinden, wandPruefen, kundenSaetze } from "./fiaon-wortverbote";
import { limitPruefen, BANK_SATZ_MUSTER } from "./fiaon-mara-ton";
import { AUFTRAG_MAX_ZEICHEN, AUFTRAG_WANN, berlinTeile, istOffenArt, type AuftragWann, type OffenArt, type OffenPunkt } from "./fiaon-aras";

// ── Die Wand des Chats ─────────────────────────────────────────────────────
/**
 * Bedingte Drohungen in der dritten Person („wenn er nicht zahlt, geht's ans Inkasso“, „… melden wir ihn bei der SCHUFA“)
 * kennt die Kundentext-Wand nicht (sie sucht „wenn Sie nicht …“) — im Chat spricht der Mitarbeiter ÜBER den Kunden. Darum
 * zählt hier jedes Inkasso, Gericht, Mahnverfahren, jede Pfändung und jede SCHUFA-Meldung als Druck (die SCHUFA-Auskunft als
 * Unterlage bleibt frei).
 */
const ZUSATZ_DROHUNG = /\b(?:inkasso\w*|gerichtlich\w*|gericht(?:e|s|en)?|mahnbescheid\w*|mahnverfahren\w*|pf(?:ä|ae)nd\w*|gerichtsvollzieh\w*|zwangsvollstreck\w*|vollstreck\w*|polizei|strafanzeige\w*)\b|\bschufa\b[^.!?]{0,50}\b(?:meld\w*|eintrag\w*|negativ\w*|erf(?:ä|ae)hrt|weitergeb\w*|(?:ü|ue)bergeb\w*)|\b(?:meld\w*|eintrag\w*|(?:ü|ue)bergeb\w*)\b[^.!?]{0,50}\bschufa\b/i;
const ZUSATZ_HINWEIS = "Kein Druck und keine Drohung (kein Gericht, kein Inkasso, keine SCHUFA-Meldung) — ARAS bleibt ruhig und freundlich.";
/** „er bekommt die Karte“ — die Karten-Regel der Telefon-Wand kennt nur „Sie bekommen …“. */
const KARTE_DRITTE = /\b(?:bekommt|erh(?:ä|ae)lt|kriegt)\s+(?:er\s+|sie\s+)?(?:\S+\s+){0,2}?(?:seine|ihre|die|eine)\s+(?:eigene\s+)?(?:visa[- ]?)?(?:kredit)?karte\b|\b(?:seine|ihre|die)\s+(?:eigene\s+)?(?:visa[- ]?)?(?:kredit)?karte\s+(?:\S+\s+){0,4}?(?:bekommt|erh(?:ä|ae)lt|kriegt)\b/i;
/** Die Wand des Chats: dieselbe wie jeder Auftrag aus der Akte (auftragPruefen) — und die Drohung in der dritten Person. Rein. */
export function chatWand(text: string): { ok: boolean; hinweise: string[] } {
  const t = String(text ?? "");
  const h = [...auftragPruefen(t).hinweise];
  if (ZUSATZ_DROHUNG.test(t) && !h.some((x) => /^Kein Druck/.test(x))) h.push(ZUSATZ_HINWEIS);
  // Dieselben harten Telefon-Regeln, an denen ARAS live geprüft wird: keine Karte versprechen, den Antrag nie „durch“ nennen.
  if (karteVersprochenFinden(t) || KARTE_DRITTE.test(t)) h.push("Keine Karte versprechen — ARAS sagt, wie es weitergeht, nie „Sie bekommen die Karte“.");
  if (antragDurchFinden(t)) h.push("Den Antrag nie „durch“ oder „genehmigt“ nennen — er ist abgeschickt.");
  return { ok: h.length === 0, hinweise: Array.from(new Set(h)).slice(0, 4) };
}

// ── Grenzen ────────────────────────────────────────────────────────────────
/** Höchstens so viele Rückfragen nach der Eröffnung — dann steht die Karte. */
export const BRIEFING_RUECKFRAGEN = 3;
export const BRIEFING_MAX = {
  ziel: 140, sagen: 220, frage: 110, fragen: 3, nicht: 90, nichtAnzahl: 3, achtung: 160,
  /** Eine Eingabe des Mitarbeiters. */
  eingabe: 600,
  /** Zeilen in einem Chat (danach nur noch Karte und Auftrag). */
  zeilen: 40,
  /** KI-Antworten je Chat (danach Leitfaden) — der Tagesdeckel bremst zusätzlich. */
  modellZuege: 6,
} as const;
/** Ein offener Chat desselben Mitarbeiters wird so lange fortgesetzt (Panel zu und wieder auf). */
export const BRIEFING_FORTSETZEN_STUNDEN = 2;
/** Die Beschriftung der Karte — dieselben Wörter stehen im Auftragstext für ARAS. */
export const KARTE_LABEL = { ziel: "Ziel", sagen: "Sagen", fragen: "Fragen", nichtVersprechen: "Nicht versprechen", achtung: "Achten auf", wann: "Wann" } as const;

// ── Formen ─────────────────────────────────────────────────────────────────
export type BriefingThema = OffenArt | "alles" | "frei" | "passt";
export type BriefingSchritt = "anlass" | "worum" | "was" | "achtung" | "karte" | "kann_nicht" | "fertig";
export type BriefingStatus = "offen" | "beauftragt" | "mara" | "verworfen";
export const BRIEFING_AKTIONEN = ["mara", "wieder_an", "zuruecknehmen", "schliessen"] as const;
export type BriefingAktion = (typeof BRIEFING_AKTIONEN)[number];
export function istBriefingAktion(v: unknown): v is BriefingAktion { return typeof v === "string" && (BRIEFING_AKTIONEN as readonly string[]).includes(v); }
/** Ein Knopf unter ARAS' letzter Nachricht. `wert` sagt dem Leitfaden, was gemeint ist („thema:rate“, „aktion:mara“ …). */
export interface BriefingChip { text: string; wert: string }
/** Wann ARAS anruft: so bald wie möglich, heute ab, morgen ab (Berlin, HH:MM). */
export type BriefingWann = AuftragWann;
export interface BriefingKarte {
  ziel: string;
  sagen: string;
  /** Fragen an den Kunden (Sie-Form) — höchstens drei. */
  fragen: string[];
  nichtVersprechen: string[];
  /** Uhrzeit, Ton, heikle Themen. */
  achtung: string;
  wann: BriefingWann;
  /** heute_ab / morgen: ab wann (HH:MM); morgen ohne Uhrzeit = 09:00. */
  ab: string | null;
  /** Die offenen Punkte der Akte, die ARAS in diesem Anruf mit erledigt (mit ihren Zahlen im Briefing). */
  punkte: OffenArt[];
}
export interface BriefingZeile { wer: "aras" | "du"; text: string; am: string; von?: string | null }
export interface BriefingStand {
  schritt: BriefingSchritt;
  thema: BriefingThema | null;
  /** Was die Eröffnung vorgeschlagen hat — ein getipptes „Ja“ meint genau das. */
  vorschlag: BriefingThema | null;
  rueckfragen: number;
  karte: BriefingKarte;
  chips: BriefingChip[];
  /** Eine Wand-Antwort wartet auf „Ja, so“: der Vorschlag gilt dann als Antwort auf diesen Schritt. */
  wand: { vorschlag: string; fuer: BriefingSchritt } | null;
  modellZuege: number;
}
/** Was Mara statt des Anrufs tut — immer ein bestehender Weg des Hauses (mit seinen eigenen Wänden). */
export type MaraWeg = "unterlagen" | "zahlungsdaten" | "whatsapp" | "terminlink";
export interface BriefingKontext {
  kunde: { anrede: "Herr" | "Frau" | null; vorname: string | null; nachname: string | null };
  paket: string | null;
  /** Stand in Worten („Kunde, bezahlt“). */
  stand: string | null;
  offen: OffenPunkt[];
  /** Die offene Rate mit Tagen — nur, wenn „rate“ unter den offenen Punkten steht. */
  rate: { nr: number; betrag: string; faelligAm: string; tageOffen: number } | null;
  kontakte: { am: string; wer: string; was: string }[];
  arasNotiz: string | null;
  arasZuletzt: { am: string; ergebnis: string }[];
  bleibtBeiDir: string[];
  geht: { ok: boolean; grund: string | null };
  hinweis: string | null;
  sperre: { aus: boolean; telefonGesperrt: boolean };
  /** Ein Auftrag, der schon wartet (und ob DU ihn zurücknehmen darfst). */
  geplant: { id: number; ab: string; zuruecknehmbar: boolean } | null;
  mara: { weg: MaraWeg } | null;
  heute: { datum: string; wochentag: string; hhmm: string };
}
/** Was die Oberfläche bekommt (eine Form für jede Route). */
export interface BriefingSicht {
  id: number; status: BriefingStatus; schritt: BriefingSchritt;
  zeilen: BriefingZeile[]; chips: BriefingChip[];
  karte: BriefingKarte | null;
  /** Der Text, den ARAS bekommt — genau aus der Karte. */
  auftragText: string | null; zeichen: number; max: number;
  hinweise: string[];
  von: string; vonDat: string; am: string;
  /** „Herrn Müller“ — für die Knöpfe der Oberfläche. */
  kundeDat: string;
  /** Nach dem Auftrag: der eingeplante Anruf (und seine Wiederholungen) und die Anrufe daraus — für den Verlauf in der Karte. */
  planIds: number[]; arasAnrufIds: number[];
  beauftragtAm: string | null;
}

// ── Kleine Helfer ──────────────────────────────────────────────────────────
const glatt = (s: unknown): string => String(s ?? "").replace(/\s+/g, " ").trim();
const gross = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Auf n Zeichen kürzen — am Wortende, mit „…“. Rein. */
export function kuerzen(s: unknown, n: number): string {
  const t = glatt(s);
  if (t.length <= n) return t;
  const schnitt = t.slice(0, n - 1);
  const i = schnitt.lastIndexOf(" ");
  return `${(i > n * 0.6 ? schnitt.slice(0, i) : schnitt).replace(/[\s,;:—–-]+$/, "")}…`;
}
const satzEnde = (s: string): string => { const t = glatt(s); return !t ? "" : /[.!?…]$/.test(t) ? t : `${t}.`; };
const ohneEnde = (s: string): string => glatt(s).replace(/[.!?…]+$/, "");
const FRAGEWORT = /^(?:wie|was|wann|wo|wohin|woher|warum|wieso|weshalb|wer|wem|wen|welche\w*|kann|können|könnten|haben|hätten|sind|ist|gibt|gibt's|schaffen|passt|darf|dürfen|möchten|wollen|soll|sollen|brauchen|wissen)\b/i;
/** Eine Frage endet mit „?“ — eine Anweisung („Frag ihn, ob …“) mit Punkt. Rein. */
function frageEnde(s: string): string {
  const t = ohneEnde(s);
  if (!t) return "";
  return /\?$/.test(glatt(s)) || FRAGEWORT.test(t) ? `${t}?` : `${t}.`;
}
const pad2 = (n: number): string => String(n).padStart(2, "0");
const minuten = (hhmm: string): number => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const UHRZEIT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── Namen: „Herrn Müller“, ihn/ihm — ohne Anrede neutral (der volle Name, ohne Fürwort) ─────────────
export interface KundenNamen { nom: string; dat: string; ihnOpt: string; ihm: string; er: string; frau: boolean; neutral: boolean }
export function kundenNamen(k: Pick<BriefingKontext, "kunde">): KundenNamen {
  const nach = glatt(k.kunde.nachname), vor = glatt(k.kunde.vorname);
  const voll = [vor, nach].filter(Boolean).join(" ");
  if (k.kunde.anrede === "Herr" && nach) return { nom: `Herr ${nach}`, dat: `Herrn ${nach}`, ihnOpt: " ihn", ihm: "ihm", er: "er", frau: false, neutral: false };
  if (k.kunde.anrede === "Frau" && nach) return { nom: `Frau ${nach}`, dat: `Frau ${nach}`, ihnOpt: " sie", ihm: "ihr", er: "sie", frau: true, neutral: false };
  return { nom: voll || "der Kunde", dat: voll || "dem Kunden", ihnOpt: "", ihm: "dem Kunden", er: "er", frau: false, neutral: true };
}
/** Vorschläge sind männlich geschrieben („Frag ihn …“) — bei einer Kundin passt ARAS die Fürwörter an. Rein. */
export function fuerKunde(text: string, n: Pick<KundenNamen, "frau">): string {
  if (!n.frau) return text;
  return text
    .replace(/\bihn\b/g, "sie").replace(/\bihm\b/g, "ihr").replace(/\bIhm\b/g, "Ihr")
    .replace(/\bseinem\b/g, "ihrem").replace(/\bseinen\b/g, "ihren").replace(/\bseiner\b/g, "ihrer").replace(/\bseine\b/g, "ihre").replace(/\bsein\b/g, "ihr")
    .replace(/\bEr\b/g, "Sie").replace(/\ber\b/g, "sie");
}

// ── Die leere Karte und die Karte je Anliegen ───────────────────────────────
export function leereKarte(): BriefingKarte {
  return { ziel: "", sagen: "", fragen: [], nichtVersprechen: [], achtung: "", wann: "bald", ab: null, punkte: [] };
}
const datumIn = (s: string): string | null => /\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/.exec(s)?.[1] ?? null;
const zitatIn = (s: string): string | null => /„([^“”"]{2,120})[“”"]/.exec(s)?.[1] ?? null;
/** „Unterlagen fehlen: Kontoauszug“ → „Kontoauszug“ (sonst das ganze Label). Rein. */
function unterlagenWas(p: OffenPunkt | undefined): string {
  const l = glatt(p?.label);
  return l.replace(/^Unterlagen fehlen:\s*/i, "") || "Unterlagen";
}
function tageText(t: number): string {
  if (t >= 2) return `seit ${t} Tagen offen`;
  if (t === 1) return "seit gestern offen";
  if (t === 0) return "heute fällig";
  if (t === -1) return "morgen fällig";
  return "offen";
}
const punkt = (k: BriefingKontext, art: OffenArt): OffenPunkt | undefined => k.offen.find((p) => p.art === art);
/** Kurz, wie man es im Gespräch sagt: „wegen der Rate“. */
const THEMA_KURZ: Record<BriefingThema, string> = {
  rate: "wegen der Rate", zusage: "wegen der zugesagten Überweisung", erste_rate: "wegen dem Start", zahlung_gemeldet: "wegen der gemeldeten Zahlung",
  unterlagen: "wegen der Unterlagen", rueckruf: "wegen seiner Bitte um einen Anruf", alles: "alles Offene in einem Anruf", frei: "verstanden", passt: "kurz nachfragen",
};
/** Der Knopf „Ja, …“ der Eröffnung. */
const THEMA_JA: Record<OffenArt, string> = {
  rate: "Ja, wegen der Rate", zusage: "Ja, nachfragen", erste_rate: "Ja, Start klären", zahlung_gemeldet: "Ja, Zahlung klären", unterlagen: "Ja, Unterlagen", rueckruf: "Ja, zurückrufen",
};
const THEMA_ANDERS: Record<OffenArt, string> = {
  rate: "Wegen der Rate", zusage: "Wegen der Zusage", erste_rate: "Wegen dem Start", zahlung_gemeldet: "Gemeldete Zahlung", unterlagen: "Unterlagen anfordern", rueckruf: "Seine Anruf-Bitte",
};

/** Die Karte, mit der ein Anliegen startet — „Das Übliche“; die Antworten des Mitarbeiters ersetzen Teile davon. Rein. */
export function standardKarte(thema: BriefingThema, k: BriefingKontext): BriefingKarte {
  const n = kundenNamen(k);
  const kar = leereKarte();
  const r = k.rate;
  switch (thema) {
    case "rate":
      kar.ziel = r ? `Offene Rate ${r.nr} über ${r.betrag} klären — heute überweisen oder einen Tag nennen.` : "Die offene Rate klären — heute überweisen oder einen Tag nennen.";
      kar.sagen = r ? `Die Rate ${r.nr} über ${r.betrag} ist ${tageText(r.tageOffen)} — den Link zur Zahlungsseite gibt's gleich aufs Handy.` : "Die Rate ist offen — den Link zur Zahlungsseite gibt's gleich aufs Handy.";
      kar.fragen = ["Bis wann schaffen Sie die Überweisung?"];
      kar.nichtVersprechen = ["Keine Ratenpause von sich aus anbieten"];
      break;
    case "zusage": {
      const d = datumIn(glatt(punkt(k, "zusage")?.label));
      kar.ziel = `Die zugesagte Überweisung${d ? ` vom ${d}` : ""} klären — sonst einen neuen Tag ausmachen.`;
      kar.sagen = "Bei uns ist die Überweisung noch ned angekommen — kann sich auch überschnitten haben.";
      kar.fragen = ["Ist die Überweisung schon raus — oder wann passt's?"];
      kar.nichtVersprechen = ["Keine Ratenpause von sich aus anbieten"];
      break;
    }
    case "erste_rate":
      kar.ziel = "Start heute: die erste Monatsrate (Aktivierung) klären.";
      kar.sagen = "Mit der ersten Monatsrate geht's sofort los — den Link zur Zahlungsseite gibt's gleich aufs Handy.";
      kar.fragen = ["Schaffen Sie die Überweisung heute noch?"];
      break;
    case "zahlung_gemeldet":
      kar.ziel = "Die gemeldete Zahlung zuordnen: Tag, Bank und Verwendungszweck klären.";
      kar.sagen = "Danke fürs Überweisen — zum Zuordnen brauch ich kurz die Angaben dazu.";
      kar.fragen = ["An welchem Tag und von welcher Bank haben Sie überwiesen?", "Welcher Verwendungszweck stand drin?"];
      kar.nichtVersprechen = ["Nicht sagen, dass die Zahlung schon da ist"];
      break;
    case "unterlagen": {
      const was = unterlagenWas(punkt(k, "unterlagen"));
      kar.ziel = kuerzen(`Fehlende Unterlagen holen: ${was}.`, BRIEFING_MAX.ziel);
      kar.sagen = kuerzen(`Es fehlt noch: ${was} — den Link zum Hochladen schick ich gleich per Mail.`, BRIEFING_MAX.sagen);
      kar.fragen = ["Wann schaffen Sie das Hochladen?"];
      kar.nichtVersprechen = ["Keine Frist setzen"];
      break;
    }
    case "rueckruf": {
      const z = zitatIn(glatt(punkt(k, "rueckruf")?.label));
      kar.ziel = kuerzen(`Seine Bitte um einen Anruf erledigen${z ? `: „${z}“` : ""}.`, BRIEFING_MAX.ziel);
      kar.sagen = "Sie hatten um einen Anruf gebeten — darum meld ich mich.";
      kar.fragen = ["Worum geht's Ihnen genau?"];
      break;
    }
    case "alles":
      kar.ziel = k.offen.length > 1 ? `Alles Offene in einem Anruf klären (${k.offen.length} Punkte, der Reihe nach).` : "Das Offene in einem Anruf klären.";
      kar.nichtVersprechen = k.offen.some((p) => p.art === "rate" || p.art === "zusage") ? ["Keine Ratenpause von sich aus anbieten"] : [];
      break;
    case "passt":
      kar.ziel = "Kurz nachfragen, ob alles passt, und Fragen klären.";
      kar.fragen = ["Passt bei Ihnen alles, oder haben Sie Fragen?"];
      break;
    case "frei":
      break;
  }
  kar.punkte = thema === "alles" ? k.offen.map((p) => p.art) : istOffenArt(thema) && punkt(k, thema) ? [thema] : [];
  kar.sagen = fuerKunde(kar.sagen, n);
  return kar;
}

/** „Was genau?“ — je Anliegen zwei Knöpfe, die die Karte direkt füllen. */
interface WasVariante { wert: string; text: string; anwenden: (kar: BriefingKarte, k: BriefingKontext) => void }
function wasVarianten(thema: BriefingThema | null): WasVariante[] {
  const ueblich = (text: string): WasVariante => ({ wert: "was:ueblich", text, anwenden: () => undefined });
  switch (thema) {
    case "rate":
      return [ueblich("Tag ausmachen + Link schicken"), { wert: "was:problem", text: "Fragen, ob's ein Problem gibt", anwenden: (kar) => {
        kar.fragen = ["Gibt es gerade ein Problem mit der Zahlung?", "Bis wann schaffen Sie die Überweisung?"];
      } }];
    case "zusage":
      return [ueblich("Nachfragen + neuen Tag ausmachen"), { wert: "was:problem", text: "Fragen, ob's ein Problem gibt", anwenden: (kar) => {
        kar.fragen = ["Gibt es gerade ein Problem mit der Zahlung?", "Ist die Überweisung schon raus — oder wann passt's?"];
      } }];
    case "erste_rate":
      return [ueblich("Heute starten + Link schicken"), { wert: "was:fragen", text: "Erst offene Fragen klären", anwenden: (kar) => {
        kar.sagen = ""; kar.fragen = ["Was ist für Sie noch offen, bevor Sie starten?"];
      } }];
    case "zahlung_gemeldet":
      return [ueblich("Tag, Bank und Zweck klären")];
    case "unterlagen":
      return [ueblich("Link schicken + Tag ausmachen"), { wert: "was:erklaeren", text: "Erklären, wofür wir's brauchen", anwenden: (kar, k) => {
        kar.sagen = kuerzen(`Es fehlt noch: ${unterlagenWas(punkt(k, "unterlagen"))} — das brauchen wir, damit es mit dem Antrag weitergeht; der Link zum Hochladen kommt per Mail.`, BRIEFING_MAX.sagen);
      } }];
    case "rueckruf":
      return [ueblich("Erst fragen, worum's geht")];
    case "passt":
      return [ueblich("Nur kurz nachfragen")];
    default:
      return [];
  }
}

// ── Zeit, Fragen, Verbote aus Freitext ─────────────────────────────────────
/** „ab 17 Uhr“, „abends“, „morgen“ … → Wann. null = keine Zeitangabe. Rein (Berlin). */
export function zeitAusText(text: string, jetzt: Date = new Date()): { wann: BriefingWann; ab: string | null } | null {
  const t = glatt(text).toLowerCase();
  const nun = minuten(berlinTeile(jetzt).hhmm);
  const morgen = /\bmorgen\b(?!s)/.test(t);
  const m = /\b(?:ab|nach|erst\s+ab|frühestens|fruehestens|um)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr|h)?\b/.exec(t);
  if (m) {
    const hh = Number(m[1]), mm = Number(m[2] ?? 0);
    if (hh >= 8 && hh <= 20 && mm < 60) {
      const ab = `${pad2(hh)}:${pad2(mm)}`;
      if (morgen) return { wann: "morgen", ab };
      const ziel = hh * 60 + mm;
      if (ziel > nun) return { wann: "heute_ab", ab };
      return nun - ziel < 4 * 60 ? { wann: "bald", ab: null } : { wann: "morgen", ab };
    }
  }
  if (morgen) {
    if (/\babends?\b|\bnach\s+(?:der\s+)?arbeit\b|\bfeierabend\b/.test(t)) return { wann: "morgen", ab: "17:00" };
    if (/\bnachmittags?\b/.test(t)) return { wann: "morgen", ab: "14:00" };
    return { wann: "morgen", ab: null };
  }
  if (/\babends?\b|\bfeierabend\b|\bnach\s+(?:der\s+)?arbeit\b/.test(t)) return nun < 17 * 60 ? { wann: "heute_ab", ab: "17:00" } : { wann: "bald", ab: null };
  if (/\bnachmittags?\b/.test(t)) return nun < 14 * 60 ? { wann: "heute_ab", ab: "14:00" } : { wann: "bald", ab: null };
  if (/\bvormittags?\b|\bin\s+der\s+fr(?:ü|ue)h\b|\bmorgens\b/.test(t)) return nun < 11 * 60 ? { wann: "bald", ab: null } : { wann: "morgen", ab: null };
  if (/\bsofort\b|\bgleich\b|\bjetzt\b|\bheute\b|\bbald\b/.test(t)) return { wann: "bald", ab: null };
  return null;
}
/** Wann in Worten — für Karte und Bestätigung. Rein. */
export function wannText(wann: BriefingWann, ab: string | null): string {
  if (wann === "heute_ab" && ab) return `heute ab ${ab} Uhr`;
  if (wann === "morgen") return `morgen ab ${ab && UHRZEIT_RE.test(ab) ? ab : "09:00"} Uhr`;
  return "so bald wie möglich";
}

const NEG = String.raw`(?:nicht|kein\w*|nie|niemals|nix|nichts)`;
const VERSPRECH = String.raw`(?:versprich\w*|versprech\w*|verspricht|zusag\w*|zusicher\w*|garantier\w*|anbiet\w*|anzubieten|erlass\w*|stundung\w*)`;
const ERWAEHN = String.raw`(?:sag\w*|erw(?:ä|ae)hn\w*|ansprech\w*|anzusprechen|nenn\w*|red\w*|sprich\w*)`;
// Zwischen Verb und Verneinung höchstens zwei Wörter, und keins davon leitet einen Inhalt ein („Sag ihm, dass nichts …“ ist Inhalt).
const DAZWISCHEN = String.raw`(?:\s+(?!dass\b|ob\b|wenn\b|weil\b)\S+){0,2}?`;
const VERBOT_VERSPRECHEN = new RegExp(String.raw`\b${VERSPRECH}\b${DAZWISCHEN}\s+${NEG}\b|\b${NEG}\b(?:\s+\S+){0,4}?\s+${VERSPRECH}\b`, "i");
const VERBOT_SAGEN = new RegExp(String.raw`\b${ERWAEHN}\b${DAZWISCHEN}\s+${NEG}\b|\b${NEG}\b(?:\s+\S+){0,4}?\s+${ERWAEHN}\b`, "i");
/** „Versprich ihm keine Ratenpause“ → „Keine Ratenpause“. Rein. */
function verbotKurz(satz: string): string {
  let t = ohneEnde(satz).replace(/^(?:und|aber|bitte|also)\s+/i, "");
  t = t.replace(/^(?:bitte\s+)?(?:versprich|versprech|biete?|sag|erwähne?|nenne?)\s+(?:ihm|ihr|dem\s+kunden|der\s+kundin|ihnen)\s+(?:bitte\s+)?(?:auch\s+)?(?=kein|nicht|nichts|nie)/i, "");
  return kuerzen(gross(t), BRIEFING_MAX.nicht);
}

/** Welche Wand hält? Für die Antwort im Chat (die Entscheidung trifft auftragPruefen). Rein. */
export type WandArt = "limit" | "karte" | "bank" | "druck" | "kopplung" | "lastschrift" | "vertrag" | "mensch" | "wort" | "sonst";
const MENSCH_THEMA = /\b(k(?:ü|ue)ndig\w*|widerruf\w*|r(?:ü|ue)ckerstatt\w*|erstatt\w*|beschwerde\w*|anwalt\w*|rechtsanwalt\w*|beh(?:ö|oe)rde\w*|verbraucherzentrale)\b/i;
export function wandArt(text: string): { art: WandArt; treffer: string | null } {
  const t = String(text ?? "");
  if (limitPruefen(t).some((f) => f.art === "zusage" || f.art === "freigabe")) return { art: "limit", treffer: null };
  if (karteVersprochenFinden(t) || KARTE_DRITTE.test(t) || antragDurchFinden(t)) return { art: "karte", treffer: null };
  if (BANK_SATZ_MUSTER.test(t) || /\bwir\s+sind\s+(?:keine|nicht\s+die)\s+bank\b/i.test(t)) return { art: "bank", treffer: null };
  if (drohungFinden(t) || druckFinden(t) || ZUSATZ_DROHUNG.test(t)) return { art: "druck", treffer: null };
  if (kopplungFinden(t)) return { art: "kopplung", treffer: null };
  if (lastschriftFinden(t)) return { art: "lastschrift", treffer: null };
  if (vertragZusageFinden(t)) return { art: "vertrag", treffer: null };
  const m = MENSCH_THEMA.exec(t);
  if (m) return { art: "mensch", treffer: m[1] };
  const w = wandPruefen(t).find((x) => x.art !== "floskel");
  if (w) return { art: "wort", treffer: w.treffer };
  return { art: "sonst", treffer: null };
}
function menschThema(treffer: string | null): string {
  const t = String(treffer ?? "").toLowerCase();
  if (/k(?:ü|ue)ndig/.test(t)) return "die Kündigung";
  if (/widerruf/.test(t)) return "der Widerruf";
  if (/erstatt/.test(t)) return "die Erstattung";
  if (/beschwerde/.test(t)) return "die Beschwerde";
  return "Rechtliches";
}
/** Warum ARAS das so nicht sagt — ein halber Satz nach „Das darf ich so ned sagen —“. */
const WAND_GRUND: Record<Exclude<WandArt, "mensch" | "sonst" | "wort">, string> = {
  limit: "ein Limit sag ich nie zu.",
  karte: "die Karte versprech ich nie fix.",
  bank: "die Bank lass ich im Verkauf raus.",
  druck: "Druck und Drohungen sind tabu.",
  kopplung: "Kündigung und Zahlung vermisch ich nie.",
  lastschrift: "Lastschrift gibt's bei uns nicht, er überweist selbst.",
  vertrag: "einen Vertrag schließ ich am Telefon nie ab.",
};
/** „Versprich ihm kein Limit“ — das ist bei ARAS ohnehin fix. Ein Satz je Wand. */
const GRUNDREGEL: Record<WandArt, string> = {
  limit: "Ein Limit sag ich eh nie zu — das ist bei mir fix.",
  karte: "Die Karte versprech ich eh nie fix.",
  bank: "Die Bank bring ich im Verkauf eh ned ins Spiel.",
  druck: "Drohen oder Druck machen tu ich eh nie.",
  kopplung: "Kündigung und Zahlung vermisch ich eh nie.",
  lastschrift: "Lastschrift gibt's bei uns eh ned — er überweist selbst.",
  vertrag: "Einen Vertrag schließ ich am Telefon eh nie ab.",
  mensch: "Kündigung, Widerruf, Erstattung und Rechtliches überlass ich eh dir — dann verbind ich ihn zu dir.",
  wort: "So was versprech ich eh nie.",
  sonst: "Das mach ich eh ned.",
};
/** Der sichere Satz je Wand — eine Formulierung, die ARAS so sagen darf (Anliegen beachtet). */
function sichererSatz(art: WandArt, thema: BriefingThema | null): string | null {
  const geld = thema === "rate" || thema === "zusage" || thema === "erste_rate" || thema === "zahlung_gemeldet";
  switch (art) {
    case "limit": case "bank": return "Ich bleib bei seinem Wunsch und erklär ihm, wie's jetzt weitergeht.";
    case "karte": case "wort": return "Ich erklär ihm, wie's jetzt Schritt für Schritt weitergeht.";
    case "druck":
      if (thema === "unterlagen") return "Bitte ihn freundlich, die Unterlage hochzuladen, und frag, wann's passt.";
      return geld || !thema || thema === "frei" ? "Frag ihn freundlich, bis wann er überweisen kann, und schick ihm den Link zur Zahlung." : "Frag ihn freundlich, wann's ihm passt.";
    case "kopplung": return "Frag ihn freundlich nach der offenen Rate und wann er überweisen kann.";
    case "lastschrift": return "Er überweist selbst — schick ihm den Link zur Zahlungsseite.";
    case "vertrag": return "Schick ihm den Link zum Unterschreiben und erklär kurz, wie's geht.";
    default: return null;
  }
}

export interface WandAntwort { text: string; vorschlag: string | null; hinweise: string[]; art: WandArt }
/**
 * Hält die Wand? Dann ARAS' Antwort im Chat: warum nicht, und eine bessere Formulierung (die selbst durch die Wand geht).
 * Der Vorschlag behält, was am Satz in Ordnung war, und ersetzt nur den Teil, der nicht geht. null = Text ist in Ordnung. Rein.
 */
export function wandAntwort(text: string, thema: BriefingThema | null, n: Pick<KundenNamen, "frau">): WandAntwort | null {
  const t = glatt(text);
  if (!t) return null;
  const pr = chatWand(t);
  if (pr.ok) return null;
  const { art, treffer } = wandArt(t);
  if (art === "mensch") {
    return { art, vorschlag: null, hinweise: pr.hinweise, text: fuerKunde(`Das darf ich ned übernehmen — ${menschThema(treffer)} bleibt bei dir. Wenn er davon anfängt, verbind ich ihn zu dir. Was soll ich sonst klären?`, n) };
  }
  // Was am Text in Ordnung ist, bleibt (Satz für Satz) — dazu der sichere Satz der Wand.
  const gute = kundenSaetze(t).filter((s) => glatt(s).length >= 8 && chatWand(s).ok && wandArt(s).art === "sonst");
  let sicher = sichererSatz(art, thema);
  if (art === "wort" && treffer) {
    const ohne = glatt(t.split(treffer).join(" ")).replace(/\s+([,.!?])/g, "$1");
    if (ohne.length >= 8 && chatWand(ohne).ok) sicher = ohne;
  }
  let vorschlag = [...gute.map(satzEnde), ...(sicher ? [sicher] : [])].filter((s, i, a) => a.indexOf(s) === i).join(" ");
  if (vorschlag && !chatWand(vorschlag).ok) vorschlag = sicher && chatWand(sicher).ok ? sicher : "";
  vorschlag = kuerzen(fuerKunde(vorschlag, n), 260);
  const grund = art === "wort" ? `„${kuerzen(treffer, 40)}“ versprech ich nicht.` : art === "sonst" ? "das geht so nicht durch meine Regeln." : WAND_GRUND[art];
  const satz = vorschlag
    ? `Das darf ich so ned sagen — ${fuerKunde(grund, n)} Wie wär's mit: „${vorschlag}“?`
    : `Das darf ich so ned sagen — ${fuerKunde(grund, n)} Magst du's anders formulieren?`;
  return { art, vorschlag: vorschlag || null, hinweise: pr.hinweise, text: satz };
}

/**
 * Freitext in Sätze: Verbote („Versprich ihm keine Ratenpause“ → Nicht versprechen; „Sag nichts von …“ → Achten auf),
 * und der Rest. Ein Verbot, an dem die Wand hängen bleibt („kein Limit zusagen“), ist bei ARAS ohnehin fix: es kommt nicht in
 * die Karte, ARAS sagt es einmal. Rein.
 */
export function verboteTrennen(text: string): { nicht: string[]; nichtSagen: string[]; fix: string[]; rest: string } {
  const nicht: string[] = [], nichtSagen: string[] = [], fix: string[] = [], rest: string[] = [];
  for (const roh of kundenSaetze(glatt(text))) {
    const s = glatt(roh);
    if (!s) continue;
    const versprechen = VERBOT_VERSPRECHEN.test(s), sagen = !versprechen && VERBOT_SAGEN.test(s);
    if (!versprechen && !sagen) { rest.push(s); continue; }
    if (chatWand(s).ok) (versprechen ? nicht : nichtSagen).push(verbotKurz(s));
    else { const g = GRUNDREGEL[wandArt(s).art]; if (!fix.includes(g)) fix.push(g); }
  }
  return { nicht, nichtSagen, fix, rest: rest.join(" ") };
}

/** „Frag ihn, ob …“ / „…?“ → Fragen, sonst → Sagen. Rein. */
export function wasAusText(text: string): { sagen: string; fragen: string[] } {
  const sagen: string[] = [], fragen: string[] = [];
  for (const roh of kundenSaetze(glatt(text))) {
    const s = glatt(roh).replace(/^(?:und|also|bitte)\s+/i, "");
    if (!s) continue;
    if (/\?$/.test(s) || /^(?:frag|frage|fragst|erfrag\w*|klär\w*\s+ob)\b/i.test(s) || /\bfrag\w*\s+(?:ihn|sie|ihm|ihr|den\s+kunden|die\s+kundin|nach|ob|wann|wie|was|wo|welche\w*)\b/i.test(s)) fragen.push(kuerzen(gross(s), BRIEFING_MAX.frage));
    else sagen.push(gross(s));
  }
  return { sagen: kuerzen(sagen.map(satzEnde).join(" "), BRIEFING_MAX.sagen), fragen: fragen.slice(0, BRIEFING_MAX.fragen) };
}

/** Welche offenen Punkte nennt der Text? („Kontoauszug“ → unterlagen, „Rate“ → rate …) Rein. */
export function punkteAusText(text: string, offen: readonly OffenPunkt[]): OffenArt[] {
  const t = glatt(text).toLowerCase();
  const da = new Set(offen.map((p) => p.art));
  const aus: OffenArt[] = [];
  const nimm = (a: OffenArt) => { if (da.has(a) && !aus.includes(a)) aus.push(a); };
  if (/\b(?:unterlage\w*|kontoauszu\w*|ausweis\w*|dokument\w*|hochlad\w*|upload|schufa)\b/.test(t)) nimm("unterlagen");
  if (/\b(?:rate\w*|zahl\w*|überweis\w*|ueberweis\w*|offen\w*\s+betrag|geld)\b/.test(t)) { nimm("rate"); nimm("zusage"); nimm("erste_rate"); nimm("zahlung_gemeldet"); }
  if (/\b(?:rückruf\w*|rueckruf\w*|zurückruf\w*|zurueckruf\w*|anruf\s+gebeten)\b/.test(t)) nimm("rueckruf");
  return aus;
}

const JA_RE = /^(?:ja|jo|jep|jup|genau|passt|okay|ok|gern|gerne|bitte|mach\s+(?:das|mal)|ja,?\s+(?:bitte|genau|gern|gerne|mach|wegen|dazu|deswegen)\b.*|deswegen|darum)[.! ]*$/i;
const NEIN_RE = /^(?:nein|nö|noe|nee|nix|nichts|passt(?:\s+so)?|alles\s+gut|keine?s?|kein(?:e)?\s+(?:besonderheiten|einschränkung)|nein,?\s+passt(?:\s+so)?)[.! ]*$/i;
const UEBLICH_RE = /^(?:(?:das\s+)?übliche|das\s+ueblich\w*|ja|passt|genau|so\s+(?:wie\s+)?(?:immer|vorgeschlagen)|wie\s+vorgeschlagen|ok|okay)[.! ]*$/i;
/** Beginnt mit einer Anweisung an ARAS („Sag ihm …“, „Frag ihn …“, „Erinnere ihn …“). */
const ANWEISUNG_RE = /^(?:bitte\s+)?(?:sag|sage|teil|teile|richte?|erinner\w*|frag|frage|erkl(?:ä|ae)r\w*|bitte)\b/i;

// ── Fragen und Knöpfe je Schritt ───────────────────────────────────────────
export function frageFuer(schritt: BriefingSchritt, stand: Pick<BriefingStand, "thema">): string {
  switch (schritt) {
    case "worum": return "Klar — worum soll's gehen? Schreib's mir in einem Satz.";
    case "was": return `Passt, ${THEMA_KURZ[stand.thema ?? "frei"]}. Was genau soll ich sagen oder fragen?`;
    case "achtung": return "Und gibt's was, worauf ich achten soll — Uhrzeit, Ton oder heikle Themen?";
    case "karte": return "So würd ich's machen — passt das?";
    default: return "Worum soll's beim Anruf gehen?";
  }
}
export function chipsFuer(schritt: BriefingSchritt, stand: Pick<BriefingStand, "thema" | "vorschlag">, k: BriefingKontext, jetzt: Date = new Date()): BriefingChip[] {
  switch (schritt) {
    case "anlass": return eroeffnungsChips(k);
    case "worum": return k.offen.filter((p) => p.art !== stand.vorschlag).slice(0, 2).map((p) => ({ text: THEMA_ANDERS[p.art], wert: `thema:${p.art}` }));
    case "was": return wasVarianten(stand.thema).map((v) => ({ text: v.text, wert: v.wert }));
    case "achtung": {
      const nun = minuten(berlinTeile(jetzt).hhmm);
      const zeit: BriefingChip = nun < 16 * 60 + 30 ? { text: "Erst ab 17 Uhr", wert: "achtung:abend" } : { text: "Lieber morgen", wert: "achtung:morgen" };
      return [{ text: "Nein, passt so", wert: "achtung:nein" }, zeit, { text: "Ganz behutsam", wert: "achtung:behutsam" }];
    }
    default: return [];
  }
}
function eroeffnungsChips(k: BriefingKontext): BriefingChip[] {
  const top = k.offen[0];
  if (!top) return [{ text: "Kurz nachfragen, ob alles passt", wert: "thema:passt" }, { text: "Etwas anderes", wert: "anders" }];
  const chips: BriefingChip[] = [{ text: THEMA_JA[top.art], wert: `thema:${top.art}` }];
  if (k.offen.length > 1) chips.push({ text: `Alles Offene (${k.offen.length})`, wert: "alles" });
  chips.push({ text: "Etwas anderes", wert: "anders" });
  return chips;
}

// ── Eröffnung ──────────────────────────────────────────────────────────────
/** „… Mara schreibt stattdessen.“ am Ende des Grundes fällt weg — ARAS fragt es ja gleich. Rein. */
export function grundOhneMaraSatz(grund: string): string {
  const g = glatt(grund);
  const ohne = g.replace(/\s*(?:[—–-]\s*)?(?:bis\s+dahin\s+schreibt\s+mara|mara\s+schreibt(?:\s+(?:stattdessen|dann|ihm|ihr))*)\s*\.?\s*$/i, "").trim();
  return satzEnde(ohne.length >= 12 ? ohne : g);
}
const MARA_SATZ: Record<MaraWeg, (n: KundenNamen) => string> = {
  unterlagen: (n) => `Sie schickt ${n.ihm} den Link zum Hochladen — per Mail und WhatsApp.`,
  zahlungsdaten: (n) => `Sie schickt ${n.ihm} die Zahlungsdaten per Mail.`,
  whatsapp: (n) => `Sie schreibt ${n.ihm} auf WhatsApp und übernimmt, sobald ${n.neutral ? "er" : n.er} antwortet.`,
  terminlink: (n) => `Sie schickt ${n.ihm} per Mail einen Link, über den ${n.neutral ? "er" : n.er} sich selbst eine Zeit fürs Gespräch aussucht.`,
};
export function maraSatz(weg: MaraWeg, k: Pick<BriefingKontext, "kunde">): string { return MARA_SATZ[weg](kundenNamen(k)); }
/** Was Mara schickt — für die Meldung danach. */
export const MARA_WAS: Record<MaraWeg, string> = {
  unterlagen: "den Link zum Hochladen", zahlungsdaten: "die Zahlungsdaten", whatsapp: "eine WhatsApp", terminlink: "einen Terminlink",
};

/** Der Vorschlag zur Eröffnung — EIN Satz zum wichtigsten offenen Punkt, mit den Zahlen der Akte. Rein. */
export function vorschlagSatz(k: BriefingKontext): string {
  const n = kundenNamen(k);
  const top = k.offen[0];
  if (!top) return `Bei ${n.dat} ist grad nix offen. Worum soll's beim Anruf gehen?`;
  const l = glatt(top.label);
  switch (top.art) {
    case "rate":
      return k.rate
        ? `Bei ${n.dat} ist die Rate ${k.rate.nr} über ${k.rate.betrag} ${tageText(k.rate.tageOffen)}. Soll ich${n.ihnOpt} deswegen anrufen, oder geht's um was anderes?`
        : `Bei ${n.dat} ist offen: ${ohneEnde(l)}. Soll ich${n.ihnOpt} deswegen anrufen, oder geht's um was anderes?`;
    case "zahlung_gemeldet": {
      const d = datumIn(l);
      return `Bei ${n.dat} ist eine Zahlung gemeldet${d ? ` (am ${d})` : ""}, aber noch ned zugeordnet. Soll ich${n.ihnOpt} anrufen und Tag, Bank und Verwendungszweck klären?`;
    }
    case "zusage": {
      const d = datumIn(l);
      return `Bei ${n.dat} war eine Überweisung${d ? ` für den ${d}` : ""} zugesagt — angekommen ist noch nix. Soll ich freundlich nachfragen?`;
    }
    case "erste_rate":
      return `Bei ${n.dat} ist der Antrag abgeschickt, die erste Rate aber noch offen. Soll ich${n.ihnOpt} anrufen, damit's heute losgeht?`;
    case "unterlagen":
      return `Bei ${n.dat} fehlen noch Unterlagen: ${ohneEnde(unterlagenWas(top))}. Soll ich${n.ihnOpt} anrufen und drum bitten?`;
    case "rueckruf": {
      const z = zitatIn(l);
      return `${gross(n.nom)} hat um einen Anruf gebeten${z ? `: „${z}“` : ""}. Soll ich zurückrufen?`;
    }
  }
  return `Bei ${n.dat} ist offen: ${ohneEnde(l)}. Soll ich deswegen anrufen?`;
}

export function leererStand(): BriefingStand {
  return { schritt: "anlass", thema: null, vorschlag: null, rueckfragen: 0, karte: leereKarte(), chips: [], wand: null, modellZuege: 0 };
}

/** Die Eröffnung: ein Vorschlag mit Knöpfen — oder, wenn Anrufen gerade nicht geht, der Grund in EINEM Satz und Mara. Rein. */
export function briefingEroeffnung(k: BriefingKontext, jetzt: Date = new Date()): { zeilen: string[]; stand: BriefingStand } {
  const s = leererStand();
  const n = kundenNamen(k);
  if (!k.geht.ok) {
    s.schritt = "kann_nicht";
    const grund = grundOhneMaraSatz(k.geht.grund ?? "ARAS kann gerade nicht anrufen.");
    const chips: BriefingChip[] = [];
    if (k.mara) chips.push({ text: "Ja, Mara soll schreiben", wert: "aktion:mara" });
    if (k.geplant?.zuruecknehmbar) chips.push({ text: "Geplanten Anruf zurücknehmen", wert: "aktion:zuruecknehmen" });
    else if (k.sperre.aus && !k.sperre.telefonGesperrt) chips.push({ text: "ARAS wieder einschalten", wert: "aktion:wieder_an" });
    chips.push({ text: k.mara ? "Nein, danke" : "Verstanden", wert: "aktion:schliessen" });
    s.chips = chips.slice(0, 3);
    const angebot = k.mara ? ` Soll Mara stattdessen schreiben? ${MARA_SATZ[k.mara.weg](n)}` : " Das übernimmst am besten du selbst.";
    return { zeilen: [`${grund}${angebot}`], stand: s };
  }
  s.vorschlag = k.offen[0]?.art ?? "passt";
  s.chips = chipsFuer("anlass", s, k, jetzt);
  const zeilen = [vorschlagSatz(k)];
  if (k.hinweis) zeilen.push(`Gut zu wissen: ${satzEnde(k.hinweis)}`);
  return { zeilen, stand: s };
}

// ── Der nächste Schritt ────────────────────────────────────────────────────
export interface WeiterErgebnis {
  /** ARAS' Antwort (eine oder zwei Zeilen). */
  zeilen: string[];
  stand: BriefingStand;
  /** Was im Chat als deine Nachricht steht. */
  eingabe: string;
  /** Hält die Wand: ihre Hinweise (für die Oberfläche). */
  hinweise: string[];
  /** Darf die KI diesen Zug natürlicher machen? (nur bei Freitext, der durch die Wand ging) */
  modellErlaubt: boolean;
}
const kopie = (s: BriefingStand): BriefingStand => JSON.parse(JSON.stringify(s)) as BriefingStand;

/** In den nächsten Schritt — höchstens BRIEFING_RUECKFRAGEN Rückfragen, dann steht die Karte. */
function weiterNach(s: BriefingStand, ziel: BriefingSchritt, k: BriefingKontext, jetzt: Date): string {
  let naechster = ziel;
  // Ohne etwas zum Sagen oder Fragen ist die Karte kein Auftrag — dann lieber noch einmal „was genau?“.
  if (naechster === "karte" && !karteVollstaendig(s.karte) && s.rueckfragen < BRIEFING_RUECKFRAGEN) naechster = "was";
  if ((naechster === "worum" || naechster === "was" || naechster === "achtung") && s.rueckfragen >= BRIEFING_RUECKFRAGEN) naechster = "karte";
  s.schritt = naechster;
  if (naechster === "worum" || naechster === "was" || naechster === "achtung") s.rueckfragen += 1;
  s.chips = chipsFuer(naechster, s, k, jetzt);
  if (naechster === "karte") s.karte = karteEinpassen(s.karte);
  return frageFuer(naechster, s);
}

function themaSetzen(s: BriefingStand, thema: BriefingThema, k: BriefingKontext): void {
  s.thema = thema;
  const alt = s.karte;
  s.karte = standardKarte(thema, k);
  // Was der Mitarbeiter schon gesagt hat (Zeit, Verbote), bleibt.
  if (alt.wann !== "bald") { s.karte.wann = alt.wann; s.karte.ab = alt.ab; }
  for (const x of alt.nichtVersprechen) if (!s.karte.nichtVersprechen.includes(x)) s.karte.nichtVersprechen.push(x);
  if (alt.achtung) s.karte.achtung = alt.achtung;
}
/** „Keine Ratenpause anbieten“ steckt schon in „Keine Ratenpause von sich aus anbieten“ — dann nicht zweimal. Rein. */
const FUELL = new Set(["von", "sich", "aus", "ihm", "ihr", "dem", "der", "die", "das", "bitte", "auch", "zu", "an"]);
const woerter = (x: string): string[] => glatt(x).toLowerCase().replace(/[^a-zäöüß0-9 ]+/gi, " ").split(" ").filter((w) => w && !FUELL.has(w));
function steckt(a: string, b: string): boolean {
  const wa = woerter(a), wb = woerter(b);
  const [kurz, lang] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return kurz.length > 0 && kurz.every((w) => lang.includes(w));
}
function nichtDazu(kar: BriefingKarte, nicht: string[], nichtSagen: string[]): void {
  for (const x of nicht) if (!kar.nichtVersprechen.some((y) => steckt(x, y))) kar.nichtVersprechen.push(x);
  kar.nichtVersprechen = kar.nichtVersprechen.slice(-BRIEFING_MAX.nichtAnzahl);
  if (nichtSagen.length) kar.achtung = kuerzen([kar.achtung, ...nichtSagen.map(satzEnde)].filter(Boolean).map(satzEnde).join(" "), BRIEFING_MAX.achtung);
}
function zeitDazu(kar: BriefingKarte, text: string, jetzt: Date): boolean {
  const z = zeitAusText(text, jetzt);
  if (!z) return false;
  kar.wann = z.wann; kar.ab = z.ab;
  return true;
}
const TON_RE = /\b(?:behutsam\w*|vorsicht\w*|ruhig\w*|freundlich\w*|druck|krank\w*|arbeitslos\w*|deutsch|englisch|trauer\w*|stress\w*|schwierig\w*|sensibel|heikel|sauer|genervt|langsam|laut|schwerhörig\w*|alt\b|älter\w*)\b/i;

/**
 * Der Leitfaden: ein Zug im Chat. Knöpfe (wert) füllen die Karte direkt; Freitext geht zuerst durch die Wand, dann in die
 * Karte (Zeit, Verbote, Sagen/Fragen). Wirft nie. Rein.
 */
export function briefingWeiter(k: BriefingKontext, stand: BriefingStand, ein: { text: string; wert?: string | null }, jetzt: Date = new Date()): WeiterErgebnis {
  const s = kopie(stand);
  const n = kundenNamen(k);
  const wert = String(ein.wert ?? "");
  let text = kuerzen(ein.text, BRIEFING_MAX.eingabe);
  const eingabe = text || (wert === "wand:ja" ? "Ja, so" : "");
  const raus = (zeilen: string[], extra: Partial<WeiterErgebnis> = {}): WeiterErgebnis => ({ zeilen, stand: s, eingabe, hinweise: [], modellErlaubt: false, ...extra });

  if (s.schritt === "fertig") return raus(["Der Auftrag ist schon eingeplant — unten unter „Geplant“ kannst du ihn zurücknehmen."]);
  if (s.schritt === "kann_nicht") {
    return raus([k.mara ? "Anrufen geht grad ned — soll Mara stattdessen schreiben?" : "Anrufen geht grad ned — das übernimmst am besten du selbst."]);
  }

  // Eine Wand-Antwort wartet: „Ja, so“ nimmt den Vorschlag als Antwort auf den Schritt, „anders“ fragt neu.
  if (s.wand) {
    const w = s.wand;
    s.wand = null;
    if (wert === "wand:anders") { s.chips = chipsFuer(s.schritt, s, k, jetzt); return raus(["Klar — schreib's mir anders."]); }
    if (wert === "wand:ja" || (!wert && JA_RE.test(text))) text = w.vorschlag;
  }

  // ── Knöpfe ──
  if (wert && !wert.startsWith("aktion:") && wert !== "wand:ja") {
    if (wert.startsWith("thema:")) {
      const t = wert.slice(6);
      if (t === "passt" || istOffenArt(t)) {
        themaSetzen(s, t as BriefingThema, k);
        return raus([weiterNach(s, t === "passt" ? "achtung" : "was", k, jetzt)]);
      }
    }
    if (wert === "alles") { themaSetzen(s, "alles", k); return raus([weiterNach(s, "achtung", k, jetzt)]); }
    if (wert === "anders") { s.thema = "frei"; s.karte = { ...leereKarte(), wann: s.karte.wann, ab: s.karte.ab, nichtVersprechen: s.karte.nichtVersprechen }; return raus([weiterNach(s, "worum", k, jetzt)]); }
    if (wert.startsWith("was:")) {
      const v = wasVarianten(s.thema).find((x) => x.wert === wert);
      if (v) v.anwenden(s.karte, k);
      s.karte.sagen = fuerKunde(s.karte.sagen, n);
      return raus([weiterNach(s, "achtung", k, jetzt)]);
    }
    if (wert.startsWith("achtung:")) {
      if (wert === "achtung:abend") { s.karte.wann = "heute_ab"; s.karte.ab = "17:00"; }
      if (wert === "achtung:morgen") { s.karte.wann = "morgen"; s.karte.ab = null; }
      if (wert === "achtung:behutsam") s.karte.achtung = kuerzen([s.karte.achtung, "Ganz behutsam und ruhig."].filter(Boolean).join(" "), BRIEFING_MAX.achtung);
      return raus([weiterNach(s, "karte", k, jetzt)]);
    }
    // Unbekannter Knopf: wie Text.
  }
  if (!text) { s.chips = chipsFuer(s.schritt, s, k, jetzt); return raus([frageFuer(s.schritt, s)]); }

  // ── Kurze Antworten ohne Inhalt: „Ja“ auf den Vorschlag, „das Übliche“, „nein, passt“ ──
  if (s.schritt === "anlass" && JA_RE.test(text) && s.vorschlag) {
    themaSetzen(s, s.vorschlag, k);
    return raus([weiterNach(s, s.vorschlag === "passt" ? "achtung" : "was", k, jetzt)]);
  }
  if (s.schritt === "was" && UEBLICH_RE.test(text) && wasVarianten(s.thema).length) return raus([weiterNach(s, "achtung", k, jetzt)]);
  if (s.schritt === "achtung" && NEIN_RE.test(text)) return raus([weiterNach(s, "karte", k, jetzt)]);
  // „Ja, und frag ihn, ob …“ — das Ja gilt dem Vorschlag, der Rest ist schon „was genau“ (und geht gleich durch die Wand).
  let jaVorschlag = false;
  if (s.schritt === "anlass" && s.vorschlag) {
    const m = /^(?:ja|genau|passt|gern|gerne)\b[,.!:;—–-]*\s+(?:und\s+)?(.+)$/i.exec(text);
    if (m) { jaVorschlag = true; text = m[1]; }
  }

  // ── Freitext: Verbote heraus, dann die Wand ──
  const v = verboteTrennen(text);
  const notiz = v.fix.slice(0, 2).map((x) => fuerKunde(x, n));
  if (v.rest) {
    const w = wandAntwort(v.rest, s.thema ?? (jaVorschlag ? s.vorschlag : null), n);
    if (w) {
      s.wand = w.vorschlag ? { vorschlag: w.vorschlag, fuer: s.schritt } : null;
      s.chips = w.vorschlag ? [{ text: "Ja, so", wert: "wand:ja" }, { text: "Ich schreib's anders", wert: "wand:anders" }] : chipsFuer(s.schritt, s, k, jetzt);
      return raus([...notiz, w.text], { hinweise: w.hinweise });
    }
  }
  nichtDazu(s.karte, v.nicht, v.nichtSagen);
  if (jaVorschlag && s.vorschlag) themaSetzen(s, s.vorschlag, k);
  const gemerkt = v.nicht.length || v.nichtSagen.length ? ["Passt, hab ich mir notiert."] : [];
  if (!v.rest) {
    if (jaVorschlag && s.vorschlag) return raus([...notiz, ...gemerkt, weiterNach(s, s.vorschlag === "passt" ? "achtung" : "was", k, jetzt)]);
    if (s.schritt === "achtung") return raus([...notiz, ...gemerkt, weiterNach(s, "karte", k, jetzt)]);
    s.chips = chipsFuer(s.schritt, s, k, jetzt);
    return raus([...notiz, ...gemerkt, s.schritt === "karte" ? "Die Karte steht — passt sie so?" : frageFuer(s.schritt, s)]);
  }
  const rest = v.rest;
  const ok = (zeilen: string[]): WeiterErgebnis => raus([...notiz, ...zeilen], { modellErlaubt: true });

  switch (s.schritt) {
    case "anlass": case "worum": {
      if (jaVorschlag) {
        const w = wasAusText(rest);
        if (w.sagen) s.karte.sagen = w.sagen;
        if (w.fragen.length) s.karte.fragen = w.fragen;
        zeitDazu(s.karte, rest, jetzt);
        return ok([weiterNach(s, "achtung", k, jetzt)]);
      }
      // „Wegen der Rate“ — kurz und eindeutig ein offener Punkt: wie der Knopf.
      const kurz = glatt(rest).split(" ").length <= 6 ? punkteAusText(rest, k.offen) : [];
      if (kurz.length === 1 && !ANWEISUNG_RE.test(rest)) {
        themaSetzen(s, kurz[0], k);
        zeitDazu(s.karte, rest, jetzt);
        return ok([weiterNach(s, "was", k, jetzt)]);
      }
      // Worum es geht, in seinen Worten: der erste Satz ist das Ziel; was danach kommt, ist schon „was genau“.
      // Beginnt er gleich mit einer Anweisung („Sag ihm …“, „Frag ihn …“), ist alles „was genau“ — das Ziel kommt
      // dann vom erkannten offenen Punkt.
      const saetze = kundenSaetze(rest).map(glatt).filter(Boolean);
      const alt = s.karte;
      const punkte = punkteAusText(rest, k.offen);
      s.thema = "frei";
      s.karte = { ...leereKarte(), wann: alt.wann, ab: alt.ab, nichtVersprechen: alt.nichtVersprechen, achtung: alt.achtung, punkte };
      const anweisung = ANWEISUNG_RE.test(saetze[0] ?? "");
      const w = wasAusText((anweisung ? saetze : saetze.slice(1)).join(" "));
      s.karte.ziel = anweisung
        ? (punkte[0] ? standardKarte(punkte[0], k).ziel : "Ein Anliegen vom Team klären.")
        : kuerzen(satzEnde(gross(saetze[0] ?? rest)), BRIEFING_MAX.ziel);
      if (w.sagen) s.karte.sagen = w.sagen;
      if (w.fragen.length) s.karte.fragen = w.fragen;
      zeitDazu(s.karte, rest, jetzt);
      return ok([weiterNach(s, s.karte.sagen || s.karte.fragen.length ? "achtung" : "was", k, jetzt)]);
    }
    case "was": {
      const w = wasAusText(rest);
      if (w.sagen) s.karte.sagen = w.sagen;
      if (w.fragen.length) s.karte.fragen = w.fragen;
      if (!s.karte.ziel) s.karte.ziel = kuerzen(satzEnde(gross(kundenSaetze(rest)[0] ?? rest)), BRIEFING_MAX.ziel);
      for (const p of punkteAusText(rest, k.offen)) if (!s.karte.punkte.includes(p)) s.karte.punkte.push(p);
      zeitDazu(s.karte, rest, jetzt);
      return ok([weiterNach(s, "achtung", k, jetzt)]);
    }
    case "achtung": {
      zeitDazu(s.karte, rest, jetzt);
      s.karte.achtung = kuerzen([s.karte.achtung, satzEnde(gross(rest))].filter(Boolean).join(" "), BRIEFING_MAX.achtung);
      return ok([weiterNach(s, "karte", k, jetzt)]);
    }
    case "karte": {
      // Eine Änderung in Worten: Zeit → Wann, Frage → Fragen, Ton → Achten auf, „Ziel: …“ → Ziel, sonst → Sagen.
      const kar = s.karte;
      const zeit = zeitDazu(kar, rest, jetzt);
      const ziel = /^ziel\s*:\s*(.+)$/i.exec(rest);
      const w = wasAusText(rest);
      if (ziel) kar.ziel = kuerzen(satzEnde(gross(ziel[1])), BRIEFING_MAX.ziel);
      else if (w.fragen.length) kar.fragen = [...kar.fragen, ...w.fragen].slice(-BRIEFING_MAX.fragen);
      if (!ziel && w.sagen) {
        if (TON_RE.test(w.sagen) || (zeit && w.sagen.length < 60)) kar.achtung = kuerzen([kar.achtung, w.sagen].filter(Boolean).join(" "), BRIEFING_MAX.achtung);
        else kar.sagen = kuerzen([kar.sagen, w.sagen].filter(Boolean).join(" "), BRIEFING_MAX.sagen);
      }
      for (const p of punkteAusText(rest, k.offen)) if (!kar.punkte.includes(p)) kar.punkte.push(p);
      s.karte = karteEinpassen(kar);
      s.chips = [];
      return ok(["Passt, hab ich angepasst."]);
    }
  }
  s.chips = chipsFuer(s.schritt, s, k, jetzt);
  return raus([frageFuer(s.schritt, s)]);
}

// ── Karte → Auftragstext (genau das bekommt ARAS) ──────────────────────────
/** Felder säubern und auf ihre Längen kürzen. Rein. */
export function karteSaeubern(roh: Partial<BriefingKarte> | null | undefined, punkteErlaubt: readonly OffenArt[] | null = null): BriefingKarte {
  const r = roh ?? {};
  const liste = (x: unknown, n: number, max: number) => (Array.isArray(x) ? x : typeof x === "string" ? String(x).split(/\n+/) : [])
    .map((y) => kuerzen(y, max)).filter((y) => y.length >= 2).slice(0, n);
  const wann: BriefingWann = (AUFTRAG_WANN as readonly string[]).includes(String(r.wann)) ? (r.wann as BriefingWann) : "bald";
  const ab = typeof r.ab === "string" && UHRZEIT_RE.test(r.ab) ? r.ab : null;
  const punkte = (Array.isArray(r.punkte) ? r.punkte : []).filter(istOffenArt).filter((p, i, a) => a.indexOf(p) === i && (!punkteErlaubt || punkteErlaubt.includes(p)));
  return {
    ziel: kuerzen(r.ziel, BRIEFING_MAX.ziel), sagen: kuerzen(r.sagen, BRIEFING_MAX.sagen),
    fragen: liste(r.fragen, BRIEFING_MAX.fragen, BRIEFING_MAX.frage), nichtVersprechen: liste(r.nichtVersprechen, BRIEFING_MAX.nichtAnzahl, BRIEFING_MAX.nicht),
    achtung: kuerzen(r.achtung, BRIEFING_MAX.achtung), wann, ab: wann === "bald" ? null : ab ?? (wann === "heute_ab" ? "17:00" : null), punkte,
  };
}
/** Der Auftrag für ARAS — eine Zeile, mit denselben Wörtern wie die Karte. Rein. */
export function auftragTextAusKarte(kar: BriefingKarte): string {
  const teile: string[] = [];
  if (kar.ziel) teile.push(`${KARTE_LABEL.ziel}: ${satzEnde(kar.ziel)}`);
  if (kar.sagen) teile.push(`${KARTE_LABEL.sagen}: ${satzEnde(kar.sagen)}`);
  if (kar.fragen.length) teile.push(`${KARTE_LABEL.fragen}: ${kar.fragen.map(frageEnde).filter(Boolean).join(" ")}`);
  if (kar.nichtVersprechen.length) teile.push(`${KARTE_LABEL.nichtVersprechen}: ${satzEnde(kar.nichtVersprechen.map(ohneEnde).join("; "))}`);
  if (kar.achtung) teile.push(`${KARTE_LABEL.achtung}: ${satzEnde(kar.achtung)}`);
  return glatt(teile.join(" "));
}
/**
 * Die Karte passt in den Auftrag (AUFTRAG_MAX_ZEICHEN): erst „Achten auf“ kürzen, dann Verbote, dann die dritte und zweite
 * Frage, dann „Sagen“, zuletzt das Ziel. Was danach auf der Karte steht, ist genau, was ARAS bekommt. Rein.
 */
export function karteEinpassen(roh: BriefingKarte): BriefingKarte {
  const kar = karteSaeubern(roh);
  const zuLang = () => auftragTextAusKarte(kar).length > AUFTRAG_MAX_ZEICHEN;
  const schritte: (() => boolean)[] = [
    () => { if (kar.achtung.length > 80) { kar.achtung = kuerzen(kar.achtung, 80); return true; } return false; },
    () => { if (kar.nichtVersprechen.length > 1) { kar.nichtVersprechen.pop(); return true; } return false; },
    () => { if (kar.fragen.length > 2) { kar.fragen.pop(); return true; } return false; },
    () => { if (kar.sagen.length > 120) { kar.sagen = kuerzen(kar.sagen, 120); return true; } return false; },
    () => { if (kar.fragen.length > 1) { kar.fragen.pop(); return true; } return false; },
    () => { if (kar.achtung) { kar.achtung = ""; return true; } return false; },
    () => { if (kar.ziel.length > 80) { kar.ziel = kuerzen(kar.ziel, 80); return true; } return false; },
    () => { if (kar.sagen.length > 60) { kar.sagen = kuerzen(kar.sagen, 60); return true; } return false; },
    () => { if (kar.nichtVersprechen.length) { kar.nichtVersprechen = []; return true; } return false; },
  ];
  for (const s of schritte) { if (!zuLang()) break; s(); }
  return kar;
}
/** Steht genug auf der Karte für einen Anruf? (Ziel und etwas zu sagen oder zu fragen — oder ein offener Punkt.) Rein. */
export function karteVollstaendig(kar: BriefingKarte): boolean {
  return !!kar.ziel && (!!kar.sagen || kar.fragen.length > 0 || kar.punkte.length > 0);
}
/**
 * Die Karte ganz durch die Wand — Feld für Feld (damit der Hinweis sagt, WO), dann als Ganzes. Ein Verbot, das an der Wand
 * hängen bleibt („Kein Limit zusagen“), fliegt still heraus (ARAS hält es ohnehin). Rein.
 */
export function karteWandPruefen(roh: BriefingKarte, n: Pick<KundenNamen, "frau">): { karte: BriefingKarte; ok: boolean; feld: keyof BriefingKarte | null; antwort: WandAntwort | null; fix: string[] } {
  const kar = karteSaeubern(roh);
  const fix: string[] = [];
  kar.nichtVersprechen = kar.nichtVersprechen.filter((x) => {
    if (chatWand(x).ok) return true;
    const g = GRUNDREGEL[wandArt(x).art];
    if (!fix.includes(g)) fix.push(g);
    return false;
  });
  const felder: [keyof BriefingKarte, string][] = [["ziel", kar.ziel], ["sagen", kar.sagen], ...kar.fragen.map((f) => ["fragen", f] as [keyof BriefingKarte, string]), ["achtung", kar.achtung]];
  for (const [feld, wert] of felder) {
    const a = wandAntwort(wert, null, n);
    if (a) return { karte: kar, ok: false, feld, antwort: a, fix };
  }
  const ganz = auftragTextAusKarte(kar);
  const g = wandAntwort(ganz, null, n);
  if (g) return { karte: kar, ok: false, feld: null, antwort: g, fix };
  return { karte: kar, ok: true, feld: null, antwort: null, fix };
}

// ── Die KI: Anweisung, Verlauf, Antwort lesen ──────────────────────────────
/** Die Akte in Zeilen für das Modell — ohne Telefonnummer, ohne Mail-Adresse. Rein. */
export function kontextText(k: BriefingKontext): string {
  const n = kundenNamen(k);
  const z: string[] = [
    `Kunde: ${n.neutral ? n.nom : `${n.nom}${k.kunde.vorname ? ` (Vorname ${glatt(k.kunde.vorname)})` : ""}`}.`,
    `Heute: ${k.heute.wochentag}, ${k.heute.datum}, ${k.heute.hhmm} Uhr.`,
  ];
  if (k.paket || k.stand) z.push(`Paket/Stand: ${[k.paket, k.stand].filter(Boolean).join(" — ")}.`);
  if (k.offen.length) z.push(`Offen (in dieser Reihenfolge): ${k.offen.map((p, i) => `${i + 1}. ${ohneEnde(p.label)}`).join(" · ")}.`);
  else z.push("Offen: nichts.");
  if (k.rate) z.push(`Offene Rate ${k.rate.nr} über ${k.rate.betrag}, fällig am ${k.rate.faelligAm} (${tageText(k.rate.tageOffen)}).`);
  if (k.kontakte.length) z.push(`Zuletzt: ${k.kontakte.map((x) => `${x.am} ${x.wer}: ${x.was}`).join(" · ")}.`);
  if (k.arasZuletzt.length) z.push(`ARAS zuletzt: ${k.arasZuletzt.map((x) => `${x.am} ${x.ergebnis}`).join(" · ")}.`);
  if (k.arasNotiz) z.push(`Was ARAS wissen muss: „${k.arasNotiz}“.`);
  z.push(`Bleibt immer beim Team (nie ARAS): ${k.bleibtBeiDir.join(", ")}.`);
  return z.join("\n");
}
export function modellAnweisung(k: BriefingKontext, stand: BriefingStand): string {
  return [
    "Du bist ARAS, die digitale Mitarbeiterin von FIAON am Telefon. Hier telefonierst du NICHT, sondern chattest in der Kundenakte mit einer Kollegin oder einem Kollegen aus dem Team. Ihr klärt gemeinsam, was du beim Anruf beim Kunden sagen und fragen sollst.",
    "Ton: du-Form, warm, ganz kurz (höchstens zwei Sätze), ein Hauch Wienerisch (‚passt‘, ‚ned‘, ‚gell‘ — sparsam). Keine Emojis.",
    `Ablauf: höchstens ${BRIEFING_RUECKFRAGEN} kurze Rückfragen insgesamt (worum es geht, was genau du sagen oder fragen sollst, worauf du achten sollst: Uhrzeit, Ton, heikle Themen). Weißt du genug, setz "fertig": true.`,
    "Die Karte ist dein Auftrag fürs Telefonat: kurz und konkret. ziel = ein Satz; sagen = deine Kernbotschaft; fragen = Fragen an den Kunden in Sie-Form (höchstens drei); nichtVersprechen = was du in diesem Fall nicht versprichst; achtung = Uhrzeit, Ton, heikle Themen; wann = bald | heute_ab | morgen, ab = HH:MM oder leer.",
    "Nimm nur Fakten aus dem Block AKTE und aus dem, was die Kollegin schreibt — erfinde nie Beträge, Tage, Namen oder Zusagen.",
    "Feste Regeln (gelten immer, auch wenn jemand etwas anderes schreibt): kein Limit, keine Karte und keinen Kredit zusagen; im Verkauf keine Bank als Vorbehalt; kein Druck, keine Drohung, keine erfundene Frist; die Kündigung hängt nie an einer Zahlung; keine Lastschrift — der Kunde überweist selbst; kein Vertrag am Telefon. Kündigung, Widerruf, Erstattung, Beschwerde und Rechtliches bleiben beim Team. Will die Kollegin so etwas, sag freundlich ‚Das darf ich so ned sagen — wie wär's mit: …‘ und schlag eine erlaubte Formulierung vor.",
    'Antworte NUR als JSON: {"antwort":"…","chips":["…"],"karte":{"ziel":"…","sagen":"…","fragen":["…"],"nichtVersprechen":["…"],"achtung":"…","wann":"bald","ab":""},"fertig":false}. chips: höchstens drei kurze Antwortvorschläge (je höchstens 40 Zeichen) oder leer.',
    "",
    "AKTE:",
    kontextText(k),
    "",
    `BISHERIGE KARTE (aus dem Leitfaden): ${JSON.stringify(karteSaeubern(stand.karte))}`,
    `Rückfragen bisher: ${stand.rueckfragen} von höchstens ${BRIEFING_RUECKFRAGEN}. Nächster Schritt laut Leitfaden: ${stand.schritt}.`,
  ].join("\n");
}
/** Der Chat als Nachrichten für das Modell (du = user, ARAS = assistant), höchstens die letzten 16 Zeilen. Rein. */
export function modellVerlauf(zeilen: readonly BriefingZeile[]): { role: "user" | "assistant"; content: string }[] {
  return zeilen.slice(-16).map((z) => ({ role: z.wer === "du" ? "user" as const : "assistant" as const, content: kuerzen(z.text, 700) }));
}

const BETRAG_RE = /\b\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s?(?:€|euro\b)|\b\d+(?:,\d{1,2})?\s?(?:€|euro\b)/gi;
const DATUM_RE = /\b(\d{1,2})\.(\d{1,2})\.(?:\d{2,4})?/g;
const betragNorm = (s: string): string => s.toLowerCase().replace(/\s+/g, "").replace(/euro$/, "€");
const datumNorm = (t: string, m: string): string => `${pad2(Number(t))}.${pad2(Number(m))}`;
/** Beträge und Tage, die irgendwo in der Akte oder in deinen Nachrichten stehen — alles andere wäre erfunden. Rein. */
export function erlaubteZahlen(k: BriefingKontext, eingaben: readonly string[], jetzt: Date = new Date()): { betraege: Set<string>; daten: Set<string> } {
  const quelle = [kontextText(k), ...eingaben].join("\n");
  const betraege = new Set(Array.from(quelle.matchAll(BETRAG_RE)).map((m) => betragNorm(m[0])));
  const daten = new Set(Array.from(quelle.matchAll(DATUM_RE)).map((m) => datumNorm(m[1], m[2])));
  for (let i = 0; i < 8; i++) { const d = berlinTeile(new Date(jetzt.getTime() + i * 86_400_000)).datum.split("-"); daten.add(`${d[2]}.${d[1]}`); }
  return { betraege, daten };
}
/** Ein Betrag oder Tag im Text, der nicht erlaubt ist — sonst null. Rein. */
export function fremdeZahl(text: string, erlaubt: { betraege: Set<string>; daten: Set<string> }): string | null {
  for (const m of Array.from(text.matchAll(BETRAG_RE))) if (!erlaubt.betraege.has(betragNorm(m[0]))) return m[0];
  for (const m of Array.from(text.matchAll(DATUM_RE))) if (!erlaubt.daten.has(datumNorm(m[1], m[2]))) return m[0];
  return null;
}
export interface ModellZug { antwort: string | null; chips: string[]; karte: BriefingKarte; fertig: boolean; verworfen: string[] }
/**
 * Die Antwort der KI lesen und prüfen. null = unbrauchbar (dann gilt der Leitfaden ganz). Eine Antwort, die nicht durch die
 * Wand geht, fällt weg (antwort null), die Karte kann trotzdem gelten — die Karte muss ganz durch die Wand, darf keine
 * fremden Beträge oder Tage enthalten und muss in den Auftrag passen. Rein.
 */
export function modellAntwortLesen(roh: string | null | undefined, k: BriefingKontext, entwurf: BriefingKarte, eingaben: readonly string[], jetzt: Date = new Date()): ModellZug | null {
  const t = String(roh ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!t) return null;
  let j: any;
  try { j = JSON.parse(t); } catch { const i = t.indexOf("{"), e = t.lastIndexOf("}"); if (i < 0 || e <= i) return null; try { j = JSON.parse(t.slice(i, e + 1)); } catch { return null; } }
  if (!j || typeof j !== "object") return null;
  const n = kundenNamen(k);
  const erlaubt = erlaubteZahlen(k, eingaben, jetzt);
  const verworfen: string[] = [];
  // Die Karte: Felder der KI über den Entwurf (leere Felder lassen den Entwurf stehen).
  const mk = j.karte && typeof j.karte === "object" ? j.karte : {};
  const roheKarte: Partial<BriefingKarte> = {
    ziel: glatt(mk.ziel) || entwurf.ziel, sagen: glatt(mk.sagen) || entwurf.sagen,
    fragen: Array.isArray(mk.fragen) && mk.fragen.length ? mk.fragen : entwurf.fragen,
    nichtVersprechen: Array.isArray(mk.nichtVersprechen) ? mk.nichtVersprechen : entwurf.nichtVersprechen,
    achtung: glatt(mk.achtung) || entwurf.achtung,
    wann: (AUFTRAG_WANN as readonly string[]).includes(String(mk.wann)) ? mk.wann : entwurf.wann,
    ab: typeof mk.ab === "string" && UHRZEIT_RE.test(mk.ab) ? mk.ab : entwurf.ab,
    punkte: entwurf.punkte,
  };
  const wand = karteWandPruefen(karteEinpassen(karteSaeubern(roheKarte)), n);
  if (!wand.ok) return null;
  const karte = karteEinpassen(wand.karte);
  const auftrag = auftragTextAusKarte(karte);
  const fremd = fremdeZahl(auftrag, erlaubt);
  if (fremd) return null;
  if (auftrag.length > AUFTRAG_MAX_ZEICHEN || !chatWand(auftrag).ok) return null;
  // Die Antwort an dich: kurz, ohne Adresse, durch die Wand, ohne fremde Zahlen.
  let antwort: string | null = kuerzen(j.antwort, 320) || null;
  if (antwort && (/https?:\/\/|www\./i.test(antwort) || !chatWand(antwort).ok || fremdeZahl(antwort, erlaubt))) { verworfen.push("antwort"); antwort = null; }
  const chips = (Array.isArray(j.chips) ? j.chips : []).map((c: unknown) => glatt(c)).filter((c: string) => c.length >= 2 && c.length <= 40 && chatWand(c).ok && !fremdeZahl(c, erlaubt)).slice(0, 3);
  return { antwort, chips, karte, fertig: j.fertig === true, verworfen };
}
