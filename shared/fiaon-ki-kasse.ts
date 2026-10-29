// ═══════════════════════════════════════════════════════════════════════════
// DIE EHRLICHE KI-KASSE (E-458, 29.10.2026) — reine Regeln, keine Datenbank
//
// Justin 29.10.2026 („go Plan“, Punkt 7): Gesamtdeckel in echtem Geld, ≈ 75 % für
// B2B-Neukunden, Antworten an Menschen haben bei Knappheit immer Vorrang, Reserve
// ≈ 5 %, eine Nachhol-Bremse nach jeder KI-Pause, dazu das Sparpaket E-262.
//
// DER BEFUND VORHER (Plan E-458, bestand/ki-budget; E-258 vom 29.09.):
//   · Die Preistabelle rechnete gpt-5.5 mit 1,25 / 10 $ je 1 Mio. Token (GPT-5-Preis)
//     statt 5 / 30 $ — jede Anzeige und jeder Deckel lag ≈ 3,3-mal zu niedrig.
//   · cached_tokens wurden verworfen; der Tag begann um 01:00/02:00 Berlin (UTC).
//   · Kein Gesamtdeckel, keine Anteile: rund 60 % des Geldes gingen in Privat.
//   · Nach jeder Freigabe fraß die Nachhol-Welle das frische Guthaben (27.10.:
//     20,2 $ in 48 Minuten, danach wieder leer — neun Pausen seit 06.10.).
//
// HIER STEHT DIE EINE WAHRHEIT für Server, Chefbüro und Prüfstand
// (scripts/pruef-ki-kasse.ts): Preise, Token-Zählung aus jeder OpenAI-Form,
// Bereiche mit Anteilen, die Zuordnung Dienst → Bereich, die Entscheidung
// kasseEntscheiden() und das Modell je Aufgabe. Geld in Dollar-Cent (OpenAI
// rechnet in Dollar; die USt. auf die Aufladung kommt obendrauf).
// ═══════════════════════════════════════════════════════════════════════════

// ── PREISE ──────────────────────────────────────────────────────────────────
export interface KiPreis {
  /** Dollar-Cent je 1.000 Eingabe-Token. */
  ein: number;
  /** Dollar-Cent je 1.000 Eingabe-Token, die OpenAI aus dem Cache liest (Prompt-Caching). */
  gecacht: number;
  /** Dollar-Cent je 1.000 Ausgabe-Token (das Nachdenken zählt mit). */
  aus: number;
}

/**
 * Listenpreise (OpenAI, Stand E-258 vom 29.09.2026; gecacht = ein Zehntel, bei gpt-4.1 ein Viertel).
 * Neues Modell? Hier eintragen — sonst rechnet die Kasse mit ERSATZ_PREIS (dem teuersten).
 */
export const KI_PREISE: Readonly<Record<string, KiPreis>> = {
  "gpt-5.5": { ein: 0.5, gecacht: 0.05, aus: 3.0 },
  "gpt-5.4": { ein: 0.25, gecacht: 0.025, aus: 1.5 },
  "gpt-5.4-mini": { ein: 0.075, gecacht: 0.0075, aus: 0.45 },
  "gpt-4.1": { ein: 0.2, gecacht: 0.05, aus: 0.8 },
  "gpt-4.1-mini": { ein: 0.04, gecacht: 0.01, aus: 0.16 },
  "gpt-4o-mini": { ein: 0.015, gecacht: 0.0075, aus: 0.06 },
};

/** Unbekanntes Modell (z. B. gpt-6-luna): lieber zu teuer gerechnet als zu billig — sonst bremst kein Deckel. */
export const ERSATZ_PREIS: KiPreis = KI_PREISE["gpt-5.5"];

/** Der Preis eines Modells — „gpt-4.1-mini-2025-04-14“ zählt wie „gpt-4.1-mini“. Rein. */
export function preisFuer(modell: string | null | undefined): { preis: KiPreis; bekannt: boolean } {
  const m = String(modell ?? "").trim();
  const p = KI_PREISE[m] ?? KI_PREISE[m.replace(/-\d{4}-\d{2}-\d{2}$/, "")];
  return p ? { preis: p, bekannt: true } : { preis: ERSATZ_PREIS, bekannt: false };
}

// ── TOKEN-ZÄHLUNG ───────────────────────────────────────────────────────────
export interface TokenZaehlung {
  /** Alle Eingabe-Token (die gecachten eingeschlossen). */
  ein: number;
  /** Davon aus dem Cache gelesen. */
  gecacht: number;
  /** Ausgabe-Token (das Nachdenken eingeschlossen). */
  aus: number;
  /** Davon Nachdenken. */
  denken: number;
}

