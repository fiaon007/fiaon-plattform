// ═══════════════════════════════════════════════════════════════════════════
// MARA FÜHRT DEN BETRIEB — DIE AMPEL JE WERKZEUG, DIE STICHPROBE, DAS AUFRÄUMEN
// (E-406 B3, 19.10.2026)
//
// Justin (19.10.2026), Vorschlag 3 „Mara führt den Betrieb“: „starte Etappe A und alle anderen gleichzeitig,
// damit alles fertig wird … mach einfach mal.“ Dieser Baustein (B3):
//   · DIE AMPEL je Mara-Werkzeug — grün: Mara macht es allein; gelb: Mara macht es, es steht in „Mara heute“
//     und ist 24 h mit einem Klick rückgängig (wo das sicher geht); rot: nur als Entscheidungskarte.
//     Erstattung und Geld buchen sind FEST rot. Startwerte = das heutige Verhalten (nichts verschärft, nichts
//     gelockert ohne Justin). Jede Zeile nennt nur die Stufen, die der Server WIRKLICH durchsetzt — was noch
//     fehlt, steht ehrlich daneben (`fehlt`, `fest`).
//   · DIE STICHPROBE — jede Woche 20 zufällige Mara-Handlungen für die Trainerin (E-161): ok oder nicht ok, mit
//     Grund; Fehlerquote je Werkzeug. Gelb → Grün schlägt das System erst nach 4 Wochen unter 2 % vor — ein
//     Vorschlag an Justin, kein Automatismus.
//   · DAS AUFRÄUMEN — alte Zahlungsmeldungen (über 14 Tage, kein Eingang): EIN Klick „Im Bankbuch nachsehen“
//     (E-397-Sammelkarte). Nie Geld, nie Erstattung, nie Kündigung.
//
// Hier steht nur die REGEL — rein, ohne Datenbank, geprüft in scripts/pruef-e406-b3-mara-heute.ts. Der Server
// (server/lib/fiaon-mara-ampel.ts, fiaon-mara-heute.ts, fiaon-mara-stichprobe.ts, fiaon-mara-aufraeumen.ts)
// liest, schreibt und handelt.
// ═══════════════════════════════════════════════════════════════════════════

export type AmpelStufe = "gruen" | "gelb" | "rot";
export const AMPEL_STUFEN: readonly AmpelStufe[] = ["gruen", "gelb", "rot"];
export const STUFE_TEXT: Record<AmpelStufe, string> = { gruen: "Grün", gelb: "Gelb", rot: "Rot" };
export const STUFE_SATZ: Record<AmpelStufe, string> = {
  gruen: "Mara macht es allein.",
  gelb: "Mara macht es — es steht in „Mara heute“, 24 h rückgängig.",
  rot: "Nur als Entscheidungskarte.",
};

/** Der Schlüssel in fiaon_settings (JSON: { stufen, verlauf }). */
export const AMPEL_SCHALTER = "mara_ampel";
/** So lange ist eine gelbe Handlung mit einem Klick rückgängig zu machen. */
export const RUECKGAENGIG_STUNDEN = 24;

export type AmpelKey =
  | "mail_antworten" | "termin_eintragen" | "angaben_aendern" | "ratenpause" | "karte_link" | "nachfassen"
  | "whatsapp_antworten" | "aktion_mails" | "zahlung_suchen" | "werbesperre" | "kuendigung"
  | "raten_storno" | "geld_buchen" | "erstattung";

export interface AmpelWerkzeug {
  key: AmpelKey;
  /** Kurz, für die Zeile (≤ 40 Zeichen). */
  label: string;
  /** Was es ist — ein Satz (≤ 80 Zeichen). */
  satz: string;
  kanal: string;
  /** Startwert = das heutige Verhalten. */
  start: AmpelStufe;
  /** Nur die Stufen, die der Server wirklich durchsetzt. */
  stufen: readonly AmpelStufe[];
  /** Warum nicht änderbar (nur eine Stufe). */
  fest?: string;
  /** Gelb: was der Rückgängig-Knopf tut — oder null, wenn es nicht sicher geht. */
  rueckgaengig?: string | null;
  /** Gelb ohne Rückgängig: der ehrliche Grund. */
  ohneRueckgaengig?: string;
  /** Was Gelb hier heißt, wenn es mehr ist als „steht in Mara heute“. */
  gelb?: string;
  /** Was Rot hier heißt. */
  rot?: string;
  /** Welche Stufe noch fehlt und warum — ehrlich. */
  fehlt?: string;
}

