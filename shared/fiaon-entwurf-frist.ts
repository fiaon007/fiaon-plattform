// ═══════════════════════════════════════════════════════════════════════════
// ENTWÜRFE BLEIBEN NICHT LIEGEN — DIE 24-STUNDEN-REGEL (19.10.2026, E-401 6/6)
//
// Justin (19.10.2026): „Mach Mara und co fix fertig, damit die wirklich GUT arbeitet und selbst arbeitet.“
//
// ── DER BEFUND (Produktion, nur lesend, 19.10.2026) ─────────────────────────
// 229 ungesendete Mara-Entwürfe, 179 davon älter als 7 Tage, der älteste vom 08.09. Solange ein Entwurf
// wartet, schließt sich die Aufgabe „Kunde hat geschrieben“ nie (uebergabeSchliessen). Von den 229 hatte
// der Kunde bei 102 längst wieder geschrieben; bei weiteren war die Sache erledigt (Kündigung oder Storno
// gebucht, Zahlung gebucht, Gespräch geführt). 89 brauchten wirklich noch eine Antwort.
//
// ── DIE REGEL ───────────────────────────────────────────────────────────────
// NEUE Entwürfe (die Zeile entstand ab dem Einbau — Merker frist_ab): Liegt der Entwurf 24 Stunden,
// prüft Mara neu:
//   · Ist er NICHT MEHR NÖTIG (nichtMehrNoetig), wird er abgelegt — mit Grund, ohne Mail an den Kunden.
//   · Sonst schreibt Mara die Antwort EINMAL mit dem heutigen Stand neu (derselbe Weg wie jede Antwort:
//     mailBearbeiten) — und sendet sie, wenn die Regeln es erlauben (automatischErlaubt, Übergabe-Regel,
//     E-248-Doppelsperre, E-393-Sendesperre, Modus des Postfachs); sonst bleibt genau EIN Entwurf.
//     Neu geschrieben wird nur 08:00–20:00 Uhr (Berlin), nie in der KI-Pause, nie bei Testkonto oder
//     Vertriebssperre und nie, wenn die Kundenmail älter als NEU_HOECHSTENS_TAGE ist.
//   · Widerruf und Anwalt/Behörde entscheidet Justin (Entscheidungskarte): Mara schreibt sie nicht neu;
//     abgelegt werden sie nur, wenn der Kunde danach noch einmal schrieb (die neuere Mail trägt den Fall
//     weiter) oder — beim Widerruf — der Storno gebucht ist.
//   · Kunden von FIAON Global fasst die Regel nie an (E-272: Global raus aus Privat-Abläufen).
// ALTBESTAND (ohne Merker, vor dem Einbau): NIE senden, NIE neu schreiben. Der Probelauf zählt, was nicht
//   mehr nötig ist und was offen bleibt; ablegen erst, wenn Justin den Schalter einschaltet (Vorgabe AUS).
//
// „Nicht mehr nötig“ heißt, NACH dem Eingang der Kundenmail:
//   kunde_schrieb — derselbe Kunde schrieb noch einmal (ohne „ignoriert“ und ohne Doppel/Nachtrag dieser
//                   Mail); Maras Antwort darauf sieht diese Mail im Verlauf.
//   storno        — die Bestellung ist storniert.
//   kuendigung    — eine Kündigung ist gebucht (nicht zurückgenommen); die Bestätigung schickt der
//                   Kündigungsweg.
//   gespraech     — ein Gespräch fand statt (Termin „erledigt“ oder ein Anruf mit Ergebnis „erreicht“).
//   zahlung       — eine Zahlung ist gebucht, und die Mail drehte sich um Zahlung (Kategorie „zahlung“
//                   oder „habe bezahlt“) — nicht bei Beschwerde, Bestreiten oder „kann nicht zahlen“.
//
// Hier steht nur die REGEL — rein, ohne Datenbank, im Prüfstand geprüft (scripts/pruef-entwurf-frist.ts).
// Ablegen und neu schreiben tut der Server (server/lib/fiaon-postmeister-frist.ts), nie ein Modell.
// ═══════════════════════════════════════════════════════════════════════════
import { imVersandfenster, naechstesFenster } from "./fiaon-nicht-erreicht-nachfass";