/**
 * Liest die Zählung aus jeder Form, die OpenAI liefert: Chat Completions (prompt_tokens,
 * prompt_tokens_details.cached_tokens) und Responses (input_tokens, input_tokens_details.cached_tokens).
 * Fehlt etwas, zählt es 0. Rein.
 */
export function zaehlungAus(usage: unknown): TokenZaehlung {
  const u: any = usage && typeof usage === "object" ? usage : {};
  const zahl = (...werte: unknown[]) => {
    for (const w of werte) { const n = Number(w); if (w != null && Number.isFinite(n) && n > 0) return Math.round(n); }
    return 0;
  };
  const ein = zahl(u.prompt_tokens, u.input_tokens);
  const gecacht = Math.min(ein, zahl(u.prompt_tokens_details?.cached_tokens, u.input_tokens_details?.cached_tokens, u.cached_tokens));
  const aus = zahl(u.completion_tokens, u.output_tokens);
  const denken = Math.min(aus, zahl(u.completion_tokens_details?.reasoning_tokens, u.output_tokens_details?.reasoning_tokens, u.reasoning_tokens));
  return { ein, gecacht, aus, denken };
}

/** Dollar-Cent eines Aufrufs zu Listenpreis — gecachte Eingabe zum Cache-Preis. Rein. */
export function centsFuer(modell: string | null | undefined, usage: unknown): number {
  const z = zaehlungAus(usage);
  const { preis } = preisFuer(modell);
  return ((z.ein - z.gecacht) / 1000) * preis.ein + (z.gecacht / 1000) * preis.gecacht + (z.aus / 1000) * preis.aus;
}

// ── BERLINER TAG (nur formatToParts — Zeit-Falle 01.09.2026) ────────────────
function berlinTeile(d: Date): { j: number; m: number; t: number; h: number; min: number } {
  const teile = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const v = (typ: string) => Number(teile.find((p) => p.type === typ)?.value ?? "0");
  return { j: v("year"), m: v("month"), t: v("day"), h: v("hour") === 24 ? 0 : v("hour"), min: v("minute") };
}

/** Der Berliner Kalendertag als JJJJ-MM-TT — daran hängen alle Tagesdeckel. Rein. */
export function kasseTag(d: Date = new Date()): string {
  const b = berlinTeile(d);
  return `${b.j}-${String(b.m).padStart(2, "0")}-${String(b.t).padStart(2, "0")}`;
}

/** Minuten seit Mitternacht in Berlin. Rein. */
export function kasseMinuten(d: Date = new Date()): number {
  const b = berlinTeile(d);
  return b.h * 60 + b.min;
}

// ── BEREICHE UND ANTEILE ────────────────────────────────────────────────────
export type KasseBereich = "b2b" | "menschen" | "privat" | "haus";
export type KasseTopf = KasseBereich | "reserve";

export interface BereichSicht { key: KasseBereich; label: string; satz: string; vorrang?: boolean }

export const KASSE_BEREICHE: readonly BereichSicht[] = [
  { key: "b2b", label: "B2B-Neukunden", satz: "Firmen-Radar, Mail-Motor, Partner, Ratgeber." },
  { key: "menschen", label: "Antworten an Menschen", satz: "Postfach, WhatsApp, Anliegen — bei Knappheit zuerst.", vorrang: true },
  { key: "privat", label: "Privat-Mails", satz: "Mail-Aktion und Mara-Aufträge." },
  { key: "haus", label: "Haus", satz: "Texterkennung, Prüfungen, Analysen, Copilot." },
];

export const KASSE_TOEPFE: readonly KasseTopf[] = ["b2b", "menschen", "privat", "haus", "reserve"];

/** Justin 29.10.: ≈ 75 % B2B, Reserve ≈ 5 % (nur für Antworten an Menschen, wenn ihr Anteil verbraucht ist). */
export const KASSE_ANTEILE_VORGABE: Readonly<Record<KasseTopf, number>> = { b2b: 75, menschen: 10, privat: 5, haus: 5, reserve: 5 };
/** Gesamtdeckel je Berliner Tag in Dollar (Plan E-458: mit Mail-Motor ≈ 50–60 $). */
export const KASSE_TAG_USD_VORGABE = 55;
/** Nachhol-Bremse: so viele Dollar je Stunde nach einer KI-Pause. */
export const KASSE_NACHHOL_USD_VORGABE = 8;
/** So lange nach dem Ende einer Pause gilt die Nachhol-Bremse. */
export const KASSE_NACHHOL_STUNDEN = 6;
/** In den ersten Minuten danach laufen nur Antworten an Menschen. */
export const KASSE_NACHHOL_NUR_ANTWORTEN_MIN = 30;
/** Kürzere Pausen hinterlassen keinen Rückstand — keine Bremse. */
export const KASSE_NACHHOL_AB_PAUSE_MIN = 15;