/**
 * DIE WERKZEUGE. Reihenfolge = Anzeige. Startwerte gemessen am Code vom 19.10.2026 (main 6d28dc67):
 * Mara sendet Antworten selbst (E-369), trägt Rückrufe und genannte Termine ein (E-236, E-395, E-401), ändert
 * Anschrift und Telefon (E-401), setzt eine Ratenpause (E-372), schickt den Kartenlink (E-275), fasst nach
 * (E-299, E-401) — alles grün. Geld, Erstattung und Raten-Storno gibt es nur als Karte — rot.
 */
export const MARA_AMPEL: readonly AmpelWerkzeug[] = [
  {
    key: "mail_antworten", label: "Mails beantworten", satz: "Antworten auf Kundenmails im Postfach", kanal: "Mail",
    start: "gruen", stufen: ["gruen", "gelb", "rot"], rueckgaengig: "Nicht senden",
    gelb: "Entwurf statt Senden: Nach 24 h sendet Mara selbst, außer du klickst „Nicht senden“. Geht das nicht (alte Mail, Sperre), kommt eine Karte.",
    rot: "Jede Antwort wird eine Karte „Kundenmail“ — raus geht sie nur mit deinem Klick.",
  },
  {
    key: "termin_eintragen", label: "Termine eintragen", satz: "Rückrufe und vom Kunden genannte Termine", kanal: "Mail und WhatsApp",
    start: "gruen", stufen: ["gruen", "gelb", "rot"], rueckgaengig: "Termin absagen",
    gelb: "Absagen schickt dem Kunden die Absage mit Link zum Neubuchen.",
    rot: "Mara trägt nichts ein. Genannte Termine kommen als Karte „Eintragen“, Rückrufe ohne Uhrzeit an den Betreuer.",
  },
  {
    key: "angaben_aendern", label: "Anschrift und Telefon ändern", satz: "Neue Anschrift oder Nummer, vom Kunden selbst", kanal: "Mail und WhatsApp",
    start: "gruen", stufen: ["gruen", "gelb"], rueckgaengig: "Zurück auf alt",
    gelb: "Eine bestätigte neue E-Mail-Adresse hat der Kunde selbst geklickt — die bleibt.",
    fehlt: "Rot kommt später: Dafür fehlt noch die Karte „Übernehmen“.",
  },
  {
    key: "ratenpause", label: "Ratenpause", satz: "Offene Raten einmal einen Monat schieben", kanal: "WhatsApp",
    start: "gruen", stufen: ["gruen", "gelb", "rot"], rueckgaengig: null, ohneRueckgaengig: "Dem Kunden ist die Pause schon zugesagt.",
    rot: "Jede Bitte kommt als Karte „Pause setzen“.",
  },
  {
    key: "karte_link", label: "Kartenlink schicken", satz: "Link der Partnerbank für Konto und Karte", kanal: "Mail und WhatsApp",
    start: "gruen", stufen: ["gruen", "gelb"], rueckgaengig: null, ohneRueckgaengig: "Die Mail ist raus.",
    fehlt: "Kein Rot: Der Link ist Vertragsleistung (E-365).",
  },
  {
    key: "nachfassen", label: "Nachfassen", satz: "Nach 2× nicht erreicht (Mail), im 24-h-Fenster (WhatsApp)", kanal: "Mail und WhatsApp",
    start: "gruen", stufen: ["gruen", "gelb"], rueckgaengig: null, ohneRueckgaengig: "Die Nachricht ist raus.",
    fehlt: "Kein Rot — ausschalten geht über die Schalter (Reiter „Termine“ und WhatsApp).",
  },
  {
    key: "whatsapp_antworten", label: "WhatsApp beantworten", satz: "Antworten im WhatsApp-Gespräch", kanal: "WhatsApp",
    start: "gruen", stufen: ["gruen"], fest: "Braucht eine Antwort in Minuten. Recht, Widerruf und Geld zurück sind schon Karten.",
  },
  {
    key: "aktion_mails", label: "Zahlungs- und Verkaufsmails", satz: "Die Mara-Aktion an Stufe A und B", kanal: "Mail",
    start: "gruen", stufen: ["gruen"], fest: "An und aus: Schalter im Reiter „Mail“.",
  },
  {
    key: "zahlung_suchen", label: "Zahlung im Bankbuch suchen", satz: "Bei „habe bezahlt“ — liest nur, Vorschlag auf Karte", kanal: "Mail und WhatsApp",
    start: "gruen", stufen: ["gruen"], fest: "Liest nur. Gebucht wird immer erst mit deinem Klick.",
  },
  {
    key: "werbesperre", label: "Werbesperre auf Wunsch", satz: "„Keine Mails mehr“ gilt sofort", kanal: "Mail und WhatsApp",
    start: "gruen", stufen: ["gruen"], fest: "Der Wunsch des Kunden gilt sofort (§ 7 UWG).",
  },
  {
    key: "kuendigung", label: "Klare Kündigung buchen", satz: "Nur nach einem klaren Ja", kanal: "Mail und WhatsApp",
    start: "gruen", stufen: ["gruen"], fest: "Wird gerade umgebaut (Jahresvertrag, E-396) — danach einstellbar.",
  },
  {
    key: "raten_storno", label: "Raten erlassen oder stornieren", satz: "Storno, Einwand anerkennen", kanal: "nur Chefbüro",
    start: "rot", stufen: ["rot"], fest: "Nur mit deinem Klick.",
  },
  {
    key: "geld_buchen", label: "Geld buchen und zuordnen", satz: "Eingänge auf Raten buchen", kanal: "nur Chefbüro",
    start: "rot", stufen: ["rot"], fest: "Fest rot: Geld bucht Mara nie.",
  },
  {
    key: "erstattung", label: "Erstattung", satz: "Geld an Kunden zurück", kanal: "nur Chefbüro",
    start: "rot", stufen: ["rot"], fest: "Fest rot: Erstattungen nie automatisch.",
  },
];

