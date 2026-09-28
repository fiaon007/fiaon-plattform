// ═══════════════════════════════════════════════════════════════════════════
// WANN MARA SCHWEIGT (28.09.2026, E-248)
//
// Justin am 28.09., mit dem Nagelstudio vor Augen: Auf „Hallo liebe Kunden und
// Kundinnen … Vielen Dank für Ihre Nachricht an [Nagelstudio]! Wir melden uns
// später" schrieb Mara „Alles gut, Ihre Angaben sind gespeichert …" samt
// nacktem Antragslink. Gemessen 23.–28.09.: 18 von 130 freien Antworten gingen
// auf eine Autoantwort oder ein reines „Ok/Danke" nach erledigter Sache — fast
// jede davon mit einer weiteren, oft dringenden Aufgabe an den Betreuer. Im
// Fall K. (Chat A) antwortete Mara auf Florentines „Der Termin heute um
// 20Uhr steht" → „Ok danke" mit einem Rückfallsatz und einer dringenden Aufgabe.
//
// ── DIE REGELN (in dieser Reihenfolge) ─────────────────────────────────────
//   1. AUTOANTWORT: Jede offene Kundennachricht, die istAutoantwort erkennt
//      (Muster DE/EN; ein schwaches Muster zählt nur, wenn sie höchstens 30 s
//      nach unserer letzten Nachricht kam), zählt nicht. Bleibt keine echte
//      übrig → schweigen, keine Aufgabe. Die Nachricht bekommt die Marke
//      fiaon_whatsapp.auto_antwort (für die Oberfläche).
//   2. REINE BESTÄTIGUNG („Ok", „Danke", „👍", „Ja, das stimmt"):
//        · Das Team hat zuletzt frei geschrieben (höchstens 12 h her) → schweigen,
//          auch nachts. Die Kollegin führt. NACHBESSERUNG: Endete ihre Nachricht mit
//          einer Frage oder einem Angebot („Soll ich Sie morgen um 10 Uhr anrufen?"),
//          ist sein „Ok" eine ZUSAGE an sie → „weitergeben": Mara antwortet nicht,
//          das Gespräch wird NICHT still gesetzt, und die Kollegin bekommt eine
//          stille Aufgabe „Kunde hat zugestimmt".
//        · Unsere letzte Nachricht war eine Frage oder ein Angebot → antworten
//          („ok" ist Zustimmung — wie bisher, ZUSTIMMUNG/NUR_JA).
//        · Unsere letzte war eine Vorlage → antworten (er zeigt Interesse).
//        · Maras letzte war ein Rückfallsatz → schweigen (ein Mensch übernimmt).
//        · Mara hat eine eigene Sache erledigt und noch nicht abgeschlossen →
//          EIN kurzer warmer Abschluss (abschlussSatz, ohne Modell).
//        · sonst → schweigen.
//   3. DOPPELT: Er schickt denselben Text, den Mara vor Kurzem schon beantwortet
//      hat → schweigen.
//   4. Sonst antworten — mit Hinweisen für das Modell (Team führt, überkreuzt).
//
// Rein und ohne Datenbank — der Prüfstand (scripts/pruef-mara-wiedergabe.ts)
// spielt echte Gespräche genau hier durch. Die Muster selbst stehen in
// shared/fiaon-mara-ton.ts (eine Erkennung für Server und Oberfläche).
// ═══════════════════════════════════════════════════════════════════════════
import { istAutoantwort, istReineBestaetigung, nachBestaetigung, endetMitFrage, zeitFuerKunde } from "@shared/fiaon-mara-ton";

export interface SchweigenZeile {
  id: number;
  richtung: string;
  text?: string | null;
  knopf?: string | null;
  vorlage?: string | null;
  von?: string | null;
  status?: string | null;
  am: unknown;
}

export type StillGrund = "autoantwort" | "bestaetigung_team" | "bestaetigung_erledigt" | "bestaetigung_rueckfall" | "doppelt";