/** Nach so vielen Stunden prüft Mara einen neuen Entwurf neu. */
export const FRIST_STUNDEN = 24;
/** Neu geschrieben wird nur, wenn die Kundenmail höchstens so alt ist (E-371: nach Wochen verwirrt eine Antwort mehr). */
export const NEU_HOECHSTENS_TAGE = 7;
/** Je Lauf höchstens so viele Neufassungen (KI-Kosten, Dauer des 5-Minuten-Takts). */
export const NEU_JE_LAUF = 3;
/** Je Lauf höchstens so viele Ablagen. */
export const ABLAGE_JE_LAUF = 60;
/** Der Lauf prüft höchstens alle so viele Minuten (der Takt läuft alle 5). */
export const LAUF_ABSTAND_MIN = 15;
/** Der Schalter für den Altbestand (fiaon_settings). Nur „an“ schaltet ein — fehlt er: AUS. */
export const ALTBESTAND_SCHALTER = "postmeister_altbestand_ablegen";
/** Der Anfang der Begründung einer abgelegten Zeile — daran zählt der Stand die Ablagen. */
export const ABLAGE_KOPF = "Nicht mehr nötig (24-Stunden-Regel)";
/** Die Begründung, während Mara neu schreibt. */
export const NEU_KOPF = "24-Stunden-Regel: Mara schreibt mit heutigem Stand neu";

/** Schalterwert lesen — anders als die meisten Schalter: Vorgabe AUS (Justin entscheidet). */
export function altbestandSchalterAn(wert: unknown): boolean {
  return String(wert ?? "").trim().toLowerCase() === "an";
}

export type FristGrund = "kunde_schrieb" | "storno" | "kuendigung" | "gespraech" | "zahlung";
export const GRUND_TEXT: Record<FristGrund, string> = {
  kunde_schrieb: "der Kunde hat danach noch einmal geschrieben",
  storno: "die Bestellung ist inzwischen storniert",
  kuendigung: "die Kündigung ist inzwischen gebucht",
  gespraech: "inzwischen fand ein Gespräch statt",
  zahlung: "die Zahlung ist inzwischen gebucht",
};
/** Kurz — für Zahlen und Chips. */
export const GRUND_KURZ: Record<FristGrund, string> = {
  kunde_schrieb: "Kunde schrieb danach",
  storno: "Storno gebucht",
  kuendigung: "Kündigung gebucht",
  gespraech: "Gespräch geführt",
  zahlung: "Zahlung gebucht",
};
export const FRIST_GRUENDE: FristGrund[] = ["kunde_schrieb", "storno", "kuendigung", "gespraech", "zahlung"];

type Zeit = string | Date | null | undefined;
const ms = (z: Zeit): number | null => {
  if (z == null || z === "") return null;
  const t = (z instanceof Date ? z : new Date(z)).getTime();
  return Number.isFinite(t) ? t : null;
};
const tagMonat = (z: Zeit): string => {
  const t = ms(z);
  return t == null ? "" : new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(new Date(t));
};