/** Diese zwei sind fest rot — keine Einstellung ändert sie, auch kein gespeicherter Wert. */
export const FEST_ROT: readonly AmpelKey[] = ["geld_buchen", "erstattung"];

export function ampelWerkzeug(key: string): AmpelWerkzeug | null {
  return MARA_AMPEL.find((w) => w.key === key) ?? null;
}

export type AmpelStand = Record<AmpelKey, AmpelStufe>;

/** Die Startwerte — das heutige Verhalten. */
export function ampelVorgabe(): AmpelStand {
  const s = {} as AmpelStand;
  for (const w of MARA_AMPEL) s[w.key] = w.start;
  return s;
}

export interface AmpelVerlauf { key: AmpelKey; von: AmpelStufe; nach: AmpelStufe; wer: string; am: string }
export interface AmpelGespeichert { stufen: Partial<Record<AmpelKey, AmpelStufe>>; verlauf: AmpelVerlauf[] }

function jsonLesen(roh: unknown): any {
  if (roh == null || roh === "") return null;
  if (typeof roh === "string") { try { return JSON.parse(roh); } catch { return null; } }
  return typeof roh === "object" ? roh : null;
}

/**
 * Der gespeicherte Wert → die Stufe je Werkzeug. Was fehlt, unbekannt ist oder eine Stufe nennt, die das
 * Werkzeug nicht kennt, steht auf dem Startwert. Fest rot bleibt fest rot. Rein.
 */
