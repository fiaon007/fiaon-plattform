// ═══════════════════════════════════════════════════════════════════════════
// MARA FÜHRT DEN BETRIEB — „MARA HEUTE“, MAILS AUF GELB/ROT, DAS AUFRÄUMEN (E-406 B3, 19.10.2026)
//
// Justin (19.10.2026), Vorschlag 3 „Mara führt den Betrieb“. Hier steht nur die REGEL — rein, ohne Datenbank,
// geprüft in scripts/pruef-e406-b3-mara-heute.ts:
//   · MAILS BEANTWORTEN auf Gelb/Rot (Werkzeug antwort_senden der EINEN Ampel) — die Weiche vor dem Senden;
//   · WAS MARA HEUTE GETAN HAT — die Arten der Handlungen, die „Mara heute“ zählt;
//   · DAS AUFRÄUMEN — alte Zahlungsmeldungen (über 14 Tage, kein Eingang): EIN Klick „Im Bankbuch nachsehen“.
//
// E-409 × E-406 (Integration, 20.10.2026): Die Ampel selbst (Liste, Stufen, Speichern) steht NUR noch in
// shared/fiaon-ki-team.ts (MARA_AMPEL, echte Werkzeugnamen) und server/lib/fiaon-ki-ampel.ts — bedient in
// KI-Team › Werkzeuge. Die zweite Liste mit eigenen Namen und die Wochen-Stichprobe für die Trainerin sind weg:
// Justin 19.10.: „warum Diana? … Die ist ja gar nicht Thema“ — die Qualität prüft Prüf-Mara automatisch.
// ═══════════════════════════════════════════════════════════════════════════
import type { AmpelStufe } from "./fiaon-ki-team";
export type { AmpelStufe } from "./fiaon-ki-team";

/** So lange ist eine gelbe Handlung mit einem Klick rückgängig zu machen. */
export const RUECKGAENGIG_STUNDEN = 24;

// ═══════════════════════════════════════════════════════════════════════════
// MAILS BEANTWORTEN — die eine Weiche vor dem automatischen Senden (fiaon-postmeister-lauf.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const AMPEL_GELB_KOPF = "Ampel gelb:";
export const AMPEL_ROT_KOPF = "Ampel rot:";

/**
 * Darf Mara eine Antwort, die sie nach allen anderen Regeln senden dürfte, jetzt senden?
 * grün: ja. gelb: nur beim zweiten Anlauf der 24-Stunden-Regel (fristNeu) — bis dahin wartet sie als Entwurf und
 * steht in „Mara heute“ („Nicht senden“). rot: nie von selbst — jede Antwort wird eine Karte. Rein.
 */
export function mailDarfAuto(stufe: AmpelStufe, o: { fristNeu?: boolean } = {}): boolean {
  if (stufe === "gruen") return true;
  if (stufe === "gelb") return !!o.fristNeu;
  return false;
}

/** Die Begründung an der Postfach-Zeile, wenn NUR die Ampel das Senden aufhält. Rein. */
export function mailAmpelGrund(stufe: AmpelStufe, grund: string | null | undefined): string | null {
  const rest = String(grund ?? "").trim();
  if (stufe === "gelb") return `${AMPEL_GELB_KOPF} Mara sendet nach 24 Stunden selbst, außer jemand klickt „Nicht senden“${rest ? ` (${rest})` : ""}`.slice(0, 900);
  if (stufe === "rot") return `${AMPEL_ROT_KOPF} Mails beantwortet Mara gerade nur mit deinem Klick${rest ? ` (${rest})` : ""}`.slice(0, 900);
  return null;
}

/**
 * E-409 (Fund 6): Ein Werkzeug steht auf Rot (Rot-Weg „karte“) — Mara hat es nicht getan, ihre Antwort geht nur mit
 * Justins Klick raus. Beginnt mit AMPEL_ROT_KOPF: Postfach-Zeile → Karte „Ampel rot — Maras Antwort senden?“. Rein.
 */
export function mailAmpelWerkzeugRotGrund(werkzeuge: readonly string[], grund?: string | null): string {
  const namen = Array.from(new Set(werkzeuge.map((w) => String(w).trim()).filter(Boolean)));
  const rest = String(grund ?? "").trim();
  const liste = namen.map((n) => `„${n}“`).join(", ") || "ein Werkzeug";
  return `${AMPEL_ROT_KOPF} ${liste} ${namen.length > 1 ? "stehen" : "steht"} auf Rot — Mara hat es nicht getan, ihre Antwort geht nur mit deinem Klick raus${rest ? ` (${rest})` : ""}`.slice(0, 900);
}