export interface SchweigenUrteil {
  /** „weitergeben": Mara schreibt nichts, setzt aber NICHT still — die Kollegin erfährt die Zusage. */
  art: "antworten" | "abschluss" | "schweigen" | "weitergeben";
  /** Bei „weitergeben": wer gefragt hat und was. */
  anTeam?: { von: string; frage: string };
  grund: string;
  still?: StillGrund;
  /** Offene Kundennachrichten, die eine Autoantwort sind (Marke für die Oberfläche). */
  autoIds: number[];
  /** Die übrigen offenen Kundennachrichten — nur sie beantwortet Mara. */
  echteIds: number[];
  /** Hinweise für den Auftrag an das Modell (nur bei „antworten"). */
  hinweise: string[];
}

export interface SchweigenEin {
  verlauf: SchweigenZeile[];
  /** Die offenen Kundennachrichten (maraAntwortet: offeneRein). */
  offeneIds: number[];
  jetzt?: Date;
  /** Ist diese Nachricht einer von Maras Rückfallsätzen? */
  istRueckfall?: (text: string) => boolean;
}

/** Zeitpunkt in ms — Date, Zahl oder Text. */
export function msVon(am: unknown): number {
  if (am instanceof Date) return am.getTime();
  if (typeof am === "number") return am;
  const t = new Date(String(am ?? "")).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export const istMaraVon = (von: unknown) => /^mara/i.test(String(von ?? ""));

/** Der Vorname aus „Florentine Lombardi" (für „Florentine führt das Gespräch"). */
function vorname(von: unknown): string {
  return String(von ?? "").trim().split(/\s+/)[0] || "das Team";
}

/**
 * Ein Ja, das nur BESTÄTIGT („Ja, das stimmt", „Genau", „Ist richtig") — kein
 * bloßes „Ja" (das ist Zustimmung zu einem Angebot) und kein „Ja gern".
 * Gefunden in einem Chat (B): vier fast gleiche Bestätigungen in vier Minuten.
 */
const JA_BESTAETIGT = /^(?:(?:ja|jo|jep|jawohl)[\s,]+)?(?:(?:das|dass|des)\s+)?(?:stimmt|ist\s+(?:richtig|korrekt|so)|richtig|korrekt|genau(?:\s+so)?|so\s+ist\s+es)(?:\s+so)?[\s.!]*$/i;

/** Ein „Ok", „Danke", „👍", „Ja, das stimmt" — nichts, worauf eine Antwort wartet. */
export function istBestaetigung(text: unknown): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  return istReineBestaetigung(t) || (t.length <= 40 && JA_BESTAETIGT.test(t));
}

const norm = (t: unknown) => String(t ?? "").toLowerCase().replace(new RegExp("[^\\p{L}\\p{N}]+", "gu"), " ").trim();

