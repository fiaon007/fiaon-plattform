// ═══════════════════════════════════════════════════════════════════════════
// ARAS — der KI-Kollege am Telefon: Namen, Konstanten, reine Regeln (E-408)
//
// Vertrag: ~/Desktop/FIAON/10_Nacharbeit/aras-e408/SCHNITTSTELLE.md § 1 / § 3.
// Diese Datei ist REIN (keine Datenbank, kein Netz) — Server UND Oberfläche
// lesen sie, der Prüfstand scripts/pruef-aras-plan.ts prüft sie offline.
//
// Lesehilfe: „Spielart“ = die Gesprächsart (Rate einfordern, Zahlung klären …).
// „Fenster“ = die Uhrzeiten, in denen ARAS wählen darf. „Wand“ = ein Grund,
// aus dem der Wähler einen Eintrag NICHT wählt (Sperre, Deckel, Fenster …).
// ═══════════════════════════════════════════════════════════════════════════
import { ERGEBNISSE } from "./fiaon-kontakt-ergebnis-liste";
import { istFeiertag, type FeiertagLand } from "./fiaon-feiertage";

export const ARAS_VERSION = "1.0-2026-10-19";

// ── Spielarten ─────────────────────────────────────────────────────────────
// E-408 Scheibe 2 (20.10.2026): „auftrag“ = ein Auftrag aus der Akte („Aras anrufen lassen“, „Offenes an Aras abgeben“) —
// der Betreuer sagt, worum es geht; Rechtsgrund Vertrag (Kunde) oder seine Einwilligung (sonst kein Anruf).
export const SPIELARTEN = ["termin", "lead", "zuruf", "stufe_b", "stufe_a", "rate", "zusage", "rueckholung", "auftrag", "eingehend", "probe"] as const;
export type Spielart = (typeof SPIELARTEN)[number];
export function istSpielart(v: unknown): v is Spielart { return typeof v === "string" && (SPIELARTEN as readonly string[]).includes(v); }

export const SPIELART_TEXT: Record<Spielart, string> = {
  termin: "Termin bei Aras", lead: "Lead frisch", zuruf: "Verkauf nach JA", stufe_b: "Antrag unbezahlt",
  stufe_a: "Zahlung gemeldet", rate: "Rate fällig", zusage: "Zusage nachfassen", rueckholung: "Rückholung",
  auftrag: "Auftrag vom Team", eingehend: "Eingehend", probe: "Probeanruf",
};

/** Rechtsgrund je Spielart — Werbung braucht eine Zeile in fiaon_telefon_einwilligung. */
export type Rechtsgrund = "vertrag" | "einwilligung" | "kunde_ruft" | "intern";
export const RECHTSGRUND: Record<Spielart, Rechtsgrund> = {
  termin: "einwilligung", lead: "einwilligung", zuruf: "einwilligung", stufe_b: "einwilligung",
  stufe_a: "vertrag", rate: "vertrag", zusage: "vertrag", rueckholung: "einwilligung", eingehend: "kunde_ruft", probe: "intern",
  // Auftrag aus der Akte: Vorgabe Vertrag — planEinreihen setzt „einwilligung“, wenn der Kontakt (noch) kein Kunde ist und ein Ja vorliegt.
  auftrag: "vertrag",
};
export function istWerbeSpielart(s: Spielart): boolean { return RECHTSGRUND[s] === "einwilligung"; }
/** Vertragssachen (Rate, Zusage, Zahlung gemeldet, Auftrag aus der Akte) wählen im Raten-Fenster, alles andere im Verkaufs-Fenster. */
export function istVertragsFenster(s: Spielart): boolean { return s === "rate" || s === "zusage" || s === "stufe_a" || s === "auftrag"; }

/** Priorität in der Warteschlange (1 = zuerst; 0 = außerhalb der Reihung). */
export const PRIORITAET: Record<Spielart, number> = { termin: 1, lead: 2, zuruf: 2, auftrag: 2, rate: 3, zusage: 3, stufe_a: 4, stufe_b: 5, rueckholung: 6, eingehend: 0, probe: 0 };
/** Stufe B frisch (< 4 h nach Absenden, Einwilligung antrag_kaestchen/antrag_knopf) läuft als `zuruf` mit grund "antrag_frisch". */
export const STUFE_B_FRISCH_STUNDEN = 4;

/** Einwilligungs-Arten — keine entsteht per Stimme (ARAS holt nie eine Werbe-Einwilligung am Telefon ein). */
export const EINWILLIGUNG_ARTEN = ["meta_kaestchen", "antrag_kaestchen", "antrag_knopf", "zuruf_whatsapp", "zuruf_mail", "rueckruf_buchung", "chef"] as const;
export type EinwilligungArt = (typeof EINWILLIGUNG_ARTEN)[number];

// ── Werkzeuge ──────────────────────────────────────────────────────────────
export const WERKZEUGE = ["akte_nachsehen", "aufnahme_starten", "aufnahme_abgelehnt", "zahlungslink_senden", "zahlungszusage_merken", "zahlung_gemeldet",
  "ratenpause_setzen", "rueckruf_buchen", "notiz_schreiben", "nicht_mehr_anrufen", "mensch_verbinden", "anruf_beenden"] as const;
export type Werkzeug = (typeof WERKZEUGE)[number];
export function istWerkzeug(v: unknown): v is Werkzeug { return typeof v === "string" && (WERKZEUGE as readonly string[]).includes(v); }

/** Was ein Global-Kunde bekommt: nur Zuhören, Notiz, Mensch, Sperre, Ende — nie Verkauf. */
export const WERKZEUGE_GLOBAL: readonly Werkzeug[] = ["akte_nachsehen", "notiz_schreiben", "mensch_verbinden", "nicht_mehr_anrufen", "anruf_beenden"];