export function ampelLesen(roh: unknown): AmpelStand {
  const j = jsonLesen(roh);
  const gespeichert = j && typeof j.stufen === "object" && j.stufen ? j.stufen : {};
  const s = ampelVorgabe();
  for (const w of MARA_AMPEL) {
    if (FEST_ROT.includes(w.key)) { s[w.key] = "rot"; continue; }
    const v = gespeichert[w.key];
    if (typeof v === "string" && (w.stufen as readonly string[]).includes(v)) s[w.key] = v as AmpelStufe;
  }
  return s;
}

/** Der Verlauf aus dem gespeicherten Wert (neueste zuerst, höchstens 50). Rein. */
export function ampelVerlaufLesen(roh: unknown): AmpelVerlauf[] {
  const j = jsonLesen(roh);
  const v = Array.isArray(j?.verlauf) ? j.verlauf : [];
  return v.filter((x: any) => x && typeof x.key === "string" && typeof x.nach === "string").slice(0, 50);
}

/** Darf diese Stufe gesetzt werden? null = ja, sonst der Grund. Rein. */
export function ampelSetzenPruefen(key: string, stufe: string): string | null {
  const w = ampelWerkzeug(key);
  if (!w) return "Dieses Werkzeug gibt es nicht.";
  if (!(AMPEL_STUFEN as readonly string[]).includes(stufe)) return "Diese Stufe gibt es nicht.";
  if (FEST_ROT.includes(w.key) && stufe !== "rot") return w.fest ?? "Fest rot.";
  if (!(w.stufen as readonly string[]).includes(stufe)) {
    return w.fest ?? w.fehlt ?? `Für „${w.label}“ gibt es nur ${w.stufen.map((x) => STUFE_TEXT[x]).join(" und ")}.`;
  }
  return null;
}

/**
 * Eine Stufe setzen — der neue gespeicherte Wert (nur, was vom Start abweicht, plus Verlauf). Wirft bei einer
 * Stufe, die nicht geht (vorher ampelSetzenPruefen). Rein.
 */
export function ampelSetzen(roh: unknown, key: AmpelKey, stufe: AmpelStufe, wer: string, jetzt: Date = new Date()): AmpelGespeichert {
  const fehler = ampelSetzenPruefen(key, stufe);
  if (fehler) throw new Error(fehler);
  const stand = ampelLesen(roh);
  const vorher = stand[key];
  stand[key] = stufe;
  const stufen: Partial<Record<AmpelKey, AmpelStufe>> = {};
  for (const w of MARA_AMPEL) if (stand[w.key] !== w.start) stufen[w.key] = stand[w.key];
  const verlauf = vorher === stufe ? ampelVerlaufLesen(roh)
    : [{ key, von: vorher, nach: stufe, wer: String(wer || "Chefbüro").slice(0, 80), am: jetzt.toISOString() }, ...ampelVerlaufLesen(roh)].slice(0, 50);
  return { stufen, verlauf };
}

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
  werkzeug: AmpelKey | null;
  /** „12 Mails beantwortet“ — Einzahl/Mehrzahl. */
  eins: string; viele: string;
  /** Wohin die Zeile führt (Raum, in dem man es sieht). */
  link: string;
  /** Kommt in die Wochen-Stichprobe? */
  stichprobe: boolean;
}