export function schweigen(ein: SchweigenEin): SchweigenUrteil {
  const jetzt = (ein.jetzt ?? new Date()).getTime();
  const rueckfall = ein.istRueckfall ?? (() => false);
  const zeilen = ein.verlauf.slice().filter((z) => z.status !== "fehler").sort((a, b) => Number(a.id) - Number(b.id));
  const offenSet = new Set(ein.offeneIds.map(Number));
  const offene = zeilen.filter((z) => z.richtung === "rein" && offenSet.has(Number(z.id)));
  const text = (z: SchweigenZeile) => String(z.text || z.knopf || "");
  const hinweise: string[] = [];
  if (!offene.length) return { art: "antworten", grund: "Keine offene Nachricht erkannt.", autoIds: [], echteIds: [], hinweise };

  // ── 1. Autoantworten ────────────────────────────────────────────────────
  const autoIds: number[] = [];
  const echte: SchweigenZeile[] = [];
  for (const z of offene) {
    const unsere = zeilen.filter((x) => x.richtung === "raus" && Number(x.id) < Number(z.id)).pop();
    const sek = unsere ? (msVon(z.am) - msVon(unsere.am)) / 1000 : null;
    // Ein Mensch, der UNS etwas fragt („Was sind Ihre Öffnungszeiten?"), ist keine Autoantwort — die
    // sprechen als „wir" („Wie können wir Ihnen helfen?", „Wir melden uns später").
    const menschFragt = /\?/.test(text(z)) && !/\b(?:wir|uns|unser\w*)\b/i.test(text(z));
    if (!menschFragt && istAutoantwort(text(z), { sekundenNachUnserer: sek != null && Number.isFinite(sek) && sek >= 0 ? sek : null })) autoIds.push(Number(z.id));
    else echte.push(z);
  }
  if (!echte.length) {
    return { art: "schweigen", still: "autoantwort", grund: "Automatische Antwort — kein Mensch hat geschrieben.", autoIds, echteIds: [], hinweise };
  }
  const echteIds = echte.map((z) => Number(z.id));
  const erste = echte[0];
  const davor = zeilen.filter((x) => Number(x.id) < Number(erste.id));
  const letzteRaus = davor.filter((x) => x.richtung === "raus").pop() ?? null;
  const letzteFreie = davor.filter((x) => x.richtung === "raus" && !x.vorlage).pop() ?? null;
  const teamFuehrt = !!(letzteFreie && !istMaraVon(letzteFreie.von) && jetzt - msVon(letzteFreie.am) <= 12 * 3_600_000);

  // ── 2. Reine Bestätigungen ──────────────────────────────────────────────
  if (echte.every((z) => istBestaetigung(text(z)))) {
    // Nachbesserung E-248 (Gegenprobe team.mts): Hat die Kollegin zuletzt GEFRAGT, ist sein
    // „Ok passt" ihre Antwort — egal wie alt. Nicht still setzen, sondern ihr weitergeben.
    const teamFrage = letzteRaus && !letzteRaus.vorlage && !istMaraVon(letzteRaus.von)
      && (endetMitFrage(text(letzteRaus)) || /\?/.test(text(letzteRaus).replace(/https?:\/\/\S+/g, "")));
    if (letzteRaus && teamFrage) {
      return { art: "weitergeben", grund: `Zusage auf die Frage von ${vorname(letzteRaus.von)} — ${vorname(letzteRaus.von)} führt; sie bekommt Bescheid.`, anTeam: { von: String(letzteRaus.von ?? ""), frage: text(letzteRaus).slice(0, 200) }, autoIds, echteIds, hinweise };
    }
    if (letzteRaus && !letzteRaus.vorlage && !istMaraVon(letzteRaus.von) && teamFuehrt) {
      return { art: "schweigen", still: "bestaetigung_team", grund: `Bestätigung nach einer Nachricht von ${vorname(letzteRaus.von)} — die Kollegin/der Kollege führt.`, autoIds, echteIds, hinweise };
    }
    if (letzteRaus && !letzteRaus.vorlage && istMaraVon(letzteRaus.von) && rueckfall(text(letzteRaus))) {
      return { art: "schweigen", still: "bestaetigung_rueckfall", grund: "Bestätigung nach einem Rückfallsatz — ein Mensch übernimmt, Mara schreibt nichts nach.", autoIds, echteIds, hinweise };
    }
    // Eine Frage irgendwo in unserer Nachricht wartet auf Antwort — „Meinen Sie den 1. Oktober? Dann halte ich
    // den Tag fest." endet nicht mit „?", und „Ja genau" darauf ist Zustimmung, kein Abschluss.
    const frage = (t: string) => endetMitFrage(t) || /\?/.test(t.replace(/https?:\/\/\S+/g, ""));
    const letzte = letzteRaus
      ? { von: (letzteRaus.vorlage ? "vorlage" : istMaraVon(letzteRaus.von) ? "mara" : "team") as "mara" | "team" | "vorlage", frage: frage(text(letzteRaus)) }
      : null;
    // Hat Mara ihre letzte Nachricht selbst schon auf ein „Ok" geschrieben, war sie der Abschluss.
    const vorMara = letzteRaus && istMaraVon(letzteRaus.von) && !letzteRaus.vorlage
      ? zeilen.filter((x) => x.richtung === "rein" && Number(x.id) < Number(letzteRaus.id)).pop() ?? null : null;
    const schonAbgeschlossen = !!(vorMara && istBestaetigung(text(vorMara)));
    const urteil = nachBestaetigung({ letzte, eigeneSacheErledigt: letzte?.von === "mara", schonAbgeschlossen });
    if (urteil === "schweigen") {
      return { art: "schweigen", still: "bestaetigung_erledigt", grund: letzte?.von === "team" ? "Bestätigung nach einer älteren Team-Nachricht ohne offene Frage." : "Bestätigung nach erledigter Sache — alles gesagt.", autoIds, echteIds, hinweise };
    }
    if (urteil === "abschluss") return { art: "abschluss", grund: "Bestätigung nach Maras erledigter Sache — ein kurzer warmer Abschluss.", autoIds, echteIds, hinweise };
    hinweise.push(letzte?.frage
      ? "Sein kurzes „Ok/Ja“ antwortet auf deine letzte Frage — es ist seine Zustimmung: mach genau den Schritt, den du angeboten hast."
      : "Sein kurzes „Ok“ antwortet auf unsere Vorlage — er zeigt Interesse: ein warmer Satz und der nächste Schritt.");
  }

  // ── 3. Doppelt geschickt ────────────────────────────────────────────────
  const letzteMara = davor.filter((x) => x.richtung === "raus" && !x.vorlage && istMaraVon(x.von)).pop() ?? null;
  if (letzteMara && jetzt - msVon(letzteMara.am) <= 15 * 60_000) {
    const beantwortet = new Set(zeilen.filter((x) => x.richtung === "rein" && Number(x.id) < Number(letzteMara.id) && msVon(letzteMara.am) - msVon(x.am) <= 15 * 60_000).map((x) => norm(text(x))).filter(Boolean));
    if (echte.every((z) => norm(text(z)) && beantwortet.has(norm(text(z))))) {
      return { art: "schweigen", still: "doppelt", grund: "Dieselbe Nachricht noch einmal — Mara hat sie gerade beantwortet.", autoIds, echteIds, hinweise };
    }
    // Überkreuzt: Er schrieb, während Maras Antwort schon unterwegs war (Befund #417/#419).
    const sek = (msVon(erste.am) - msVon(letzteMara.am)) / 1000;
    // Auch leicht VOR Maras Zeitstempel: Sein Telefon stempelt beim Absenden (Befund #418: 1,2 s vor #417).
    if (Number.isFinite(sek) && sek >= -30 && sek <= 25) {
      hinweise.push(`ÜBERKREUZT: Seine Nachricht kam ${sek < 1 ? "praktisch gleichzeitig mit" : `${Math.round(sek)} Sekunden nach`} deiner letzten Antwort — er hat sie wahrscheinlich noch nicht gelesen. Wiederhole nichts daraus; steht die Antwort schon dort, genügt ein kurzer Satz, der darauf zeigt („Genau, über den Link oben geht es direkt los.“).`);
    }
  }

  // ── 4. Antworten ────────────────────────────────────────────────────────
  if (teamFuehrt && letzteFreie) {
    hinweise.push(`${vorname(letzteFreie.von)} aus dem Team hat zuletzt geschrieben (${new Date(msVon(letzteFreie.am)).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })} Uhr) — knüpf an ${vorname(letzteFreie.von)}s Nachricht an und widersprich ihr nicht.`);
  }
  return { art: "antworten", grund: "Echte Nachricht.", autoIds, echteIds, hinweise };
}