/** Steht diese Begründung für einen gelben Entwurf (wartet 24 h, keine Karte)? Rein. */
export function istAmpelGelbEntwurf(begruendung: string | null | undefined): boolean {
  return String(begruendung ?? "").startsWith(AMPEL_GELB_KOPF);
}
export function istAmpelRotEntwurf(begruendung: string | null | undefined): boolean {
  return String(begruendung ?? "").startsWith(AMPEL_ROT_KOPF);
}

/**
 * E-406 B3 (Nachbesserung, Prüfer-Fund): Gelb, aber die 24-Stunden-Regel würde den Entwurf liegen lassen
 * (fristLaesstLiegen: Altbestand, schon einmal neu geschrieben, Sperre, Kundenmail zu alt, Widerruf/Recht) — dann ist er
 * KEIN gelber Entwurf, sondern eine normale Karte. Eigener Kopf: beginnt bewusst nicht mit AMPEL_GELB_KOPF.
 */
export const AMPEL_GELB_KARTE_KOPF = "Ampel gelb, als Karte:";
const GELB_KARTE_MITTE = "von selbst ginge diese Antwort nie raus — ";
export function mailAmpelGelbKarteGrund(liegen: string, grund?: string | null): string {
  const rest = String(grund ?? "").trim();
  return `${AMPEL_GELB_KARTE_KOPF} ${GELB_KARTE_MITTE}${String(liegen).trim()}${rest ? ` (${rest})` : ""}`.slice(0, 900);
}
export function istAmpelGelbKarte(begruendung: string | null | undefined): boolean {
  return String(begruendung ?? "").startsWith(AMPEL_GELB_KARTE_KOPF);
}
/** Nur der Grund aus einer „Ampel gelb, als Karte“-Begründung (für den Kartentext). Andere Begründungen: "". Rein. */
export function gelbKarteGrund(begruendung: string | null | undefined): string {
  const s = String(begruendung ?? "");
  if (!istAmpelGelbKarte(s)) return "";
  const r = s.slice(AMPEL_GELB_KARTE_KOPF.length).trim();
  return r.startsWith(GELB_KARTE_MITTE) ? r.slice(GELB_KARTE_MITTE.length).trim() : r;
}

/**
 * Der Satz in „Mara heute“ zu einem gelben Entwurf — aus DEMSELBEN Urteil wie Karte und 24-Stunden-Regel
 * (`liegen` = fristLaesstLiegen; `faellig` = fristFaellig). Rein.
 */
export function gelbEntwurfSatz(betreff: string | null | undefined, faellig: Date, liegen: string | null): string {
  const b = String(betreff ?? "").replace(/\s+/g, " ").trim() || "(ohne Betreff)";
  const kurzB = b.length > 60 ? `${b.slice(0, 59).trimEnd()} …` : b;
  if (liegen) return `Antwort auf „${kurzB}“ — geht NICHT von selbst raus (${liegen}); sie kommt als Karte in Mara › Entscheidungen`;
  const wann = faellig.toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `Antwort auf „${kurzB}“ — Mara schreibt sie frühestens ${wann} mit heutigem Stand neu und sendet; passt dann etwas nicht, kommt eine Karte`;
}

/** Ist eine Handlung noch im Rückgängig-Fenster? Rein. */
export function rueckgaengigOffen(am: Date | string | null | undefined, jetzt: Date = new Date()): boolean {
  if (!am) return false;
  const t = new Date(am as any).getTime();
  return Number.isFinite(t) && jetzt.getTime() - t <= RUECKGAENGIG_STUNDEN * 3_600_000 && t <= jetzt.getTime() + 60_000;
}

/**
 * Eine Verlaufszeile von updateCustomerContact („Straße korrigiert durch Mara (Mail): Alte Str. 1 → Neue Str. 2“) →
 * Feld, vorher, nachher — für „Zurück auf alt“ (fiaon-mara-heute.ts). Andere Zeilen: null. Rein.
 */