export const KASSE_SCHLUESSEL = {
  an: "ki_kasse_an",
  tagUsd: "ki_kasse_tag_usd",
  anteile: "ki_kasse_anteile",
  nachholUsd: "ki_kasse_nachhol_je_stunde",
} as const;

/**
 * Welcher Dienst (fiaon_ki_nutzung.dienst, erster Parameter von openaiFetch) zahlt aus welchem Topf.
 * Was hier fehlt, ist „Haus“. Der Firmen-Radar (und mit ihm der Mail-Motor) ist ganz B2B — den Zweck je
 * Radar-Aufruf (Suche, Scan, Mail, Antwort) unterscheidet die Kasse erst, wenn der Radar ihn mitschreibt.
 */
const ZUORDNUNG: Readonly<Record<string, KasseBereich>> = {
  radar: "b2b", "partner-crm": "b2b", firmen: "b2b", impressum: "b2b", "global-berater": "b2b", ratgeber: "b2b",
  "postmeister-antwort": "menschen", "postmeister-einordnen": "menschen", "postmeister-alt": "menschen",
  "mara-whatsapp": "menschen", "mara-anliegen": "menschen", "mara-nacharbeit": "menschen", "kontakt-chat": "menschen",
  "mara-aktion": "privat", "mara-auftrag": "privat",
};

export function bereichFuer(dienst: string | null | undefined): KasseBereich {
  const d = String(dienst ?? "").trim();
  return ZUORDNUNG[d] ?? (/^radar[-_]/.test(d) ? "b2b" : "haus");
}

export function bereichLabel(b: KasseTopf): string {
  return b === "reserve" ? "Reserve" : KASSE_BEREICHE.find((x) => x.key === b)?.label ?? b;
}

/**
 * Die Anteile lesen (fiaon_settings.ki_kasse_anteile, JSON in Prozent). Kaputt, unvollständig oder nicht
 * 100 in Summe → die Vorgabe (eine kaputte Zeile darf die Kasse nicht verbiegen). Rein.
 */
export function anteileLesen(roh: unknown): Record<KasseTopf, number> {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  return anteileFehler(o) ? { ...KASSE_ANTEILE_VORGABE } : Object.fromEntries(KASSE_TOEPFE.map((k) => [k, Number(o[k])])) as Record<KasseTopf, number>;
}

/** Was an diesen Anteilen nicht stimmt — null = in Ordnung. Dieselbe Grenze für Register, Route und Oberfläche. Rein. */
export function anteileFehler(o: unknown): string | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return "Erwartet wird ein Objekt { b2b, menschen, privat, haus, reserve }.";
  const x = o as Record<string, unknown>;
  for (const k of Object.keys(x)) if (!(KASSE_TOEPFE as readonly string[]).includes(k)) return `Unbekannter Topf „${k}“.`;
  let summe = 0;
  for (const k of KASSE_TOEPFE) {
    const n = Number(x[k]);
    if (x[k] == null || !Number.isInteger(n) || n < 0 || n > 100) return `${bereichLabel(k)}: ganze Zahl von 0 bis 100.`;
    summe += n;
  }
  if (summe !== 100) return `Zusammen müssen es 100 % sein (jetzt ${summe} %).`;
  if (Number(x.menschen) < 5) return "Antworten an Menschen: mindestens 5 %.";
  return null;
}

// ── DIE ENTSCHEIDUNG ────────────────────────────────────────────────────────
export interface KasseEinstellung {
  /** aus = die Kasse misst nur und bremst nie. */
  an: boolean;
  /** Gesamtdeckel je Berliner Tag in Dollar. */
  tagUsd: number;
  anteile: Record<KasseTopf, number>;
  /** Nachhol-Bremse in Dollar je Stunde. */
  nachholUsd: number;
}

export interface KasseStand {
  /** Dollar-Cent je Bereich seit 0 Uhr Berlin. */
  heuteCents: Record<KasseBereich, number>;
  /** Dollar-Cent aller Bereiche in den letzten 60 Minuten. */
  stundeCents: number;
  /** Ende der letzten KI-Pause (ISO), solange die Nachhol-Bremse gilt — sonst null. */
  nachholSeit: string | null;
}