/** Was der Server über einen wartenden Entwurf weiß — vollständig, damit die Regel nichts erraten muss. */
export interface EntwurfFristFakten {
  id: number;
  /** Merker frist_ab gesetzt: die Zeile entstand ab dem Einbau. Ohne Merker: Altbestand. */
  neu: boolean;
  /** Seit wann der Entwurf liegt (entwurf_geprueft_am, sonst Anlage der Zeile). */
  entwurfAm: Zeit;
  /** Eingang der Kundenmail. */
  mailAm: Zeit;
  /** Wann die 24-Stunden-Regel ihn schon einmal neu schrieb (frist_neu_am) — höchstens einmal je Mail. */
  neuGeschriebenAm: Zeit;
  /** Begründung der Zeile („Übergabe an den Betreuer: Widerruf“ …). */
  begruendung: string | null;
  kategorien: readonly string[] | null;
  flags: Record<string, unknown> | null;
  /** Kunde von FIAON Global (globalKundeSql) — oder als solcher übergeben. */
  global: boolean;
  /** Die erste spätere Mail desselben Kunden (ohne „ignoriert“, ohne Doppel/Nachtrag). */
  spaetereMail: { id: number; am: Zeit } | null;
  stornoAm: Zeit;
  kuendigungAm: Zeit;
  gespraechAm: Zeit;
  zahlungAm: Zeit;
}

/** Was um den Entwurf herum gilt — vom Server gelesen. */
export interface FristUmfeld {
  /** Modus des Postfachs (Not-Aus, Einstellung, Vorgabe): „aus“ hält auch das Ablegen an. */
  modus: "auto" | "hybrid" | "entwurf" | "aus";
  /** KI-Pause (E-246): kein Neuschreiben. */
  kiPausiert: boolean;
  /** Schalter für den Altbestand (Vorgabe aus). */
  altbestandAblegen: boolean;
  /** Testkonto oder Vertriebssperre (is_blocked am Kopf) — dann schreibt die Automatik nicht neu. Null = frei. */
  sperre: string | null;
}

export type FristUrteil =
  | { art: "warten"; grund: string }
  | { art: "ablegen"; grund: string; wegen: FristGrund }
  /** Altbestand, nicht mehr nötig — nur der Probelauf zählt ihn, solange der Schalter aus ist. */
  | { art: "ablegen_probe"; grund: string; wegen: FristGrund }
  | { art: "neu_schreiben"; grund: string }
  | { art: "bleibt"; grund: string }
  | { art: "auslassen"; grund: string };

/** Braucht dieser Entwurf eine Entscheidung von Justin (Widerruf, Anwalt/Behörde)? Rein. */
export function heikelFall(begruendung: string | null | undefined, flags: Record<string, unknown> | null | undefined): "widerruf" | "rechtlich" | null {
  const g = String(begruendung ?? "");
  const f = (flags ?? {}) as Record<string, unknown>;
  if (/widerruf/i.test(g) || f.widerruf === true) return "widerruf";
  if (/rechtlich|anwalt|beh(?:ö|oe)rde/i.test(g) || f.rechtlich === true || f.droht_anwalt === true) return "rechtlich";
  return null;
}

/** Ist der Entwurf ein Global-Fall (Zeile oder Begründung)? Rein. */
export function globalFall(f: Pick<EntwurfFristFakten, "global" | "begruendung">): boolean {
  return f.global === true || /FIAON Global/i.test(String(f.begruendung ?? ""));
}

/** Drehte sich die Mail um Zahlung — und nur darum (keine Beschwerde, kein Bestreiten, kein „kann nicht zahlen“)? Rein. */
export function zahlungsThema(kategorien: readonly string[] | null | undefined, flags: Record<string, unknown> | null | undefined): boolean {
  const k = new Set((kategorien ?? []).map(String));
  const f = (flags ?? {}) as Record<string, unknown>;
  if (f.bestreitet === true || f.beschwerde === true || f.zahlungsunfaehig === true) return false;
  if (k.has("beschwerde") || k.has("rechtlich")) return false;
  return k.has("zahlung") || f.zahlung_behauptet === true;
}

/**
 * Ist der Entwurf nicht mehr nötig — und warum? Rein. Zählt nur, was NACH dem Eingang der Kundenmail geschah
 * (die Fakten tragen nur solche Zeitpunkte; ein früherer gilt hier nicht).
 */