/**
 * Der kurze warme Abschluss nach Maras erledigter Sache — ohne Modell, ohne
 * Link, ohne Frage, ohne Pitch. Mit Termin: „Gern, dann bis morgen um 20 Uhr!"
 */
export function abschlussSatz(ein: { termin?: { beginn: unknown } | null; kunde?: string; jetzt?: Date }): string {
  const jetzt = ein.jetzt ?? new Date();
  const b = ein.termin ? msVon(ein.termin.beginn) : NaN;
  if (Number.isFinite(b) && b > jetzt.getTime()) return `Gern, dann bis ${zeitFuerKunde(new Date(b), jetzt)}!`;
  const k = String(ein.kunde ?? "").toLowerCase();
  const stunde = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).formatToParts(jetzt).find((p) => p.type === "hour")?.value ?? "12") % 24;
  if (/schön\w*\s+(abend|tag|wochenende)|schoen\w*\s+(abend|tag)/.test(k)) {
    const was = /wochenende/.test(k) ? "ein schönes Wochenende" : /abend/.test(k) ? "einen schönen Abend" : "einen schönen Tag";
    return `Danke, Ihnen auch ${was}!`;
  }
  // „Danke" bekommt „Sehr gern!"; ein „Ja, das stimmt" oder „Ok" ein „Danke Ihnen!".
  const auftakt = /dank/.test(k) ? "Sehr gern!" : "Danke Ihnen!";
  return `${auftakt} ${stunde >= 17 || stunde < 4 ? "Einen schönen Abend noch." : "Einen schönen Tag noch."}`;
}