export const HANDLUNG_ARTEN: Record<HandlungArt, HandlungArtInfo> = {
  mail_beantwortet: { werkzeug: "mail_antworten", eins: "Mail beantwortet", viele: "Mails beantwortet", link: "/chef/s/postmeister", stichprobe: true },
  wa_antwort: { werkzeug: "whatsapp_antworten", eins: "WhatsApp-Antwort", viele: "WhatsApp-Antworten", link: "/chef/s/mara?reiter=whatsapp", stichprobe: true },
  aktion_mail: { werkzeug: "aktion_mails", eins: "Zahlungs- oder Verkaufsmail", viele: "Zahlungs- und Verkaufsmails", link: "/chef/s/mara?reiter=mail", stichprobe: true },
  termin: { werkzeug: "termin_eintragen", eins: "Termin eingetragen", viele: "Termine eingetragen", link: "/chef/s/mara?reiter=termine", stichprobe: true },
  karte_link: { werkzeug: "karte_link", eins: "Kartenlink-Anfrage bearbeitet", viele: "Kartenlink-Anfragen bearbeitet", link: "/chef/s/mara?reiter=whatsapp", stichprobe: true },
  ratenpause: { werkzeug: "ratenpause", eins: "Ratenpause gesetzt", viele: "Ratenpausen gesetzt", link: "/chef/s/mara?reiter=whatsapp", stichprobe: true },
  zahlungszusage: { werkzeug: "whatsapp_antworten", eins: "Zahlungszusage festgehalten", viele: "Zahlungszusagen festgehalten", link: "/chef/s/mara?reiter=whatsapp", stichprobe: true },
  kuendigung: { werkzeug: "kuendigung", eins: "Kündigung bearbeitet", viele: "Kündigungen bearbeitet", link: "/chef/s/mara?reiter=entscheidungen", stichprobe: true },
  werbesperre: { werkzeug: "werbesperre", eins: "Werbesperre gesetzt", viele: "Werbesperren gesetzt", link: "/chef/s/postmeister", stichprobe: true },
  angaben: { werkzeug: "angaben_aendern", eins: "Angabe geändert", viele: "Angaben geändert", link: "/chef/s/mara?reiter=whatsapp", stichprobe: true },
  zahlung_fund: { werkzeug: "zahlung_suchen", eins: "Zahlung im Bankbuch gefunden", viele: "Zahlungen im Bankbuch gefunden", link: "/chef/s/mara?reiter=entscheidungen", stichprobe: true },
  nachfass_mail: { werkzeug: "nachfassen", eins: "Nachfass-Mail", viele: "Nachfass-Mails", link: "/chef/s/mara?reiter=termine", stichprobe: true },
  nachfass_wa: { werkzeug: "nachfassen", eins: "WhatsApp-Nachfassen", viele: "WhatsApp-Nachfassen", link: "/chef/s/mara?reiter=whatsapp", stichprobe: true },
  entwurf_abgelegt: { werkzeug: "mail_antworten", eins: "alter Entwurf abgelegt", viele: "alte Entwürfe abgelegt", link: "/chef/s/postmeister", stichprobe: true },
  // E-406 Welle 2 (Integration): die Wege aus Welle 1 und 2 — ohne eigene Ampel (an/aus über ihre Schalter im Mara-Steuerpult).
  rate_mail: { werkzeug: null, eins: "Raten-Mail (frisch fällig)", viele: "Raten-Mails (frisch fällig)", link: "/chef/s/mara?reiter=mail", stichprobe: false },
  anliegen_antwort: { werkzeug: null, eins: "Anliegen beantwortet", viele: "Anliegen beantwortet", link: "/chef/s/mara?reiter=mail", stichprobe: false },
  nacharbeit_mail: { werkzeug: null, eins: "Zusammenfassung nach dem Anruf", viele: "Zusammenfassungen nach dem Anruf", link: "/chef/s/mara?reiter=termine", stichprobe: false },
  kyc_mail: { werkzeug: null, eins: "Unterlagen-Erinnerung", viele: "Unterlagen-Erinnerungen", link: "/chef/s/mara?reiter=auskunft", stichprobe: false },
  karte_vorgelegt: { werkzeug: null, eins: "Karte für dich", viele: "Karten für dich", link: "/chef/s/mara?reiter=entscheidungen", stichprobe: false },
  uebergabe: { werkzeug: null, eins: "Übergabe ans Team", viele: "Übergaben ans Team", link: "/chef/s/mara?reiter=whatsapp", stichprobe: false },
};