export function nichtMehrNoetig(f: EntwurfFristFakten): { wegen: FristGrund; grund: string } | null {
  const nach = (z: Zeit) => {
    const t = ms(z), m = ms(f.mailAm);
    return t != null && (m == null || t > m);
  };
  const mit = (wegen: FristGrund, zusatz: string) => ({ wegen, grund: `${GRUND_TEXT[wegen]}${zusatz}` });
  if (f.spaetereMail && nach(f.spaetereMail.am)) {
    return mit("kunde_schrieb", ` (Mail #${f.spaetereMail.id} vom ${tagMonat(f.spaetereMail.am)}) — Maras Antwort darauf sieht diese Mail im Verlauf`);
  }
  // Widerruf und Anwalt/Behörde: nur die neuere Mail oder (Widerruf) der gebuchte Storno erledigen sie.
  const heikel = heikelFall(f.begruendung, f.flags);
  if (heikel === "rechtlich") return null;
  if (nach(f.stornoAm)) return mit("storno", ` (${tagMonat(f.stornoAm)})`);
  if (heikel) return null;
  if (nach(f.kuendigungAm)) return mit("kuendigung", ` (${tagMonat(f.kuendigungAm)}) — die Bestätigung schickt der Kündigungsweg`);
  if (nach(f.gespraechAm)) return mit("gespraech", ` (${tagMonat(f.gespraechAm)})`);
  if (nach(f.zahlungAm) && zahlungsThema(f.kategorien, f.flags)) return mit("zahlung", ` (${tagMonat(f.zahlungAm)})`);
  return null;
}

/**
 * Das Urteil über einen wartenden Entwurf. Rein. Reihenfolge:
 *   Global → auslassen · Postfach aus → warten · jünger als 24 h → warten · nicht mehr nötig → ablegen
 *   (Altbestand nur mit Schalter, sonst ablegen_probe) · Altbestand → bleibt · schon einmal neu geschrieben,
 *   Widerruf/Recht, Sperre, zu alt → bleibt · KI-Pause/außerhalb 08–20 Uhr → warten · sonst neu_schreiben.
 */
export function fristUrteil(f: EntwurfFristFakten, u: FristUmfeld, jetzt: Date = new Date()): FristUrteil {
  if (globalFall(f)) return { art: "auslassen", grund: "Kunde von FIAON Global — Justin antwortet selbst (E-272)" };
  if (u.modus === "aus") return { art: "warten", grund: "Postfach steht auf „aus“" };
  const seit = ms(f.entwurfAm);
  const frist = FRIST_STUNDEN * 3_600_000;
  if (seit != null && jetzt.getTime() - seit < frist) {
    return { art: "warten", grund: `Entwurf liegt noch keine ${FRIST_STUNDEN} Stunden` };
  }
  const weg = nichtMehrNoetig(f);
  if (weg) {
    if (f.neu || u.altbestandAblegen) return { art: "ablegen", grund: weg.grund, wegen: weg.wegen };
    return { art: "ablegen_probe", grund: weg.grund, wegen: weg.wegen };
  }
  if (!f.neu) return { art: "bleibt", grund: "Altbestand — Mara sendet ihn nie von selbst" };
  if (ms(f.neuGeschriebenAm) != null) return { art: "bleibt", grund: "schon einmal neu geschrieben — genau ein Entwurf bleibt" };
  const heikel = heikelFall(f.begruendung, f.flags);
  if (heikel) return { art: "bleibt", grund: heikel === "widerruf" ? "Widerruf — entscheidest du (Entscheidungskarte)" : "Anwalt, Behörde oder Recht — entscheidest du (Entscheidungskarte)" };
  if (u.sperre) return { art: "bleibt", grund: `${u.sperre} — Mara schreibt nicht von selbst neu` };
  const mail = ms(f.mailAm);
  if (mail != null && jetzt.getTime() - mail > NEU_HOECHSTENS_TAGE * 86_400_000) {
    return { art: "bleibt", grund: `Kundenmail älter als ${NEU_HOECHSTENS_TAGE} Tage — eine Antwort jetzt verwirrt mehr, als sie hilft` };
  }
  if (u.kiPausiert) return { art: "warten", grund: "KI pausiert" };
  if (!imVersandfenster(jetzt)) return { art: "warten", grund: "außerhalb 08:00–20:00 Uhr" };
  return { art: "neu_schreiben", grund: `Entwurf liegt seit über ${FRIST_STUNDEN} Stunden — Mara schreibt mit heutigem Stand neu` };
}