export type KasseArt = "gesamt" | "reserve" | "anteil" | "nachhol" | "nachhol_vorrang";
export type KasseUrteil =
  | { erlaubt: true; bereich: KasseBereich; ueberAnteil: boolean }
  | { erlaubt: false; bereich: KasseBereich; art: KasseArt; grund: string };

export const usdText = (cents: number): string =>
  `${(Math.max(0, Number(cents) || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

export function summeCents(s: Pick<KasseStand, "heuteCents">): number {
  return KASSE_BEREICHE.reduce((x, b) => x + (Number(s.heuteCents[b.key]) || 0), 0);
}

/** Wie viel Dollar-Cent ein Topf heute hat (Anteil × Gesamtdeckel). Rein. */
export function topfCents(e: Pick<KasseEinstellung, "tagUsd" | "anteile">, topf: KasseTopf): number {
  return Math.round(e.tagUsd * 100 * (Number(e.anteile[topf]) || 0)) / 100;
}

/** Gilt die Nachhol-Bremse? Ende der Pause innerhalb der letzten Stunden, Pause lang genug für einen Rückstand. Rein. */
export function nachholSeitAus(pause: { an?: boolean; seit?: string | null; aufgehobenAm?: string | null } | null | undefined, jetzt: Date = new Date()): string | null {
  if (!pause || pause.an || !pause.aufgehobenAm) return null;
  const ende = new Date(pause.aufgehobenAm).getTime();
  const anfang = pause.seit ? new Date(pause.seit).getTime() : NaN;
  if (!Number.isFinite(ende)) return null;
  if (jetzt.getTime() - ende >= KASSE_NACHHOL_STUNDEN * 3_600_000 || jetzt.getTime() < ende) return null;
  if (Number.isFinite(anfang) && ende - anfang < KASSE_NACHHOL_AB_PAUSE_MIN * 60_000) return null;
  return new Date(ende).toISOString();
}

/**
 * Darf dieser Dienst JETZT die KI rufen? Die Reihenfolge ist die Regel:
 *   0. Kasse aus → ja (nur messen).
 *   1. Nachhol-Bremse (6 Stunden nach einer Pause): alle zusammen höchstens nachholUsd je Stunde; in der
 *      ersten halben Stunde nur Antworten an Menschen, danach die anderen höchstens bis zur Hälfte.
 *   2. Gesamtdeckel erreicht → niemand mehr bis 0 Uhr.
 *   3. Antworten an Menschen → ja (auch über ihren Anteil: Reserve und was die anderen übrig lassen).
 *   4. Sind nur noch die Reserve übrig (Gesamt − Reserve erreicht) → nur noch Antworten an Menschen.
 *   5. Der eigene Anteil verbraucht → dieser Bereich wartet bis 0 Uhr.
 * Rein.
 */
export function kasseEntscheiden(e: KasseEinstellung, s: KasseStand, dienst: string, jetzt: Date = new Date()): KasseUrteil {
  const bereich = bereichFuer(dienst);
  const vorrang = bereich === "menschen";
  const eigen = Number(s.heuteCents[bereich]) || 0;
  const ueberAnteil = eigen >= topfCents(e, bereich);
  if (!e.an || !(e.tagUsd > 0)) return { erlaubt: true, bereich, ueberAnteil };
  const name = `„${bereichLabel(bereich)}“`;
  if (s.nachholSeit) {
    const grenze = Math.max(0, e.nachholUsd) * 100;
    const minuten = (jetzt.getTime() - new Date(s.nachholSeit).getTime()) / 60_000;
    if (s.stundeCents >= grenze) {
      return { erlaubt: false, bereich, art: "nachhol", grund: `Nachhol-Bremse nach der Pause: in der letzten Stunde ${usdText(s.stundeCents)} von ${usdText(grenze)} — es geht in wenigen Minuten weiter.` };
    }
    if (!vorrang && (minuten < KASSE_NACHHOL_NUR_ANTWORTEN_MIN || s.stundeCents >= grenze / 2)) {
      return { erlaubt: false, bereich, art: "nachhol_vorrang", grund: `Nach der Pause zuerst die Antworten an Menschen — ${name} wartet ein paar Minuten.` };
    }
  }
  const gesamt = e.tagUsd * 100;
  const summe = summeCents(s);
  if (summe >= gesamt) {
    return { erlaubt: false, bereich, art: "gesamt", grund: `Tagesdeckel erreicht (${usdText(summe)} von ${usdText(gesamt)}) — morgen um 0 Uhr geht es weiter.` };
  }
  if (vorrang) return { erlaubt: true, bereich, ueberAnteil };
  const ohneReserve = gesamt - topfCents(e, "reserve");
  if (summe >= ohneReserve) {
    return { erlaubt: false, bereich, art: "reserve", grund: `Der Rest des Tages (${usdText(gesamt - summe)}) gehört den Antworten an Menschen — ${name} macht morgen um 0 Uhr weiter.` };
  }
  if (ueberAnteil) {
    return { erlaubt: false, bereich, art: "anteil", grund: `Anteil ${name} für heute aufgebraucht (${usdText(eigen)} von ${usdText(topfCents(e, bereich))}) — morgen um 0 Uhr geht es weiter.` };
  }
  return { erlaubt: true, bereich, ueberAnteil: false };
}

// ── MODELL JE AUFGABE (E-262 D) ─────────────────────────────────────────────
export interface KiAufgabe {
  aufgabe: "postfach" | "whatsapp" | "aktion" | "einordnen" | "ratgeber";
  label: string;
  /** Texte an Kunden bleiben auf gpt-5.5 (Justin 29.10.) — im Chefbüro nicht umschaltbar. */
  kunde: boolean;
  vorgabe: string;
  /** Notfall-Weiche auf Render (je Aufgabe eine eigene — nicht mehr eine Variable für alle). */
  env: string;
  /** Umschaltbar im Chefbüro (Register-Schlüssel) — nur, wo kein Kunde den Text liest. */
  schluessel?: string;
  erlaubt?: readonly string[];
}

export const KI_AUFGABEN: readonly KiAufgabe[] = [
  { aufgabe: "postfach", label: "Postfach · Antwort", kunde: true, vorgabe: "gpt-5.5", env: "POSTMEISTER_MODELL" },
  { aufgabe: "whatsapp", label: "WhatsApp · Antwort", kunde: true, vorgabe: "gpt-5.5", env: "MARA_WA_MODELL" },
  { aufgabe: "aktion", label: "Mail-Aktion", kunde: true, vorgabe: "gpt-5.5", env: "MARA_AKTION_MODELL" },
  { aufgabe: "einordnen", label: "Postfach · Einordnen", kunde: false, vorgabe: "gpt-5.5", env: "POSTMEISTER_MODELL_KLEIN", schluessel: "ki_modell_einordnen", erlaubt: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"] },
  { aufgabe: "ratgeber", label: "Ratgeber (Artikel)", kunde: false, vorgabe: "gpt-5.5", env: "FIAON_RATGEBER_MODELL", schluessel: "ki_modell_ratgeber", erlaubt: ["gpt-5.5", "gpt-5.4"] },
];

/**
 * Das Modell einer Aufgabe: Notfall-Weiche (ENV) > Chefbüro (nur interne Aufgaben, nur erlaubte Modelle) > Vorgabe.
 * Rein — die Werte reicht der Aufrufer herein.
 */
export function modellWahl(a: KiAufgabe, gespeichert: string | null | undefined, env: string | null | undefined): string {
  const notfall = String(env ?? "").trim();
  if (notfall) return notfall;
  const w = String(gespeichert ?? "").trim();
  if (!a.kunde && w && a.erlaubt?.includes(w)) return w;
  return a.vorgabe;
}

// ── PROMPT-CACHING (E-262 B) ────────────────────────────────────────────────
// Warum der Werkzeug-Satz in den Schlüssel gehört: OpenAI liest einen Textanfang nur dann aus dem Cache, wenn er
// Zeichen für Zeichen gleich ist — und die Werkzeugliste steht VOR dem Auftrag. Zwei Kunden mit verschiedenen
// Werkzeugen (Lage, Stufe) teilen sich nichts; zwei mit denselben teilen Werkzeuge, Hauswissen und Persona.

/** Ein kurzer, stabiler Fingerabdruck der Werkzeugnamen (FNV-1a, Basis 36) — gleiche Werkzeuge, gleicher Wert. Rein. */
export function werkzeugSignatur(tools: readonly unknown[] | null | undefined): string {
  if (!tools?.length) return "";
  const namen = tools.map((t: any) => String(t?.function?.name ?? t?.name ?? t?.type ?? "")).join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < namen.length; i++) { h ^= namen.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `w${h.toString(36)}`;
}

/**
 * Der Schlüssel, unter dem OpenAI gleiche Textanfänge desselben Dienstes zusammenlegt (prompt_cache_key).
 * Kurz und ohne Personenbezug. Rein.
 */
export function cacheSchluessel(dienst: string, teil?: string | null): string {
  const t = String(teil ?? "").trim().replace(/[^a-z0-9_-]+/gi, "").slice(0, 32);
  return `fiaon-${String(dienst).replace(/[^a-z0-9_-]+/gi, "").slice(0, 40)}${t ? `-${t}` : ""}`;
}