/** Zählt als „erledigt“ in der Kopfzahl? (Karten und Übergaben sind Arbeit für Menschen, keine Erledigung.) */
export const ERLEDIGT_ARTEN: readonly HandlungArt[] = (Object.keys(HANDLUNG_ARTEN) as HandlungArt[])
  .filter((a) => a !== "karte_vorgelegt" && a !== "uebergabe");

export interface HeuteZeile { art: HandlungArt; n: number; text: string; link: string; werkzeug: AmpelKey | null }

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
// DIE STICHPROBE (Trainerin, E-161) — 20 je Woche, Fehlerquote je Werkzeug, Vorschlag Gelb → Grün
// ═══════════════════════════════════════════════════════════════════════════
export const STICHPROBE_ZAHL = 20;
/** Gelb → Grün schlägt das System erst vor, wenn so viele volle Wochen hintereinander unter der Grenze lagen. */
export const AUFSTIEG_WOCHEN = 4;
/** Die Grenze: unter 2 % „nicht ok“. */
export const AUFSTIEG_GRENZE = 0.02;
/** Und nur mit genug Fällen in diesen Wochen zusammen (sonst sagt „0 von 2“ nichts). */
export const AUFSTIEG_MIN_FAELLE = 8;
export type Urteil = "ok" | "nicht_ok";

/** Der Montag der Berliner Woche eines Zeitpunkts — YYYY-MM-DD. Rein (formatToParts, nie Number(format())). */
export function wocheBerlin(d: Date = new Date()): string {
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const v = (t: string) => teile.find((p) => p.type === t)?.value ?? "";
  const wt = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(v("weekday"));
  const u = new Date(Date.UTC(Number(v("year")), Number(v("month")) - 1, Number(v("day")) - Math.max(0, wt)));
  return u.toISOString().slice(0, 10);
}

/** Eine Woche (YYYY-MM-DD, Montag) plus/minus n Wochen. Rein. */
export function wochePlus(woche: string, n: number): string {
  const [j, m, t] = woche.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t + 7 * n)).toISOString().slice(0, 10);
}

/** „20.10.“ aus „2026-10-20“. Rein. */
export const tagKurzIso = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : iso);

/**
 * 20 zufällige Handlungen — gleichmäßig über die Werkzeuge (der Reihe nach je eine, solange etwas da ist), damit
 * auch seltene Werkzeuge eine Fehlerquote bekommen und 700 Verkaufsmails nicht alles verdrängen. `zufall` ist
 * austauschbar (Prüfstand). Rein.
 */
export function stichprobeZiehen<T extends { werkzeug: string }>(kandidaten: readonly T[], n: number = STICHPROBE_ZAHL, zufall: () => number = Math.random): T[] {
  const je = new Map<string, T[]>();
  for (const k of kandidaten) je.set(k.werkzeug, [...(je.get(k.werkzeug) ?? []), k]);
  // Innerhalb jedes Werkzeugs mischen (Fisher-Yates), die Reihenfolge der Werkzeuge ebenfalls.
  const mischen = <X>(a: X[]): X[] => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  };
  const toepfe = mischen(Array.from(je.keys()).sort()).map((w) => mischen(je.get(w)!));
  const aus: T[] = [];
  while (aus.length < n && toepfe.some((t) => t.length)) {
    for (const t of toepfe) {
      if (aus.length >= n) break;
      const x = t.shift();
      if (x) aus.push(x);
    }
  }
  return aus;
}

/** Ist ein Urteil vollständig? „nicht ok“ braucht einen Grund (≥ 5 Zeichen). null = ja. Rein. */
export function urteilPruefen(urteil: unknown, grund: unknown): string | null {
  if (urteil !== "ok" && urteil !== "nicht_ok") return "Bitte „ok“ oder „nicht ok“ wählen.";
  const g = String(grund ?? "").trim();
  if (urteil === "nicht_ok" && g.length < 5) return "Bei „nicht ok“ bitte kurz den Grund schreiben (was war falsch?).";
  if (g.length > 600) return "Der Grund ist zu lang (höchstens 600 Zeichen).";
  return null;
}