/** Werkzeug-Ampel für ARAS — eigene Form (nicht der geschlossene AmpelKey-Typ aus E-406 B3). */
export type AmpelStufe = "gruen" | "gelb" | "rot";
export type ArasAmpelKey = Werkzeug;
export interface ArasAmpelWerkzeug { key: ArasAmpelKey; label: string; satz: string; stufen: AmpelStufe[]; vorgabe: AmpelStufe; fest?: boolean; /** Form des KI-Raums (AmpelWerkzeug): Aras arbeitet über alle Wege. */ kanal: "alle" }
export const ARAS_AMPEL: readonly ArasAmpelWerkzeug[] = [
  { key: "akte_nachsehen", label: "Akte nachsehen", satz: "Liest Zahlungen, Termine, Notizen, Vertrag.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "alle" },
  { key: "aufnahme_starten", label: "Aufnahme starten", satz: "Nur nach hörbarem Ja des Kunden.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "alle" },
  { key: "aufnahme_abgelehnt", label: "Aufnahme abgelehnt", satz: "Kein Band, kein Volltext — nur Notiz.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "alle" },
  { key: "zahlungslink_senden", label: "Zahlungslink senden", satz: "WhatsApp oder Mail mit seinem persönlichen Link.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "alle" },
  { key: "zahlungszusage_merken", label: "Zusage merken", satz: "Zahl-Datum in die Akte, Nachfassen am Tag danach.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "alle" },
  { key: "zahlung_gemeldet", label: "Zahlung gemeldet", satz: "„Ist überwiesen“ → Stufe A, Mara sucht im Bankbuch.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "alle" },
  { key: "ratenpause_setzen", label: "Ratenpause", satz: "Kette rückt — steht in „Heute“, 24 h rückgängig.", stufen: ["gelb", "rot"], vorgabe: "gelb", kanal: "alle" },
  { key: "rueckruf_buchen", label: "Anruf eintragen", satz: "Termin bei Aras oder beim Betreuer.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "alle" },
  { key: "notiz_schreiben", label: "Notiz", satz: "Ein Satz in den Verlauf der Akte.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "alle" },
  { key: "nicht_mehr_anrufen", label: "Nicht mehr anrufen", satz: "Dauerhafte Telefonsperre — sofort.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "alle" },
  { key: "mensch_verbinden", label: "Mensch verbinden", satz: "Ins Softphone des Zuständigen, sonst Anruf eintragen.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "alle" },
  { key: "anruf_beenden", label: "Anruf beenden", satz: "Ergebnis in die Akte, auflegen.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "alle" },
];
export const ARAS_AMPEL_SCHALTER = "aras_ampel";
export const DELEGATION = ["responses", "client"] as const;

// ── Ereignisse, Status, Adapter, Stimmen ───────────────────────────────────
export const PLAN_STATUS = ["wartet", "gewaehlt", "laeuft", "fertig", "verfallen", "gesperrt", "verschoben"] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];
export function istPlanStatusWert(v: unknown): v is PlanStatus { return typeof v === "string" && (PLAN_STATUS as readonly string[]).includes(v); }

export const ADAPTER = ["openai_live", "openai_realtime", "kaskade_sonic", "attrappe"] as const;
export type AdapterName = (typeof ADAPTER)[number];
export const ADAPTER_TEXT: Record<AdapterName, string> = {
  openai_live: "OpenAI GPT-Live (Standard)", openai_realtime: "OpenAI Realtime (Rückfall)",
  kaskade_sonic: "Kaskade Deepgram → Gehirn → Cartesia Sonic (Plan B)", attrappe: "Attrappe (nur Prüfstand)",
};

/** laut OpenAI-Doku 19.10.2026: flitz männlich, nuri/juni weiblich; dazu "eigene:<name>" (beschriebene Stimme). */
export const STIMMEN_OPENAI = ["flitz", "nuri", "juni"] as const;
export function stimmeGueltig(s: string): boolean {
  return (STIMMEN_OPENAI as readonly string[]).includes(s) || /^eigene:[a-z0-9_-]{1,40}$/i.test(s);
}

/** Dienste in fiaon_ki_nutzung. */
export const ARAS_DIENSTE = { stimme: "aras-stimme", gehirn: "aras-gehirn", nachbereitung: "aras-nachbereitung", pruefung: "pruef-mara" } as const;

/** Ergebnisse: der bestehende Katalog + zwei ARAS-eigene. */
export const ARAS_ERGEBNISSE = [...ERGEBNISSE, "uebergeben", "abgebrochen"] as const;
export type ArasErgebnis = (typeof ARAS_ERGEBNISSE)[number];
export function istArasErgebnis(v: unknown): v is ArasErgebnis { return typeof v === "string" && (ARAS_ERGEBNISSE as readonly string[]).includes(v); }

/** Ereignisarten in fiaon_mara_protokoll (kanal 'telefon') und im SSE-Strom. */
export const EREIGNISSE = ["aras_gewaehlt", "aras_angenommen", "aras_mailbox", "aras_ki_hinweis", "aras_aufnahme_ja", "aras_aufnahme_nein",
  "aras_werkzeug", "aras_zusage", "aras_termin", "aras_link", "aras_uebergabe", "aras_sperre", "aras_ende", "aras_fehler", "aras_pruefung", "aras_notaus",
  "aras_amd_widerspruch"] as const;
export type EreignisArt = (typeof EREIGNISSE)[number];

export interface ArasEreignis {
  art: EreignisArt;
  am: string;
  callId: number; arasAnrufId?: number; personId?: number | null;
  spielart: Spielart;
  text?: string;
  daten?: Record<string, unknown>;
}

// ── Fenster, Grenzen, Preise ───────────────────────────────────────────────
export type Fenster = Record<string, [string, string]>;             // "1-5": ["09:00","19:00"], "6": [...]
export const FENSTER_VORGABE: { verkauf: Fenster; rate: Fenster } = {
  verkauf: { "1-5": ["09:00", "19:00"], "6": ["10:00", "16:00"] },
  rate: { "1-5": ["09:00", "19:00"] },
};
export const FENSTER_FRUEHESTENS = "08:00", FENSTER_SPAETESTENS = "20:00";
/** Probeanrufe (nur an die hinterlegte eigene Nummer): 07–23 Uhr. */
export const PROBE_FRUEHESTENS = "07:00", PROBE_SPAETESTENS = "23:00";
export const RATEN_TAKTE_VORGABE = [3, 10, 20];
export const JE_PERSON_TAG = 1, JE_PERSON_WOCHE = 3, VERSUCHE_ENDE = 6, PAUSE_NACH_FEHL_TAGE = 7, FEHL_FOLGE_PAUSE_AB = 3;
export const PARALLEL_HOECHSTENS = 5, JE_STUNDE_HOECHSTENS = 120, TAG_EURO_HOECHSTENS = 300;
export const KOLLISION_MINUTEN = 5;
export const LEAD_FRIST_SEK = 60, ZURUF_FRIST_SEK = 120;
export const TRANSKRIPT_FRIST_TAGE = 90, EINWILLIGUNG_JAHRE = 5;
export const ANRUF_ZEITLIMIT_SEK = 1800, MAILBOX_SCHWEIGEN_MS = 4000;
/** Probeanruf: ohne hinterlegte aras_probe_nummer die Nummer im Ausweis des Inhabers (Justin, Agent 928). Nie eine andere. */
export const PROBE_AGENT_VORGABE = 928;
/** Preise (Listenpreise 19.10.2026, Schätzwerte — monatlich aus den Rechnungen nachziehen). */
export const USD_EUR = 0.92;
export const PREIS_MIN_USD: Record<string, number> = { "gpt-live-1": 0.05, "gpt-realtime-2.1-mini": 0.08 };
export const TWILIO_MIN_CENTS_DE = 4.3, AMD_CENTS = 0.7;
export function stimmKostenCents(modell: string, sekunden: number): number {
  const usd = PREIS_MIN_USD[modell] ?? 0.05;
  return Math.round(((Math.max(0, sekunden) / 60) * usd * USD_EUR) * 1000) / 10;
}
export function telefonKostenCents(sekunden: number, mitAmd = true): number {
  const min = Math.ceil(Math.max(0, sekunden) / 60);
  return Math.round((min * TWILIO_MIN_CENTS_DE + (mitAmd ? AMD_CENTS : 0)) * 10) / 10;
}

// ── Die Schlüssel in fiaon_settings (Vorgabe + Grenze) ─────────────────────
export type SchluesselTyp = "schalter" | "zahl" | "text" | "enum" | "json";
export interface SchluesselDef {
  typ: SchluesselTyp; vorgabe: string; satz: string;
  min?: number; max?: number; enum?: readonly string[]; maxZeichen?: number;
  /** Zusätzliche Prüfung — gibt den Grund zurück, warum der Wert nicht geht, sonst null. */
  pruefen?: (wert: string) => string | null;
}

// Justin 20.10.2026 nach seinen Probeanrufen: „zu viel nach KI … menschlicher sprechen“. Der KI-Hinweis bleibt der erste Satz
// (KI-VO Art. 50), aber leicht und charmant statt Belehrung — „Grüß Gott“ statt „Hallo“ setzt der Dialekt (aras_dialekt).
export const KI_HINWEIS_VORGABE = "Hallo, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI, aber eine sehr nette.";
// Probe 20.10.2026 (Justin): die alte Frage war zu lang und steif (10 s, Internetadresse vorgelesen). Kurz, eine Frage, kein Link —
// Speicherdauer und Datenschutzerklärung nennt Aras nur, wenn der Kunde nachfragt (shared/fiaon-aras-prompt.ts, AUFZEICHNUNG).
// Justins Test 20.10. (Anruf 6): „Ein kurzes Ja reicht.“ klang wie Drängeln — die Frage ist jetzt EIN Satz. Ob er Ja sagt,
// wertet die Brücke aus seiner Antwort (istAufnahmeJa); bei Zögern erklärt Aras ruhig und fragt einmal klar nach.
export const AUFNAHME_FRAGE_VORGABE = "Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?";
/** Die gespeicherte Aufnahme-Frage, gesäubert: angehängtes Drängeln („Ein kurzes Ja reicht.“) fällt weg. Rein. */
export function aufnahmeFrageSauber(satz: string): string {
  const t = String(satz ?? "").replace(/\s*(?:Ein kurzes Ja reicht|Ein Ja reicht|Sagen Sie (?:bitte )?(?:einfach )?Ja|Dann sagen Sie bitte einfach Ja)[.!]?\s*$/i, "").trim();
  return t || AUFNAHME_FRAGE_VORGABE;
}
/** Eine Aufnahme-Frage: EIN Satz, der nach der Aufzeichnung fragt und mit „?“ endet. Gibt den Grund zurück oder null. Rein. */
export function aufnahmeFrageFehler(w: string): string | null {
  const t = String(w ?? "").trim();
  if (!/aufzeichn|aufnehm|aufnahme|record/i.test(t)) return "Die Aufnahme-Frage muss nach der Aufzeichnung fragen.";
  if (!/\?\s*$/.test(t)) return "Die Aufnahme-Frage endet mit einem Fragezeichen (EIN Satz, keine Nachsätze).";
  if ((t.match(/\?/g) ?? []).length > 1) return "Die Aufnahme-Frage ist EINE Frage.";
  return null;
}

/** Vertrag § 3: JSON { spielart: "an" | "aus" } — lead, stufe_b, rueckholung erst nach LEXR. Fehlende Spielarten = Vorgabe. */
export const SPIELARTEN_VORGABE: Record<Spielart, "an" | "aus"> = {
  termin: "an", zuruf: "an", stufe_a: "an", rate: "an", zusage: "an", auftrag: "an", probe: "an",
  lead: "aus", stufe_b: "aus", rueckholung: "aus", eingehend: "aus",
};
/** „an“, true, 1 → an. */
const istAn = (v: unknown) => v === true || v === 1 || /^(an|true|1|ja)$/i.test(String(v ?? ""));

const E164 = /^\+[1-9]\d{6,15}$/;
const DACH_VORWAHL = /^\+(49|43|41)\d{5,}$/;

function jsonLesen(wert: string): unknown {
  try { return JSON.parse(wert); } catch { return undefined; }
}

function fensterPruefen(wert: string): string | null {
  const j = jsonLesen(wert) as any;
  if (!j || typeof j !== "object" || Array.isArray(j)) return "Fenster: JSON wie { verkauf: { \"1-5\": [\"09:00\",\"19:00\"] }, rate: { … } }.";
  for (const k of Object.keys(j)) if (k !== "verkauf" && k !== "rate") return `Fenster: „${k}“ gibt es nicht (verkauf, rate).`;
  for (const teil of ["verkauf", "rate"]) {
    const f = j[teil];
    if (f == null) continue; // fehlender Teil = Vorgabe
    if (typeof f !== "object") return `Fenster: „${teil}“ ist kein Objekt.`;
    for (const [tage, zeit] of Object.entries(f)) {
      if (!/^([1-6])(-([1-6]))?$/.test(tage)) return `Fenster: Tage „${tage}“ — erlaubt 1–6 (Mo–Sa), nie 7 (So).`;
      if (!Array.isArray(zeit) || zeit.length !== 2) return `Fenster: „${tage}“ braucht [von, bis].`;
      const [von, bis] = zeit as string[];
      if (!/^\d{2}:\d{2}$/.test(von) || !/^\d{2}:\d{2}$/.test(bis)) return `Fenster: Zeiten als HH:MM.`;
      if (von < FENSTER_FRUEHESTENS || bis > FENSTER_SPAETESTENS || von >= bis) return `Fenster: nur zwischen ${FENSTER_FRUEHESTENS} und ${FENSTER_SPAETESTENS}, von < bis.`;
    }
  }
  return null;
}

export const ARAS_SCHLUESSEL: Record<string, SchluesselDef> = {
  aras_an: { typ: "schalter", vorgabe: "aus", satz: "Ohne „an“ wählt ARAS keinen Kunden (Probeanruf geht trotzdem)." },
  aras_notaus: { typ: "schalter", vorgabe: "aus", satz: "Notaus: kein Wählen, laufende Gespräche enden mit Abschiedssatz." },
  aras_leerlauf: { typ: "schalter", vorgabe: "aus", satz: "Leerlauf: kein neues Wählen, laufende Gespräche enden normal (vor jedem Deploy)." },
  aras_adapter: { typ: "enum", vorgabe: "openai_live", enum: ADAPTER, satz: "Welche Stimm-Technik die Brücke nimmt." },
  aras_delegation: { typ: "enum", vorgabe: "responses", enum: DELEGATION, satz: "Wie GPT-Live Werkzeuge aufruft (Scheibe 1: responses)." },
  aras_modell_stimme: { typ: "text", vorgabe: "gpt-live-1", maxZeichen: 60, satz: "Das Sprachmodell." },
  aras_modell_gehirn: { typ: "text", vorgabe: "", maxZeichen: 60, satz: "Hintergrund-Modell für Werkzeuge (leer = Hausmodell)." },
  aras_stimme: { typ: "text", vorgabe: "flitz", maxZeichen: 48, satz: "Die Stimme (flitz, nuri, juni oder eigene:<name>).", pruefen: (w) => (stimmeGueltig(w) ? null : "Stimme: flitz, nuri, juni oder eigene:<name>.") },
  aras_stimme_beschreibung: { typ: "text", vorgabe: "", maxZeichen: 400, satz: "Eigene Stimme in Worten (nur ohne EU-Region)." },
  aras_name: { typ: "text", vorgabe: "Aras", maxZeichen: 40, satz: "Wie er sich vorstellt.", pruefen: (w) => (w.trim() ? null : "Name darf nicht leer sein.") },
  aras_nachname: { typ: "text", vorgabe: "", maxZeichen: 40, satz: "Nachname — Vorgabe leer (eine KI braucht keinen)." },
  aras_fuellwoerter: { typ: "enum", vorgabe: "normal", enum: ["sparsam", "normal", "viel"], satz: "Wie viele „hm“, „also“, „genau“." },
  aras_lachen: { typ: "schalter", vorgabe: "an", satz: "Kurzes Lachen als Antwort auf etwas Lustiges." },
  aras_tempo: { typ: "enum", vorgabe: "normal", enum: ["ruhig", "normal", "zuegig"], satz: "Sprechtempo." },
  aras_zuhoerlaute: { typ: "enum", vorgabe: "normal", enum: ["sparsam", "normal"], satz: "„mhm“, „ja“ beim Zuhören." },
  // Ton-Regler aus dem Nachtrag „Persona & Skalierung“ (Justin 19.10.2026): Energie und Abschluss-Härte.
  aras_energie: { typ: "enum", vorgabe: "lebendig", enum: ["ruhig", "lebendig", "vollgas"], satz: "Wie viel Schwung: ruhig, lebendig (Vorgabe) oder Vollgas — erst nach dem Test." },
  aras_abschluss: { typ: "enum", vorgabe: "klar", enum: ["sanft", "klar", "hartnaeckig"], satz: "Wie oft er nach einem Nein nachfragt: sanft 0, klar 1, hartnäckig 2 — nie 3." },
  // Justin 20.10.2026: „eine Stimme mit Dialekt, also vielleicht Österreichisch“ — Akzent und ein paar Wörter, die jeder versteht, nie tiefer Dialekt.
  aras_dialekt: { typ: "enum", vorgabe: "hochdeutsch", enum: ["hochdeutsch", "oesterreichisch_leicht", "oesterreichisch"], satz: "Akzent: Hochdeutsch, leicht österreichisch oder deutlich wienerisch — immer verständlich." },
  // Justin 20.10.2026: „ein paar Hintergrundgeräusche“ — Büro-Atmosphäre unter Aras' Stimme (server/lib/fiaon-aras-atmo.ts).
  aras_hintergrund: { typ: "enum", vorgabe: "aus", enum: ["aus", "buero_leise", "buero"], satz: "Büro-Atmosphäre unter der Stimme: aus, leise oder deutlicher." },
  // Justins Test 20.10. (Anruf 5): „Also...“ mitten in seine Denkpause. GPT-Live hat keinen Schalter für das Zuhören (voll-duplex) —
  // darum zwei Hebel: die Anweisung (Interruption policy) und das Geduld-Tor der Brücke (GEDULD_MS). Vorgabe: geduldig.
  aras_zuhoeren: { typ: "enum", vorgabe: "geduldig", enum: ["geduldig", "normal", "flott"], satz: "Wie lange Aras nach einer Pause wartet: geduldig (Vorgabe), normal oder flott." },
  aras_ki_hinweis_satz: { typ: "text", vorgabe: KI_HINWEIS_VORGABE, maxZeichen: 400, satz: "Der erste Satz — muss „KI“ oder „digitale“ enthalten.", pruefen: (w) => (/\bKI\b|digitale/i.test(w) ? null : "Der KI-Hinweis muss „KI“ oder „digitale“ enthalten.") },
  aras_aufnahme_frage: { typ: "text", vorgabe: AUFNAHME_FRAGE_VORGABE, maxZeichen: 400, satz: "Die Frage vor der Aufnahme — EIN Satz mit „?“, aufgenommen wird nur nach einem Ja.", pruefen: aufnahmeFrageFehler },
  aras_spielarten: { typ: "json", vorgabe: JSON.stringify(SPIELARTEN_VORGABE), satz: "Welche Gesprächsarten ARAS führt.", pruefen: (w) => {
    const j = jsonLesen(w) as any;
    if (!j || typeof j !== "object" || Array.isArray(j)) return "Spielarten: JSON { spielart: \"an\" | \"aus\" }.";
    for (const [k, v] of Object.entries(j)) {
      if (!istSpielart(k)) return `Spielarten: „${k}“ gibt es nicht.`;
      if (!(v === true || v === false || v === "an" || v === "aus")) return `Spielarten: ${k} an oder aus.`;
    }
    return null;
  } },
  aras_parallel: { typ: "zahl", vorgabe: "2", min: 1, max: PARALLEL_HOECHSTENS, satz: "Gespräche gleichzeitig." },
  aras_je_stunde: { typ: "zahl", vorgabe: "40", min: 1, max: JE_STUNDE_HOECHSTENS, satz: "Wählversuche je Stunde." },
  aras_tag_euro: { typ: "zahl", vorgabe: "60", min: 0, max: TAG_EURO_HOECHSTENS, satz: "Kosten-Deckel je Tag (KI + Telefon)." },
  aras_fenster: { typ: "json", vorgabe: JSON.stringify(FENSTER_VORGABE), satz: "Anruf-Fenster je Wochentag (08–20 Uhr, nie So).", pruefen: fensterPruefen },
  aras_raten_takte: { typ: "json", vorgabe: JSON.stringify(RATEN_TAKTE_VORGABE), satz: "Tage nach Fälligkeit, an denen ARAS anruft.", pruefen: (w) => {
    const j = jsonLesen(w);
    if (!Array.isArray(j) || j.length === 0 || j.length > 4) return "Raten-Takte: 1–4 Zahlen, z. B. [3,10,20].";
    if (j.some((n) => !Number.isInteger(n) || n < 1 || n > 30)) return "Raten-Takte: ganze Zahlen 1–30.";
    return null;
  } },
  aras_je_person_tag: { typ: "zahl", vorgabe: String(JE_PERSON_TAG), min: 1, max: 2, satz: "Versuche je Person und Tag (Mensch + ARAS zusammen)." },
  aras_je_person_woche: { typ: "zahl", vorgabe: String(JE_PERSON_WOCHE), min: 1, max: 5, satz: "Versuche je Person und Woche." },
  aras_versuche_ende: { typ: "zahl", vorgabe: String(VERSUCHE_ENDE), min: 1, max: 10, satz: "Nach so vielen Fehlversuchen in Folge: Schluss." },
  aras_mailbox_nachricht: { typ: "schalter", vorgabe: "aus", satz: "Auf der Mailbox eine kurze Nachricht lassen." },
  aras_eingehend_modus: { typ: "enum", vorgabe: "nach_team", enum: ["aus", "nach_team", "immer"], satz: "Wer auf der ARAS-Nummer abnimmt." },
  aras_uebergabe: { typ: "json", vorgabe: JSON.stringify({ sonst: "betreuer" }), satz: "Wer Übergaben annimmt (rate/verkauf: Mitarbeiter-Kennungen, sonst: betreuer).", pruefen: (w) => {
    const j = jsonLesen(w) as any;
    if (!j || typeof j !== "object") return "Übergabe: JSON { rate: [ids], verkauf: [ids], sonst: \"betreuer\" }.";
    return null;
  } },
  aras_probe_nummer: { typ: "text", vorgabe: "", maxZeichen: 20, satz: "Die EINE Nummer für Probeanrufe (nur DACH).", pruefen: (w) => (!w || (E164.test(w) && DACH_VORWAHL.test(w)) ? null : "Probe-Nummer: +49/+43/+41 in internationaler Schreibweise.") },
  aras_ausweis_agent_id: { typ: "zahl", vorgabe: "0", min: 0, max: 999999, satz: "Der ARAS-Ausweis in fiaon_agents (art = ki) — setzt der Erstlauf." },
  // Stufenplan (Nachtrag Persona & Skalierung): 0 Probe · 1 Test · 2 Leise · 3 Voll. Vorgabe 0 = nur Probeanrufe.
  aras_stufe: { typ: "zahl", vorgabe: "0", min: 0, max: 3, satz: "Ausbaustufe: 0 nur Probe · 1 Test (20/Tag) · 2 Leise (150/Tag) · 3 Voll (430/Tag)." },
  aras_stufe_auto: { typ: "schalter", vorgabe: "an", satz: "Stufe nach den Ampel-Werten: bei Rot eine Stufe zurück, bei Grün über Tage eine hoch (nie über 3, nie aus 0)." },
  aras_lernen_an: { typ: "schalter", vorgabe: "an", satz: "Wochen-Lernvorschlag für den Stundenplan (nur Anzeige)." },
  aras_caller_id_at: { typ: "text", vorgabe: "", maxZeichen: 20, satz: "Absendernummer für Österreich (leer = ARAS_CALLER_ID).", pruefen: (w) => (!w || E164.test(w) ? null : "Nummer in internationaler Schreibweise.") },
  aras_caller_id_ch: { typ: "text", vorgabe: "", maxZeichen: 20, satz: "Eingetragene Schweizer Nummer — ohne sie keine Werbe-Spielart an CH.", pruefen: (w) => (!w || E164.test(w) ? null : "Nummer in internationaler Schreibweise.") },
  aras_ampel: { typ: "json", vorgabe: JSON.stringify({ stufen: {}, verlauf: [] }), satz: "Werkzeug-Ampel (Stufe je Werkzeug)." },
};
export const ARAS_SCHLUESSEL_LISTE: readonly string[] = Object.keys(ARAS_SCHLUESSEL);

/** Einen Wert gegen seine Grenze prüfen. Gibt den gespeicherten Wert zurück oder wirft mit Klartext. */
export function einstellungPruefen(schluessel: string, wert: unknown): string {
  const def = ARAS_SCHLUESSEL[schluessel];
  if (!def) throw new Error(`Unbekannte Einstellung „${schluessel}“.`);
  let w = String(wert ?? "").trim();
  switch (def.typ) {
    case "schalter": {
      const an = /^(an|true|1|ja)$/i.test(w);
      const aus = /^(aus|false|0|nein|)$/i.test(w);
      if (!an && !aus) throw new Error(`„${schluessel}“: an oder aus.`);
      w = an ? "an" : "aus";
      break;
    }
    case "zahl": {
      const n = Number(w.replace(",", "."));
      if (!Number.isFinite(n)) throw new Error(`„${schluessel}“: eine Zahl.`);
      const min = def.min ?? -Infinity, max = def.max ?? Infinity;
      if (n < min || n > max) throw new Error(`„${schluessel}“: zwischen ${min} und ${max}.`);
      w = String(n);
      break;
    }
    case "enum":
      if (!def.enum?.includes(w)) throw new Error(`„${schluessel}“: ${def.enum?.join(" / ")}.`);
      break;
    case "text":
      if (def.maxZeichen && w.length > def.maxZeichen) throw new Error(`„${schluessel}“: höchstens ${def.maxZeichen} Zeichen.`);
      break;
    case "json":
      if (jsonLesen(w) === undefined) throw new Error(`„${schluessel}“: kein gültiges JSON.`);
      break;
  }
  if (def.pruefen) {
    const grund = def.pruefen(w);
    if (grund) throw new Error(grund);
  }
  return w;
}

/** Die Ton-Regler (Stimmregie) — sie schreiben den Regie-Text der Sitzung, kein Code-Pfad sonst. */
export const HINTERGRUENDE = ["aus", "buero_leise", "buero"] as const;
export type Hintergrund = (typeof HINTERGRUENDE)[number];
export function istHintergrund(v: unknown): v is Hintergrund { return typeof v === "string" && (HINTERGRUENDE as readonly string[]).includes(v); }
export const HINTERGRUND_TEXT: Record<Hintergrund, string> = { aus: "aus", buero_leise: "Büro leise", buero: "Büro" };
export const DIALEKTE = ["hochdeutsch", "oesterreichisch_leicht", "oesterreichisch"] as const;
export type Dialekt = (typeof DIALEKTE)[number];
export function istDialekt(v: unknown): v is Dialekt { return typeof v === "string" && (DIALEKTE as readonly string[]).includes(v); }
export const DIALEKT_TEXT: Record<Dialekt, string> = { hochdeutsch: "Hochdeutsch", oesterreichisch_leicht: "leicht österreichisch", oesterreichisch: "österreichisch" };
/** Wie geduldig Aras zuhört (aras_zuhoeren, Justins Test 20.10.: „Also...“ in seine Denkpause). */
export const ZUHOEREN = ["geduldig", "normal", "flott"] as const;
export type Zuhoeren = (typeof ZUHOEREN)[number];
export function istZuhoeren(v: unknown): v is Zuhoeren { return typeof v === "string" && (ZUHOEREN as readonly string[]).includes(v); }
export const ZUHOEREN_TEXT: Record<Zuhoeren, string> = { geduldig: "geduldig", normal: "normal", flott: "flott" };
/**
 * Das Geduld-Tor der Brücke: so lange muss der Kunde still sein, bevor Aras' neuer Redebeitrag zu hören ist. Fängt Aras
 * früher an (der Kunde holt nur Luft) und der Kunde redet weiter, hört der Kunde den Ansatz nie („Also...“ fällt weg).
 * flott = 0: kein Tor.
 */
export const GEDULD_MS: Record<Zuhoeren, number> = { geduldig: 700, normal: 400, flott: 0 };
export interface Regie {
  fuellwoerter: "sparsam" | "normal" | "viel"; lachen: boolean; tempo: "ruhig" | "normal" | "zuegig"; zuhoerlaute: "sparsam" | "normal";
  energie: "ruhig" | "lebendig" | "vollgas"; abschluss: "sanft" | "klar" | "hartnaeckig";
  /** Akzent (Justin 20.10.2026) — Vorgabe Hochdeutsch, bis er wählt. */
  dialekt: Dialekt;
  /** Zuhören (aras_zuhoeren) — fehlt es (alte Proben), gilt „geduldig“. */
  zuhoeren?: Zuhoeren;
}
export const REGIE_VORGABE: Regie = { fuellwoerter: "normal", lachen: true, tempo: "normal", zuhoerlaute: "normal", energie: "lebendig", abschluss: "klar", dialekt: "hochdeutsch", zuhoeren: "geduldig" };
export type Stufe = 0 | 1 | 2 | 3;

// ── Stufenplan (Nachtrag Persona & Skalierung; Koordinator 20.10.2026: HART durchsetzen) ──────────────────
// Stufe 0 = nur Probeanrufe, NIE ein Kunde — auch nicht mit aras_an = an. Jede Stufe hat feste Obergrenzen; es gilt
// immer das Engere aus Stufe und Schalter (aras_parallel, aras_tag_euro, aras_spielarten).
export interface StufenRegel {
  stufe: Stufe; name: string;
  /** Wählversuche bei Kunden je Tag (ohne Probe). */
  versucheJeTag: number;
  parallel: number; tagEuro: number;
  spielarten: readonly Spielart[];
  /** Nur Stufe 1: Rate nur an diesen Tagen nach Fälligkeit (Tag 1–3). null = die Raten-Takte gelten. */
  rateTage: readonly number[] | null;
  /** Zuruf nur mit „JA per Nachricht“ (zuruf_whatsapp/zuruf_mail); Antrag-/Lead-Kästchen (Stufe B frisch, Leads) erst ab Stufe 3. */
  zurufNurNachricht: boolean;
}
export const STUFEN: Record<Stufe, StufenRegel> = {
  0: { stufe: 0, name: "Probe", versucheJeTag: 0, parallel: 0, tagEuro: 0, spielarten: [], rateTage: null, zurufNurNachricht: true },
  // Stufe 1 „Test“: nur Rückrufe (gebuchter Anruf, Auftrag aus der Akte), Stufe A und Raten an Tag 1–3 (Koordination 20.10.).
  1: { stufe: 1, name: "Test", versucheJeTag: 20, parallel: 1, tagEuro: 15, spielarten: ["termin", "auftrag", "stufe_a", "rate"], rateTage: [1, 2, 3], zurufNurNachricht: true },
  2: { stufe: 2, name: "Leise", versucheJeTag: 150, parallel: 2, tagEuro: 60, spielarten: ["termin", "auftrag", "stufe_a", "rate", "zuruf", "zusage"], rateTage: null, zurufNurNachricht: true },
  3: { stufe: 3, name: "Voll", versucheJeTag: 430, parallel: 5, tagEuro: 150, spielarten: ["termin", "auftrag", "stufe_a", "rate", "zuruf", "zusage", "lead", "stufe_b", "rueckholung"], rateTage: null, zurufNurNachricht: false },
};
/** Die wirksamen Grenzen: immer das Engere aus Stufe und Schalter. Rein. */
export function stufenGrenzen(e: { stufe: number; parallel: number; tagEuro: number; spielarten: Partial<Record<Spielart, boolean>> }): {
  stufe: Stufe; regel: StufenRegel; parallel: number; tagEuro: number; versucheJeTag: number; spielartErlaubt: (s: Spielart) => boolean;
} {
  const stufe = (Math.max(0, Math.min(3, Math.round(Number(e.stufe) || 0)))) as Stufe;
  const regel = STUFEN[stufe];
  return {
    stufe, regel,
    parallel: Math.max(0, Math.min(Number(e.parallel) || 0, regel.parallel)),
    tagEuro: Math.max(0, Math.min(Number(e.tagEuro) || 0, regel.tagEuro)),
    versucheJeTag: regel.versucheJeTag,
    spielartErlaubt: (s) => s === "probe" || (!!e.spielarten[s] && regel.spielarten.includes(s)),
  };
}
/** Stufe 1: eine Rate nur an Tag 1–3 nach Fälligkeit. Sonst gelten die Raten-Takte. Rein. */
export function rateTagErlaubt(stufe: number, tageNachFaelligkeit: number): boolean {
  const tage = STUFEN[(Math.max(0, Math.min(3, Math.round(stufe))) as Stufe)].rateTage;
  return !tage || tage.includes(tageNachFaelligkeit);
}

export interface ArasEinstellungen {
  an: boolean; notaus: boolean; leerlauf: boolean;
  adapter: AdapterName; delegation: (typeof DELEGATION)[number];
  modellStimme: string; modellGehirn: string; stimme: string; stimmeBeschreibung: string;
  name: string; nachname: string;
  regie: Regie;
  /** Büro-Atmosphäre unter der Stimme (aras_hintergrund) — die Brücke mischt sie ins ausgehende Telefon-Audio. */
  hintergrund: Hintergrund;
  kiHinweisSatz: string; aufnahmeFrage: string;
  spielarten: Record<Spielart, boolean>;
  parallel: number; jeStunde: number; tagEuro: number;
  fenster: { verkauf: Fenster; rate: Fenster };
  ratenTakte: number[];
  jePersonTag: number; jePersonWoche: number; versucheEnde: number;
  mailboxNachricht: boolean; eingehendModus: "aus" | "nach_team" | "immer";
  uebergabe: { rate?: number[]; verkauf?: number[]; sonst?: string };
  probeNummer: string; ausweisAgentId: number;
  stufe: Stufe; stufeAuto: boolean;
  lernenAn: boolean; callerIdAt: string; callerIdCh: string;
  ampel: Record<string, AmpelStufe>;
}

/** Rohwerte aus fiaon_settings → typisiert, Grenzen angewandt (ungültige Werte fallen auf die Vorgabe). Rein. */
export function einstellungenAnwenden(roh: Record<string, string | null | undefined>): ArasEinstellungen {
  const w = (k: string): string => {
    const v = roh[k];
    if (v == null || v === "") return ARAS_SCHLUESSEL[k]?.vorgabe ?? "";
    try { return einstellungPruefen(k, v); } catch { return ARAS_SCHLUESSEL[k]?.vorgabe ?? ""; }
  };
  const an = (k: string) => w(k) === "an";
  const zahl = (k: string) => Number(w(k));
  const json = <T,>(k: string, sonst: T): T => { const j = jsonLesen(w(k)); return (j === undefined ? sonst : (j as T)); };
  const spielartenRoh = json<Record<string, unknown>>("aras_spielarten", SPIELARTEN_VORGABE);
  const spielarten = Object.fromEntries(SPIELARTEN.map((s) => [s, istAn(spielartenRoh?.[s] ?? SPIELARTEN_VORGABE[s])])) as Record<Spielart, boolean>;
  const ampelRoh = json<any>("aras_ampel", { stufen: {} });
  const ampel: Record<string, AmpelStufe> = {};
  for (const a of ARAS_AMPEL) {
    const s = ampelRoh?.stufen?.[a.key];
    ampel[a.key] = a.fest || !a.stufen.includes(s) ? a.vorgabe : s;
  }
  return {
    an: an("aras_an"), notaus: an("aras_notaus"), leerlauf: an("aras_leerlauf"),
    adapter: w("aras_adapter") as AdapterName, delegation: w("aras_delegation") as any,
    modellStimme: w("aras_modell_stimme"), modellGehirn: w("aras_modell_gehirn"), stimme: w("aras_stimme"), stimmeBeschreibung: w("aras_stimme_beschreibung"),
    name: w("aras_name") || "Aras", nachname: w("aras_nachname"),
    regie: {
      fuellwoerter: w("aras_fuellwoerter") as Regie["fuellwoerter"], lachen: an("aras_lachen"), tempo: w("aras_tempo") as Regie["tempo"],
      zuhoerlaute: w("aras_zuhoerlaute") as Regie["zuhoerlaute"], energie: w("aras_energie") as Regie["energie"], abschluss: w("aras_abschluss") as Regie["abschluss"],
      dialekt: (istDialekt(w("aras_dialekt")) ? w("aras_dialekt") : "hochdeutsch") as Dialekt,
      zuhoeren: (istZuhoeren(w("aras_zuhoeren")) ? w("aras_zuhoeren") : "geduldig") as Zuhoeren,
    },
    hintergrund: (istHintergrund(w("aras_hintergrund")) ? w("aras_hintergrund") : "aus") as Hintergrund,
    kiHinweisSatz: w("aras_ki_hinweis_satz"), aufnahmeFrage: aufnahmeFrageSauber(w("aras_aufnahme_frage")),
    spielarten,
    parallel: zahl("aras_parallel"), jeStunde: zahl("aras_je_stunde"), tagEuro: zahl("aras_tag_euro"),
    fenster: (() => { const f = json<any>("aras_fenster", FENSTER_VORGABE); return { verkauf: f?.verkauf ?? FENSTER_VORGABE.verkauf, rate: f?.rate ?? FENSTER_VORGABE.rate }; })(),
    ratenTakte: json<number[]>("aras_raten_takte", RATEN_TAKTE_VORGABE),
    jePersonTag: zahl("aras_je_person_tag"), jePersonWoche: zahl("aras_je_person_woche"), versucheEnde: zahl("aras_versuche_ende"),
    mailboxNachricht: an("aras_mailbox_nachricht"), eingehendModus: w("aras_eingehend_modus") as any,
    uebergabe: json("aras_uebergabe", { sonst: "betreuer" }),
    probeNummer: w("aras_probe_nummer"), ausweisAgentId: zahl("aras_ausweis_agent_id"),
    stufe: Math.max(0, Math.min(3, Math.round(zahl("aras_stufe")))) as Stufe, stufeAuto: an("aras_stufe_auto"),
    lernenAn: an("aras_lernen_an"), callerIdAt: w("aras_caller_id_at"), callerIdCh: w("aras_caller_id_ch"),
    ampel,
  };
}

// ── Reine Regeln ───────────────────────────────────────────────────────────
export type Land = "DE" | "AT" | "CH";
export function nummerLand(e164: string | null | undefined): Land | null {
  const n = String(e164 ?? "").replace(/\s/g, "");
  if (n.startsWith("+49")) return "DE";
  if (n.startsWith("+43")) return "AT";
  if (n.startsWith("+41")) return "CH";
  return null;
}

/** Berliner Wandzeit eines Zeitpunkts — ohne die Number(Intl.format())-Falle (formatToParts). */
export function berlinTeile(jetzt: Date): { datum: string; wochentag: number; hhmm: string; stunde: number } {
  const teile = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(jetzt);
  const t = (k: string) => teile.find((p) => p.type === k)?.value ?? "";
  const wt: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const stunde = Number(t("hour")) % 24;
  return { datum: `${t("year")}-${t("month")}-${t("day")}`, wochentag: wt[t("weekday")] ?? 7, hhmm: `${String(stunde).padStart(2, "0")}:${t("minute")}`, stunde };
}

function fensterZeile(f: Fenster, wochentag: number): [string, string] | null {
  for (const [tage, zeit] of Object.entries(f)) {
    const m = /^([1-6])(?:-([1-6]))?$/.exec(tage);
    if (!m) continue;
    const von = Number(m[1]), bis = m[2] ? Number(m[2]) : von;
    if (wochentag >= von && wochentag <= bis) return zeit;
  }
  return null;
}

/**
 * Ist das Fenster für diese Spielart jetzt offen? (Berlin; nie So/Feiertag im Land;
 * ein gebuchter Termin (termin) und ein Probeanruf schlagen das Fenster, bleiben aber in 08–20 Uhr.)
 */
export function fensterOffen(
  spielart: Spielart, land: Land, jetzt: Date,
  opt: { fenster?: { verkauf: Fenster; rate: Fenster }; feiertag?: (land: Land, datum: string) => boolean } = {},
): { offen: boolean; grund: string | null } {
  const b = berlinTeile(jetzt);
  const feiertag = (opt.feiertag ?? ((l, d) => istFeiertag(l as FeiertagLand, d)))(land, b.datum);
  if (spielart === "probe") {
    // Der Probeanruf geht nur an Justins eigene Nummer — er testet, wann er will; nur die Nacht bleibt frei.
    if (b.hhmm < PROBE_FRUEHESTENS || b.hhmm >= PROBE_SPAETESTENS) return { offen: false, grund: "nachtruhe" };
    return { offen: true, grund: null };
  }
  if (spielart === "eingehend") {
    if (b.hhmm < FENSTER_FRUEHESTENS || b.hhmm >= FENSTER_SPAETESTENS) return { offen: false, grund: "nachtruhe" };
    return { offen: true, grund: null };
  }
  if (b.wochentag === 7) return { offen: false, grund: "sonntag" };
  if (feiertag) return { offen: false, grund: "feiertag" };
  if (spielart === "termin") {
    if (b.hhmm < FENSTER_FRUEHESTENS || b.hhmm >= FENSTER_SPAETESTENS) return { offen: false, grund: "nachtruhe" };
    return { offen: true, grund: null };
  }
  const f = opt.fenster ?? FENSTER_VORGABE;
  const zeile = fensterZeile(istVertragsFenster(spielart) ? f.rate : f.verkauf, b.wochentag);
  if (!zeile) return { offen: false, grund: "kein_fenster_heute" };
  if (b.hhmm < zeile[0] || b.hhmm >= zeile[1]) return { offen: false, grund: "ausserhalb_fenster" };
  return { offen: true, grund: null };
}

/** Darf heute noch ein Versuch an diese Person gehen? Zählt Mensch + ARAS zusammen (Aufrufer liefert die Zahlen). */
export function darfVersuch(
  e: { versucheHeute: number; versucheWoche: number; fehlFolge: number; letzterVersuchAm: Date | null; jetzt: Date;
       jePersonTag?: number; jePersonWoche?: number; versucheEnde?: number; spielart?: Spielart },
): { ok: boolean; grund: string | null } {
  const tag = e.jePersonTag ?? JE_PERSON_TAG, woche = e.jePersonWoche ?? JE_PERSON_WOCHE, ende = e.versucheEnde ?? VERSUCHE_ENDE;
  if (e.spielart === "termin" || e.spielart === "probe") return { ok: true, grund: null };
  if (e.versucheHeute >= tag) return { ok: false, grund: "je_person_tag" };
  if (e.versucheWoche >= woche) return { ok: false, grund: "je_person_woche" };
  if (e.fehlFolge >= ende) return { ok: false, grund: "versuche_ende" };
  if (e.fehlFolge >= FEHL_FOLGE_PAUSE_AB && e.letzterVersuchAm) {
    const tage = (e.jetzt.getTime() - e.letzterVersuchAm.getTime()) / 86_400_000;
    if (tage < PAUSE_NACH_FEHL_TAGE) return { ok: false, grund: "pause_nach_fehl" };
  }
  if (e.letzterVersuchAm && e.jetzt.getTime() - e.letzterVersuchAm.getTime() < KOLLISION_MINUTEN * 60_000) return { ok: false, grund: "kollision" };
  return { ok: true, grund: null };
}

export interface Kandidat {
  id: number; spielart: Spielart; prioritaet: number; fruehAb: Date;
  /** Fehlversuche in Folge (aus der bestehenden Zählung). */
  fehlFolge: number;
  /** Betrag in Cent (Rate/Zusage: höher zuerst). */
  betragCents?: number | null;
  /** Wie frisch der Anlass ist (Antrag, Zahlungsmeldung) — jünger zuerst. */
  anlassAm?: Date | null;
}

/** Reihenfolge: Priorität → (Rate: Betrag) → wenige Fehlversuche → frisch vor alt → früheres Fenster. Rein, stabil. */
export function reihen<T extends Kandidat>(kandidaten: readonly T[]): T[] {
  return [...kandidaten].sort((a, b) => {
    if (a.prioritaet !== b.prioritaet) return a.prioritaet - b.prioritaet;
    if ((a.spielart === "rate" || a.spielart === "zusage") && (b.spielart === "rate" || b.spielart === "zusage")) {
      const d = (b.betragCents ?? 0) - (a.betragCents ?? 0);
      if (d !== 0) return d;
    }
    const fa = a.fehlFolge >= FEHL_FOLGE_PAUSE_AB ? 1 : 0, fb = b.fehlFolge >= FEHL_FOLGE_PAUSE_AB ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const aa = a.anlassAm?.getTime() ?? 0, ab = b.anlassAm?.getTime() ?? 0;
    if (aa !== ab) return ab - aa;
    if (a.fehlFolge !== b.fehlFolge) return a.fehlFolge - b.fehlFolge;
    const t = a.fruehAb.getTime() - b.fruehAb.getTime();
    return t !== 0 ? t : a.id - b.id;
  });
}

/** Welche Stunde (0–23) ist für diese Spielart die beste? Aus gemessenen Erreicht-Quoten je Stunde, sonst Vorgabe 9 / 17. */
export function stundeFuer(spielart: Spielart, erreichtJeStunde: Record<number, number> | null | undefined): number {
  const vorgabe = istVertragsFenster(spielart) ? 9 : 17;
  if (!erreichtJeStunde) return vorgabe;
  let beste = vorgabe, quote = -1;
  for (const [h, q] of Object.entries(erreichtJeStunde)) {
    const stunde = Number(h);
    if (stunde < 9 || stunde >= 19) continue;
    if (q > quote) { quote = q; beste = stunde; }
  }
  return beste;
}

/**
 * Druck-Muster (KI-VO Art. 5 Abs. 1 lit. b — wirtschaftliche Lage): EINE Quelle — die harten Telefon-Regeln
 * (shared/fiaon-aras-regeln.ts, wortgleich mit Prüf-Mara E-409). Hier nur weitergereicht (Vertrag § 1).
 */
export { druckFinden } from "./fiaon-aras-regeln";

/** Hat der Kunde um Schluss gebeten? („nicht mehr anrufen“, „lassen Sie mich in Ruhe“) — Hinweis für Prüfung/Nachbereitung. Rein. */
export function sperrwunsch(text: string): boolean {
  return /\b(nicht\s+mehr\s+(an)?rufen|rufen\s+sie\s+(mich\s+)?(bitte\s+)?nicht\s+mehr\s+an|keine\s+anrufe\s+mehr|lassen\s+sie\s+mich\s+in\s+ruhe|rufen\s+sie\s+(mich\s+)?nie\s+wieder|hören\s+sie\s+auf\s+(mich\s+)?anzurufen|streichen\s+sie\s+(mich|meine\s+nummer))\b/i.test(String(text ?? ""));
}

/** Die Zeile mit einem Ja zur Aufnahme? Rein — die Brücke merkt sich den Wortlaut als Nachweis. */
export function istAufnahmeJa(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  if (!t) return false;
  if (/\b(nein|nicht|kein|lieber nicht|ohne)\b/.test(t)) return false;
  // Rauchtest 20.10.: „Ja, aber um was geht's dabei?“ ist kein klares Ja — ein Vorbehalt oder eine Gegenfrage heißt: nachfragen.
  if (/\baber\b|\?\s*$/.test(t)) return false;
  return /\b(ja|jawohl|klar|gerne|gern|in ordnung|okay|ok|passt|einverstanden|von mir aus|machen sie)\b/.test(t);
}
export function istAufnahmeNein(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  return /\b(nein|nicht|lieber nicht|ohne aufzeichnung|keine aufnahme|keine aufzeichnung|bitte nicht)\b/.test(t);
}

// ── JSON-Formen für die Oberfläche (§ 5) ───────────────────────────────────
export interface PlanZeile {
  id: number; personId: number | null; name: string; spielart: Spielart; prioritaet: number; grund: string;
  fruehAb: string; spaetBis: string; status: PlanStatus; versuchNr: number; rechtsgrund: Rechtsgrund; land: string;
}
export interface PlanLage {
  jeSpielart: Record<string, Record<string, number>>;
  naechste: PlanZeile[];
  wartet: number; heuteFertig: number;
}
export interface Tagesplan {
  tag: string;
  stunden: { h: number; je: Record<string, { geplant: number; gewaehlt: number; erreicht: number; gespraeche: number }> }[];
  mengen: Record<string, { pool: number; geplant: number }>;
  lernvorschlag: Lernvorschlag | null;
}
export interface Lernvorschlag { erzeugtAm: string; text: string; stunden: Record<string, number[]> }
export interface LiveSitzung {
  callId: number; arasAnrufId: number; personId: number | null; name: string; spielart: Spielart; seitSek: number;
  zustand: "waehlt" | "klingelt" | "spricht" | "hoert" | "werkzeug" | "ende"; letzteZeilen: { wer: "kunde" | "aras"; text: string }[];
  adapter: AdapterName; aufnahme: boolean;
}
export interface AnrufZeile {
  id: number; callId: number; am: string; spielart: Spielart; personId: number | null; name: string; ergebnis: string | null; dauerSek: number;
  kostenCents: number; pruefung: string; uebergabe: string | null; endeGrund: string | null; angenommen: boolean;
  /** Probeanruf: Justins Daumen (hoch/runter). */
  probeUrteil: string | null;
}
export interface AnrufDetail extends AnrufZeile {
  briefing: unknown; transkript?: { t: number; wer: "kunde" | "aras"; text: string; abgebrochen?: boolean }[] | null;
  zusammenfassung: string | null; ergebnisNotiz: string | null;
  werkzeuge: { werkzeug: string; eingabe: unknown; ergebnis: unknown; ok: boolean | null; dauerMs: number | null; am: string }[];
  aufnahmeUrl?: string | null; kiHinweisAm: string | null; aufnahmeJaAm: string | null; aufnahmeNeinAm: string | null; aufnahmeJaText: string | null;
  adapter: string; modell: string | null; stimme: string | null; promptVersion: string; fehler: string | null;
  /** Befund der harten Regeln ohne Aufnahme-Ja (nur Regelnamen, kein Wortlaut). */
  befund: unknown;
  probeUrteilGrund: string | null;
}
export interface HoerprobeZeile {
  id: number; adapter: string; stimme: string; beschreibung: string | null; text: string; dauerMs: number | null;
  kostenCents: number | null; bewertung: number | null; kommentar: string | null; gewaehltAm: string | null; am: string; hatAudio: boolean;
  /** Dieselbe Zeit unter dem Namen, den der KI-Raum liest (shared/fiaon-ki-team.ts HoerprobeZeile). */
  createdAt: string;
  /** Akzent der Sprechprobe (aras_dialekt) — null bei alten Proben. */
  dialekt?: Dialekt | null;
}
/** Die Ton-Regler der Probe-Seite (Regie) — dieselben Schlüssel liest einstellungenAnwenden → regie. */
export const PROBE_TON_SCHLUESSEL = ["aras_energie", "aras_fuellwoerter", "aras_lachen", "aras_tempo", "aras_zuhoerlaute", "aras_abschluss", "aras_dialekt", "aras_hintergrund", "aras_zuhoeren"] as const;
/** Der Satz für das Stimmen-Studio (Justin, 20.10.2026) — eine Quelle: shared/fiaon-aras-prompt.ts HOERPROBE_SATZ. */
export const HOERPROBE_SATZ_VORGABE = "Hallo, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI, aber eine sehr nette. Ähm, haben Sie kurz zwei Minuten?";
/**
 * Justin 20.10.2026 (abends): „KI mehr Dialekt“ — im Stimmen-Studio je Akzent ein eigener Probesatz, damit er den
 * Unterschied sofort hört. Der KI-Hinweis steht in jedem (KI-VO Art. 50); nach „… nette.“ lacht Aras kurz (Hörprobe).
 */
export const HOERPROBE_SAETZE: Record<Dialekt, string> = {
  hochdeutsch: HOERPROBE_SATZ_VORGABE,
  oesterreichisch_leicht: "Grüß Gott, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI, aber eine sehr nette. Passt's Ihnen grad a bissl, gell?",
  oesterreichisch: "Grüß Gott, hier is der Aras von FIAON — kurz vorweg: I bin a KI, aber a sehr a nette. Schaun's, des geht ganz schnell, passt eh — ham's grad a bissl Zeit, gell?",
};

// ═══════════════════════════════════════════════════════════════════════════
// AKTE & ALLTAG (E-408 Scheibe 2, Nachtrag Akte-Steuerung 19.10.2026)
// „Aras anrufen lassen“ und „Offenes an Aras abgeben“ — beide reihen nur EINEN
// Anruf ein (Spielart `auftrag`). Was bei einem Kunden offen ist, kommt aus der
// Akte (server/lib/fiaon-aras-akte.ts); hier stehen nur Namen, Reihenfolge und
// die Grenzen. Kündigung, Widerruf, Beschwerde, Erstattung, Rechtliches klärt
// Aras nie — das bleibt beim Menschen (er verbindet oder bucht einen Rückruf).
// ═══════════════════════════════════════════════════════════════════════════
export const OFFEN_ARTEN = ["zahlung_gemeldet", "rate", "zusage", "erste_rate", "unterlagen", "rueckruf"] as const;
export type OffenArt = (typeof OFFEN_ARTEN)[number];
export function istOffenArt(v: unknown): v is OffenArt { return typeof v === "string" && (OFFEN_ARTEN as readonly string[]).includes(v); }
/** Ein offener Punkt: `label` für den Menschen in der Akte, `satz` für Aras (Briefing, ohne Systemwörter). */
export interface OffenPunkt { art: OffenArt; label: string; satz: string }
/** Reihenfolge in EINEM Gespräch: erst was schon unterwegs ist, dann Geld, dann Unterlagen, dann der Rückruf-Wunsch. */
export const OFFEN_REIHENFOLGE: Record<OffenArt, number> = { zahlung_gemeldet: 1, rate: 2, zusage: 3, erste_rate: 4, unterlagen: 5, rueckruf: 6 };
export function offenReihen<T extends { art: OffenArt }>(punkte: readonly T[]): T[] {
  return [...punkte].sort((a, b) => OFFEN_REIHENFOLGE[a.art] - OFFEN_REIHENFOLGE[b.art]);
}
/** Was Aras am Telefon nie erledigt — steht in der Akte sichtbar als „bleibt bei dir“. */
export const BLEIBT_BEI_DIR = ["Kündigung", "Widerruf", "Beschwerde", "Erstattung", "Rechtliches (Anwalt, Behörde)"] as const;
export const AUFTRAG_MAX_ZEICHEN = 500;
export const ARAS_NOTIZ_MAX_ZEICHEN = 300;
/** Wann Aras anrufen soll: so bald wie möglich (im Fenster), heute ab einer Uhrzeit, morgen. */
export const AUFTRAG_WANN = ["bald", "heute_ab", "morgen"] as const;
export type AuftragWann = (typeof AUFTRAG_WANN)[number];
/** Ein Auftrag aus der Akte bleibt 48 Stunden in der Warteschlange; nicht erreicht → höchstens drei Versuche (je ein Tag später). */
export const AUFTRAG_GUELTIG_STUNDEN = 48, AUFTRAG_VERSUCHE = 3;

/** Der Freitext des Betreuers: Leerraum glätten, auf 500 Zeichen kürzen. Rein. */
export function auftragSaubern(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, AUFTRAG_MAX_ZEICHEN);
}

/** Ausbaustufe → darf Aras Kunden anrufen? Stufe 0 = nur Probeanrufe (Nachtrag Persona & Skalierung). */
export function kundenAnrufeAn(e: { an: boolean; stufe: number; notaus: boolean }): boolean {
  return e.an && !e.notaus && e.stufe >= 1;
}