/** Die Begründung einer abgelegten Zeile. Rein. */
export function ablageBegruendung(grund: string): string {
  return `${ABLAGE_KOPF}: ${grund}`.slice(0, 400);
}

// ═══════════════════════════════════════════════════════════════════════════
// LÄSST DIE REGEL EINEN ENTWURF LIEGEN? (E-406 B3, Nachbesserung nach Prüfer-Fund, 19.10.2026)
//
// Ein GELBER Entwurf (Ampel „Mails beantworten“ auf Gelb, shared/fiaon-mara-ampel.ts) ist keine Karte — er verlässt
// sich darauf, dass diese Regel ihn nach 24 Stunden neu schreibt und sendet. Sagt sie zur Fälligkeit aber „bleibt“
// (Altbestand ohne Merker, schon einmal neu geschrieben, Widerruf/Recht, Testkonto/Vertriebssperre, Kundenmail älter
// als NEU_HOECHSTENS_TAGE) oder „auslassen“ (Global), läge er für immer: keine Mail an den Kunden, keine Karte für
// Justin. Dann muss er eine normale Karte sein. Gerechnet mit DERSELBEN fristUrteil — keine zweite Regel.
// ═══════════════════════════════════════════════════════════════════════════

/** Wann die Regel einen Entwurf frühestens neu schreibt: 24 h nach dem Entwurf, frühestens jetzt, im Versandfenster. Rein. */
export function fristFaellig(entwurfAm: Zeit, jetzt: Date = new Date()): Date {
  const ab = ms(entwurfAm) ?? jetzt.getTime();
  return naechstesFenster(new Date(Math.max(jetzt.getTime(), ab + FRIST_STUNDEN * 3_600_000)));
}

/** Was es für „lässt liegen?“ braucht — die Zeile selbst; „nicht mehr nötig“ erfährt erst der Lauf. */
export type LiegenFakten = Pick<EntwurfFristFakten, "neu" | "entwurfAm" | "mailAm" | "neuGeschriebenAm" | "begruendung">
  & Partial<Pick<EntwurfFristFakten, "flags" | "kategorien" | "global">>;

/**
 * Lässt die 24-Stunden-Regel diesen Entwurf liegen? null = nein (sie schreibt ihn zur Fälligkeit neu und sendet, wenn die
 * Regeln es erlauben — sonst kommt er als Karte); sonst IHR Grund. fristUrteil zur Fälligkeit (fristFaellig), ohne
 * KI-Pause und Postfach-Modus (die verschieben nur). `sperre` wie im Lauf (Testkonto, Vertriebssperre, Störung). Rein.
 */
export function fristLaesstLiegen(g: LiegenFakten, sperre: string | null, jetzt: Date = new Date()): string | null {
  const ab = ms(g.entwurfAm) ?? jetzt.getTime();
  const f: EntwurfFristFakten = {
    id: 0, neu: g.neu === true, entwurfAm: new Date(ab), mailAm: g.mailAm ?? null, neuGeschriebenAm: g.neuGeschriebenAm ?? null,
    begruendung: g.begruendung ?? null, kategorien: g.kategorien ?? [], flags: g.flags ?? null, global: g.global === true,
    spaetereMail: null, stornoAm: null, kuendigungAm: null, gespraechAm: null, zahlungAm: null,
  };
  const u = fristUrteil(f, { modus: "auto", kiPausiert: false, altbestandAblegen: false, sperre }, fristFaellig(new Date(ab), jetzt));
  return u.art === "bleibt" || u.art === "auslassen" ? u.grund : null;
}