export interface WochenQuote { woche: string; n: number; nichtOk: number; quote: number | null }
export interface WerkzeugQuote { werkzeug: string; n: number; nichtOk: number; quote: number | null; wochen: WochenQuote[] }

const quote = (n: number, f: number): number | null => (n > 0 ? Math.round((f / n) * 1000) / 1000 : null);

/**
 * Fehlerquote je Werkzeug aus den bewerteten Fällen (`wochen`: die Wochen, die gezeigt werden — neueste zuerst).
 * Unbewertete Fälle zählen nicht. Rein.
 */
export function fehlerquoten(bewertet: readonly { werkzeug: string; woche: string; urteil: string | null }[], wochen: readonly string[]): WerkzeugQuote[] {
  const je = new Map<string, Map<string, { n: number; f: number }>>();
  for (const b of bewertet) {
    if (b.urteil !== "ok" && b.urteil !== "nicht_ok") continue;
    if (!wochen.includes(b.woche)) continue;
    const w = je.get(b.werkzeug) ?? new Map();
    const z = w.get(b.woche) ?? { n: 0, f: 0 };
    z.n += 1; if (b.urteil === "nicht_ok") z.f += 1;
    w.set(b.woche, z);
    je.set(b.werkzeug, w);
  }
  const aus: WerkzeugQuote[] = [];
  for (const [werkzeug, w] of Array.from(je.entries())) {
    const ws: WochenQuote[] = wochen.map((woche) => {
      const z = w.get(woche) ?? { n: 0, f: 0 };
      return { woche, n: z.n, nichtOk: z.f, quote: quote(z.n, z.f) };
    });
    const n = ws.reduce((s, x) => s + x.n, 0), f = ws.reduce((s, x) => s + x.nichtOk, 0);
    aus.push({ werkzeug, n, nichtOk: f, quote: quote(n, f), wochen: ws });
  }
  return aus.sort((a, b) => a.werkzeug.localeCompare(b.werkzeug));
}

export interface AufstiegUrteil { vorschlag: boolean; grund: string }

/**
 * Gelb → Grün: nur ein VORSCHLAG an Justin, und nur, wenn die letzten AUFSTIEG_WOCHEN vollen Wochen (neueste
 * zuerst, die laufende Woche zählt nicht) JEDE bewertete Fälle hatten und JEDE unter der Grenze lag — und alle
 * zusammen mindestens AUFSTIEG_MIN_FAELLE Fälle. Rein.
 */
export function aufstiegVorschlag(stufe: AmpelStufe, wochen: readonly WochenQuote[]): AufstiegUrteil {
  if (stufe !== "gelb") return { vorschlag: false, grund: stufe === "gruen" ? "Steht schon auf Grün." : "Nur von Gelb aus." };
  const letzte = wochen.slice(0, AUFSTIEG_WOCHEN);
  const bewertet = letzte.filter((w) => w.n > 0).length;
  if (letzte.length < AUFSTIEG_WOCHEN || bewertet < AUFSTIEG_WOCHEN) {
    return { vorschlag: false, grund: `Erst ${bewertet} von ${AUFSTIEG_WOCHEN} Wochen mit bewerteten Fällen.` };
  }
  const ueber = letzte.filter((w) => (w.quote ?? 0) >= AUFSTIEG_GRENZE);
  if (ueber.length) return { vorschlag: false, grund: `${ueber.length} von ${AUFSTIEG_WOCHEN} Wochen mit 2 % Fehlern oder mehr.` };
  const n = letzte.reduce((s, w) => s + w.n, 0);
  if (n < AUFSTIEG_MIN_FAELLE) return { vorschlag: false, grund: `Erst ${n} Fälle in ${AUFSTIEG_WOCHEN} Wochen (mindestens ${AUFSTIEG_MIN_FAELLE}).` };
  return { vorschlag: true, grund: `${AUFSTIEG_WOCHEN} Wochen unter 2 % Fehlern (${n} Fälle) — Vorschlag: auf Grün.` };
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