export function editZeileLesen(note: string): { feld: string; vorher: string; nachher: string } | null {
  const m = /^(Straße|PLZ|Ort|Telefon|Land) korrigiert durch [^:]+: ([\s\S]*) → ([\s\S]*)$/.exec(String(note ?? "").trim());
  return m ? { feld: m[1], vorher: m[2], nachher: m[3] } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS MARA HEUTE GETAN HAT — die Arten der Handlungen (fiaon-mara-heute.ts zählt sie)
// ═══════════════════════════════════════════════════════════════════════════
export type HandlungArt =
  | "mail_beantwortet" | "wa_antwort" | "aktion_mail" | "termin" | "karte_link" | "ratenpause" | "zahlungszusage"
  | "kuendigung" | "werbesperre" | "angaben" | "zahlung_fund" | "nachfass_mail" | "nachfass_wa" | "entwurf_abgelegt"
  // E-406 Welle 2 (Integration, 20.10.2026): auch die neuen Wege aus Welle 1 und 2 zählen in „Mara heute“ —
  // B1 Raten-Mail, C1 Anliegen beantwortet, C2 Zusammenfassung nach dem Anruf, B2 KYC-Erinnerung.
  | "rate_mail" | "anliegen_antwort" | "nacharbeit_mail" | "kyc_mail"
  | "karte_vorgelegt" | "uebergabe";

export interface HandlungArtInfo {
  /** Das Werkzeug der EINEN Ampel (shared/fiaon-ki-team.ts, echter Name) — null, wenn kein Werkzeug dahinter steht. */
  werkzeug: string | null;
  /** „12 Mails beantwortet“ — Einzahl/Mehrzahl. */
  eins: string; viele: string;
  /** Wohin die Zeile führt (Raum, in dem man es sieht). */
  link: string;
}

export const HANDLUNG_ARTEN: Record<HandlungArt, HandlungArtInfo> = {
  mail_beantwortet: { werkzeug: "antwort_senden", eins: "Mail beantwortet", viele: "Mails beantwortet", link: "/chef/s/postmeister" },
  wa_antwort: { werkzeug: null, eins: "WhatsApp-Antwort", viele: "WhatsApp-Antworten", link: "/chef/s/mara?reiter=whatsapp" },
  aktion_mail: { werkzeug: null, eins: "Zahlungs- oder Verkaufsmail", viele: "Zahlungs- und Verkaufsmails", link: "/chef/s/mara?reiter=mail" },
  termin: { werkzeug: "rueckruf_eintragen", eins: "Termin eingetragen", viele: "Termine eingetragen", link: "/chef/s/mara?reiter=termine" },
  karte_link: { werkzeug: "karte_link_schicken", eins: "Kartenlink-Anfrage bearbeitet", viele: "Kartenlink-Anfragen bearbeitet", link: "/chef/s/mara?reiter=whatsapp" },
  ratenpause: { werkzeug: "ratenpause_setzen", eins: "Ratenpause gesetzt", viele: "Ratenpausen gesetzt", link: "/chef/s/mara?reiter=whatsapp" },
  zahlungszusage: { werkzeug: "zahlungszusage_merken", eins: "Zahlungszusage festgehalten", viele: "Zahlungszusagen festgehalten", link: "/chef/s/mara?reiter=whatsapp" },
  kuendigung: { werkzeug: "kuendigung_aufnehmen", eins: "Kündigung bearbeitet", viele: "Kündigungen bearbeitet", link: "/chef/s/mara?reiter=entscheidungen" },
  werbesperre: { werkzeug: "werbesperre_setzen", eins: "Werbesperre gesetzt", viele: "Werbesperren gesetzt", link: "/chef/s/postmeister" },
  angaben: { werkzeug: "angaben_aendern", eins: "Angabe geändert", viele: "Angaben geändert", link: "/chef/s/mara?reiter=whatsapp" },
  zahlung_fund: { werkzeug: "zahlung_suchen", eins: "Zahlung im Bankbuch gefunden", viele: "Zahlungen im Bankbuch gefunden", link: "/chef/s/mara?reiter=entscheidungen" },
  nachfass_mail: { werkzeug: null, eins: "Nachfass-Mail", viele: "Nachfass-Mails", link: "/chef/s/mara?reiter=termine" },
  nachfass_wa: { werkzeug: null, eins: "WhatsApp-Nachfassen", viele: "WhatsApp-Nachfassen", link: "/chef/s/mara?reiter=whatsapp" },
  entwurf_abgelegt: { werkzeug: null, eins: "alter Entwurf abgelegt", viele: "alte Entwürfe abgelegt", link: "/chef/s/postmeister" },
  // E-406 Welle 2 (Integration): die Wege aus Welle 1 und 2 — ohne eigene Ampel (an/aus über ihre Schalter im Mara-Steuerpult).
  rate_mail: { werkzeug: null, eins: "Raten-Mail (frisch fällig)", viele: "Raten-Mails (frisch fällig)", link: "/chef/s/mara?reiter=mail" },
  anliegen_antwort: { werkzeug: null, eins: "Anliegen beantwortet", viele: "Anliegen beantwortet", link: "/chef/s/mara?reiter=mail" },
  nacharbeit_mail: { werkzeug: null, eins: "Zusammenfassung nach dem Anruf", viele: "Zusammenfassungen nach dem Anruf", link: "/chef/s/mara?reiter=termine" },
  kyc_mail: { werkzeug: null, eins: "Unterlagen-Erinnerung", viele: "Unterlagen-Erinnerungen", link: "/chef/s/mara?reiter=auskunft" },
  karte_vorgelegt: { werkzeug: null, eins: "Karte für dich", viele: "Karten für dich", link: "/chef/s/mara?reiter=entscheidungen" },
  uebergabe: { werkzeug: null, eins: "Übergabe ans Team", viele: "Übergaben ans Team", link: "/chef/s/mara?reiter=whatsapp" },
};

/** Zählt als „erledigt“ in der Kopfzahl? (Karten und Übergaben sind Arbeit für Menschen, keine Erledigung.) */
export const ERLEDIGT_ARTEN: readonly HandlungArt[] = (Object.keys(HANDLUNG_ARTEN) as HandlungArt[])
  .filter((a) => a !== "karte_vorgelegt" && a !== "uebergabe");

export interface HeuteZeile { art: HandlungArt; n: number; text: string; link: string; werkzeug: string | null }

/** Die Zeilen „Mara heute“ — nur Arten mit mindestens einer Handlung, die meisten zuerst. Rein. */
export function heuteZeilen(zahlen: Partial<Record<string, number>>): HeuteZeile[] {
  const aus: HeuteZeile[] = [];
  for (const [art, info] of Object.entries(HANDLUNG_ARTEN) as [HandlungArt, HandlungArtInfo][]) {
    const n = Math.max(0, Math.round(Number(zahlen[art] ?? 0)) || 0);
    if (!n) continue;
    aus.push({ art, n, text: n === 1 ? info.eins : info.viele, link: info.link, werkzeug: info.werkzeug });
  }
  return aus.sort((a, b) => b.n - a.n || a.art.localeCompare(b.art));
}

/** Die Kopfzahl: wie viel Mara heute selbst erledigt hat. Rein. */
export function heuteErledigt(zahlen: Partial<Record<string, number>>): number {
  return ERLEDIGT_ARTEN.reduce((s, a) => s + Math.max(0, Math.round(Number(zahlen[a] ?? 0)) || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUFRÄUM-VORSCHLÄGE — alte Zahlungsmeldungen (E-369: nach 14 Tagen ohne Eingang „unbezahlt“)
// ═══════════════════════════════════════════════════════════════════════════
/** Ab so vielen Tagen nach der Meldung ohne Eingang (STUFE_A_GEMELDET_TAGE, shared/fiaon-wiedervorlage.ts). */
export const MELDUNG_AB_TAGE = 14;
/** Bis zu so vielen Tagen — weiter zurück reicht das Bankbuch-Fenster von zahlung_suchen nicht (höchstens 90 Tage). */
export const MELDUNG_BIS_TAGE = 75;
/** Höchstens so viele Fälle auf einmal (die nächsten kommen, wenn diese entschieden sind). */
export const AUFRAEUM_JE_KARTE = 30;
/** Die Art der Karte (fiaon_mara_entscheidungen.art) — als E-397-Sammelkarte. */
export const AUFRAEUM_ART_ZAHLUNG = "mara_aufraeumen_zahlung";

/** Liegt die Meldung im Fenster (älter als 14, jünger als 75 Tage)? Rein. */
export function meldungImFenster(gemeldetAm: Date | string | null | undefined, jetzt: Date = new Date()): boolean {
  if (!gemeldetAm) return false;
  const tage = (jetzt.getTime() - new Date(gemeldetAm as any).getTime()) / 86_400_000;
  return Number.isFinite(tage) && tage > MELDUNG_AB_TAGE && tage <= MELDUNG_BIS_TAGE;
}

/** Wie weit Mara im Bankbuch zurücksieht: seit der Meldung plus eine Woche davor, höchstens 90 Tage. Rein. */
export function meldungSuchTage(gemeldetAm: Date | string, jetzt: Date = new Date()): number {
  const tage = Math.ceil((jetzt.getTime() - new Date(gemeldetAm as any).getTime()) / 86_400_000);
  return Math.max(21, Math.min(90, (Number.isFinite(tage) ? tage : 0) + 7));
}

/** Tage seit der Meldung (ganz). Rein. */
export function tageSeit(am: Date | string, jetzt: Date = new Date()): number {
  return Math.max(0, Math.floor((jetzt.getTime() - new Date(am as any).getTime()) / 86_400_000));
}
