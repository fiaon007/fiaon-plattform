// ═══════════════════════════════════════════════════════════════════════════
// KI-PAUSE BEI OPENAI-ABRECHNUNGSFEHLER (27.09.2026, E-246)
//
// Justin: „Wenn OpenAI nicht abbuchen kann, dann soll alles, was über OpenAI
// läuft, pausieren. Nichts Wirres oder Falsches schicken, sondern einfach
// Pause, bis ich es wieder aktiviere."
//
// Vorher (bis E-245) gab es keinen gemeinsamen Zustand. Am 24.09. meldete
// OpenAI „You have no credits remaining" — und jede Stelle reagierte anders:
// Mara schickte nach 6 Minuten einen Rückfallsatz an den Kunden, der
// Postmeister schrieb je Versuch einen Aktenvermerk, Kontoauszüge wurden als
// „unlesbar" gespeichert und der Kunde gebeten, neu hochzuladen, die
// Mara-Aktion legte Menschen 24 h in Ruhe, Transkripte wurden „fehlgeschlagen"
// und nie nachgeholt.
//
// DIESE DATEI IST DIE EINZIGE WAHRHEIT:
//   · Zustand: fiaon_settings.ki_pause (JSON als Text), 10 s zwischengespeichert,
//     im eigenen Prozess beim Setzen sofort umgeschaltet.
//   · openaiFetch(dienst, pfad, init): JEDER OpenAI-Aufruf geht hier durch.
//     Pausiert → kein Netz, sofort KiPausiertFehler. Antwortet OpenAI mit
//     einem Abrechnungsfehler → pausieren (einmal Alarm) und KiPausiertFehler —
//     schon der ERSTE Aufruf sieht also dasselbe sichere Verhalten.
//   · kiNetzAbsichern(): Netz unter allem (server/index.ts). Ein vergessener
//     oder künftiger fetch an api.openai.com läuft trotzdem durch dieselbe Wand.
//   · Prüfstand scripts/pruef-ki-pause.ts: Quelltext-Wand — keine OpenAI-URL
//     außerhalb dieser Datei.
//
// WO AUTOMATISCH PAUSIERT WIRD (Nachprüfung 27.09.): nur im Produktionsdienst
// (Render: NODE_ENV=production, RENDER=true, RENDER_SERVICE_ID gesetzt). Ein
// lokales Skript oder ein Dev-Server — auch gegen die Produktions-DB, mit einem
// alten oder fremden Schlüssel — pausiert nur sich selbst: kein DB-Schreiben,
// kein Alarm. Der Fingerabdruck des Schlüssels (letzte 6 Zeichen) steht im
// Zustand und im Alarm.
//
// WAS PAUSIERT: alles an api.openai.com. WAS NICHT: Ratenlimit (429 ohne
// Abrechnungsmerkmal), 5xx, 400, Zeitgrenze, Netzfehler — das sind
// vorübergehende Störungen, dafür haben die Aufrufer ihre Wiederholungen.
// ═══════════════════════════════════════════════════════════════════════════
// E-279 (03.10.2026): DIE KI-WEICHE. OpenAI hat am 03.10. das Konto deaktiviert — seitdem trägt Claude.
// Jeder Aufruf an /chat/completions und /responses geht weiter durch openaiFetch, wird aber übersetzt
// (fiaon-ki-claude.ts) und an Claude geschickt, sobald ANTHROPIC_API_KEY gesetzt ist (KI_ANBIETER schaltet).
// Die Pause gilt JE ANBIETER (zustand.anbieter): eine OpenAI-Pause hält nur noch, was bei OpenAI bleibt
// (Whisper/Transkripte), nicht Mara.
import { sqlPool } from "./db-pool";
import {
  aktiverAnbieter, claudeKannPfad, claudeModellFuer, chatNachClaude, alsAnweisung, claudeNachChat,
  responsesNachChat, chatNachResponses, chatAlsSse, claudeFehlerArt, alsOpenAiFehler, type KiAnbieter,
} from "./fiaon-ki-claude";
export { aktiverAnbieter, type KiAnbieter } from "./fiaon-ki-claude";

export const OPENAI_HOST = "api.openai.com";
export const OPENAI_V1 = "https://api.openai.com/v1";
export const ANTHROPIC_HOST = "api.anthropic.com";
export const ANTHROPIC_V1 = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";
export const KI_PAUSE_SCHLUESSEL = "ki_pause";
/** Der Satz, den Justin im Alarm liest (Auftrag 27.09.2026). */
export const KI_PAUSE_ALARM_TEXT =
  "OpenAI konnte nicht abbuchen — alle KI-Funktionen pausiert. Nach dem Aufladen im Chefbüro ‚KI wieder aktivieren' drücken.";
/** Vorschlag des Behebers „kunde" (27.09.): Mara sieht Handantworten aus Gmail nicht. */
export const KI_PAUSE_MAIL_HINWEIS =
  "Mails an support@/welcome@ in der Pause: entweder direkt im Postfach support@/welcome@ von Hand beantworten UND in Gmail archivieren oder liegen lassen — Mara holt nach. Antworten aus einem anderen Postfach, per Telefon oder WhatsApp sieht Mara nicht: dann die Mail archivieren.";
/** Wo der Knopf steht — ein Band im Kopf jeder Chefbüro-Seite, dazu die Karte im Mara-Steuerpult. */
export const KI_PAUSE_KLICKWEG = "/chef/s/mara";

export type KiPauseArt = "abrechnung" | "zugang" | "hand";

export interface KiPauseEreignis { am: string; was: "pausiert" | "aktiviert" | "probe_gescheitert"; von: string; grund: string | null }

export interface KiPauseZustand {
  an: boolean;
  art: KiPauseArt | null;
  /** Klartext für Menschen („OpenAI meldet: kein Guthaben"). */
  grund: string | null;
  /** Rohmeldung von OpenAI, gekürzt. */
  fehler: string | null;
  /** Welcher Dienst den ersten Fehler bekam. */
  dienst: string | null;
  /** Fingerabdruck des Schlüssels, mit dem der Fehler kam („…ab12cd“, letzte 6 Zeichen). */
  schluessel?: string | null;
  /** E-279: Wessen Pause? Fehlt (alte Zeilen) = OpenAI. Sie gilt nur für Aufrufe an DIESEN Anbieter. */
  anbieter?: KiAnbieter | null;
  /** Nur in diesem Prozess pausiert (kein Produktionsdienst) — nie gespeichert. */
  nurLokal?: boolean;
  seit: string | null;
  von: string | null;
  aufgehobenAm: string | null;
  aufgehobenVon: string | null;
  /** Die letzten Ereignisse — neueste zuerst, höchstens 20. */
  verlauf: KiPauseEreignis[];
}

const LEER: KiPauseZustand = {
  an: false, art: null, grund: null, fehler: null, dienst: null, schluessel: null, seit: null, von: null,
  aufgehobenAm: null, aufgehobenVon: null, verlauf: [],
};

// ── Wer darf automatisch pausieren? Nur der Produktionsdienst. ───────────
let produktionSimuliert: boolean | null = null;
/** Nur für Prüfstände: die Produktionsbedingung vorgeben (null = echte Umgebung). */
export function kiPauseProduktionSimulieren(an: boolean | null): void { produktionSimuliert = an; }
/**
 * Ist DIESER Prozess der Produktionsdienst? Render setzt RENDER=true und
 * RENDER_SERVICE_ID in jedem Dienst (dieselbe Quelle wie RENDER_GIT_COMMIT in
 * portal-auth.ts), dazu NODE_ENV=production. Alles andere — lokale Skripte,
 * `npm run dev`, Prüfstände — pausiert automatisch nur sich selbst.
 */
export function istProduktionsdienst(): boolean {
  if (produktionSimuliert !== null) return produktionSimuliert;
  return process.env.NODE_ENV === "production" && process.env.RENDER === "true" && !!process.env.RENDER_SERVICE_ID;
}

/** „…ab12cd" — die letzten 6 Zeichen, nie mehr. */
export function schluesselFingerabdruck(schluessel: string | null | undefined): string | null {
  const k = String(schluessel ?? "").replace(/^Bearer\s+/i, "").trim();
  return k.length >= 6 ? `…${k.slice(-6)}` : null;
}

// ── Der Fehler, an dem jeder Aufrufer „liegen lassen" erkennt ─────────────
export class KiPausiertFehler extends Error {
  readonly kiPause = true;
  constructor(readonly dienst: string, readonly art: KiPauseArt | null = null, readonly anbieter: KiAnbieter = "openai") {
    super(kiPauseMeldung(art, anbieter));
    this.name = "KiPausiertFehler";
  }
}

/** Die Meldung, die interaktive Stellen zeigen. Beginnt IMMER mit „KI pausiert" (Aufrufer prüfen darauf). */
export function kiPauseMeldung(art: KiPauseArt | null, anbieter: KiAnbieter | null = "openai"): string {
  const wer = anbieterName(anbieter);
  if (art === "hand") return "KI pausiert — im Chefbüro von Hand angehalten. Justin aktiviert sie dort wieder.";
  if (art === "zugang") return `KI pausiert — ${wer} lehnt den Zugang ab (Schlüssel oder Konto). Justin aktiviert sie im Chefbüro wieder.`;
  return `KI pausiert — ${wer} konnte nicht abbuchen (Guthaben). Justin aktiviert sie im Chefbüro wieder.`;
}

/** „OpenAI“ oder „Claude (Anthropic)“ — für Meldungen. */
export function anbieterName(a: KiAnbieter | null | undefined): string {
  return a === "claude" ? "Claude (Anthropic)" : "OpenAI";
}

/** E-279: Gilt diese Pause für Aufrufe an diesen Anbieter? Alte Zeilen ohne Anbieter sind OpenAI. */
export function pauseGilt(z: KiPauseZustand | null | undefined, anbieter: KiAnbieter = aktiverAnbieter()): boolean {
  return !!z?.an && ((z.anbieter ?? "openai") === anbieter || z.art === "hand");
}

/**
 * Ist das ein Pausenfehler? Nimmt Fehlerobjekte UND Texte (z. B. `kiFehler`
 * aus Maras Denkrunde oder eine gespeicherte Fehlerspalte).
 */
export function istKiPause(e: unknown, tiefe = 0): boolean {
  if (!e) return false;
  if (e instanceof KiPausiertFehler) return true;
  if (typeof e === "object" && (e as any).kiPause === true) return true;
  const t = typeof e === "string" ? e : String((e as any)?.message ?? "");
  if (/^KI pausiert\b/.test(t.trim())) return true;
  // Das OpenAI-SDK verpackt einen Fehler aus fetch als APIConnectionError — die Ursache steht in `cause`.
  return tiefe < 3 && typeof e === "object" && !!(e as any).cause && istKiPause((e as any).cause, tiefe + 1);
}

// ── Zustand lesen (10 s zwischengespeichert) ──────────────────────────────
let zwischen: { wert: KiPauseZustand; bis: number } | null = null;
/**
 * Hat DIESER Prozess eine Pause erkannt, die er (noch) nicht speichern konnte?
 * Dann gilt sie trotzdem — eine gestörte Datenbank darf die Pause nicht aufheben.
 * lokalNurHier: automatische Pause außerhalb des Produktionsdienstes — gilt nur
 * hier und wird NIE gespeichert. alarmOffen: die Pause des Produktionsdienstes
 * ließ sich nicht speichern, also kam auch kein Alarm — beim Nachtragen folgt er.
 */
let lokalePause: KiPauseZustand | null = null;
let lokalNurHier = false;
let alarmOffen = false;

function lesen(roh: unknown): KiPauseZustand {
  if (!roh) return { ...LEER };
  try {
    const j = typeof roh === "string" ? JSON.parse(roh) : roh;
    return {
      ...LEER, ...j,
      an: j?.an === true,
      verlauf: Array.isArray(j?.verlauf) ? j.verlauf.slice(0, 20) : [],
    };
  } catch {
    return { ...LEER };
  }
}

/**
 * E-279: Der Zustand, wie ihn der Rest des Systems sieht — die Pause des TRAGENDEN Anbieters (oder eine von
 * Hand). Eine OpenAI-Pause, während Claude trägt, gilt hier als „nicht pausiert“: Sie hält nur noch, was bei
 * OpenAI bleibt (Whisper), und das prüft kiBereit am rohen Zustand. Steht in `nebenPause`.
 */
export async function kiPauseLesen(frisch = false): Promise<KiPauseZustand & { nebenPause?: { anbieter: KiAnbieter; art: KiPauseArt | null; seit: string | null } | null }> {
  const z = await kiPauseRohLesen(frisch);
  if (!z.an || pauseGilt(z, aktiverAnbieter())) return z;
  return { ...z, an: false, nebenPause: { anbieter: (z.anbieter ?? "openai") as KiAnbieter, art: z.art, seit: z.seit } };
}

/** Der gespeicherte Zustand, ungefiltert — für Pausieren, Aktivieren und kiBereit. */
export async function kiPauseRohLesen(frisch = false): Promise<KiPauseZustand> {
  if (!frisch && zwischen && zwischen.bis > Date.now()) return lokalePause ?? zwischen.wert;
  try {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${KI_PAUSE_SCHLUESSEL} LIMIT 1`) as any[];
    const wert = lesen(r?.value);
    zwischen = { wert, bis: Date.now() + 10_000 };
    if (lokalePause && lokalNurHier) return wert.an ? wert : lokalePause; // nie speichern
    if (lokalePause && !wert.an) {
      // Hat Justin inzwischen (in einem anderen Prozess) aktiviert, gilt das — die alte lokale Pause fällt weg.
      if (wert.aufgehobenAm && lokalePause.seit && wert.aufgehobenAm > lokalePause.seit) {
        lokalePause = null; alarmOffen = false;
        return wert;
      }
      // Die lokale Pause nachtragen — sie gilt, bis Justin sie aufhebt.
      const z = lokalePause;
      const neu = await pauseSchreiben(z).catch(() => null);
      if (neu !== null) {
        lokalePause = null;
        zwischen = null;
        if (neu && alarmOffen && z.art !== "hand") await alarm(z).catch((e) => console.error("[KI-PAUSE] Alarm (nachgeholt):", e));
        alarmOffen = false;
        return neu ? z : await kiPauseRohLesen(true);
      }
      return z;
    }
    if (wert.an) { lokalePause = null; alarmOffen = false; }
    return wert;
  } catch (e) {
    console.error("[KI-PAUSE] Zustand nicht lesbar:", String(e).slice(0, 160));
    // Ohne Datenbank: der letzte bekannte Stand. Kein Stand → nicht pausiert
    // (eine gestörte Datenbank soll nicht die ganze KI abstellen). 10 s merken —
    // sonst fragt bei einer DB-Störung jeder OpenAI-Aufruf und jeder Takt neu.
    const wert = lokalePause ?? zwischen?.wert ?? { ...LEER };
    zwischen = { wert, bis: Date.now() + 10_000 };
    return wert;
  }
}

/** Ist die KI des TRAGENDEN Anbieters (oder von Hand alles) pausiert? E-279: eine OpenAI-Pause hält Claude nicht an. */
export async function kiPausiert(anbieter: KiAnbieter = aktiverAnbieter()): Promise<boolean> {
  return pauseGilt(await kiPauseRohLesen(), anbieter);
}

/** Vor jedem KI-Aufruf: wirft KiPausiertFehler, wenn DIESER Anbieter pausiert ist. */
export async function kiBereit(dienst: string, anbieter: KiAnbieter = aktiverAnbieter()): Promise<void> {
  const z = await kiPauseRohLesen();
  if (pauseGilt(z, anbieter)) throw new KiPausiertFehler(dienst, z.art, (z.anbieter ?? "openai") as KiAnbieter);
}

async function speichern(z: KiPauseZustand): Promise<void> {
  const v = JSON.stringify(z);
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${KI_PAUSE_SCHLUESSEL}, ${v}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${v}, updated_at = NOW()`;
  zwischen = { wert: z, bis: Date.now() + 10_000 };
}

// ── Die Regel: Abrechnung, Zugang oder vorübergehend? ─────────────────────
const ABRECHNUNG_CODES = new Set([
  "insufficient_quota", "credit_balance_exhausted", "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded", "organization_usage_limit_exceeded", "billing_hard_limit_reached",
  "billing_not_active",
]);
/**
 * Nur auf err.message des OpenAI-Fehlerobjekts, nie auf den Rohtext. KEIN nacktes
 * „billing": Ratenlimit-Meldungen kleiner Konto-Stufen enthalten den Link
 * platform.openai.com/account/billing („… adding a payment method …") — das
 * ist eine Drosselung von Sekunden, keine fehlende Abbuchung (Nachprüfung 27.09.).
 */
const ABRECHNUNG_TEXT = /no credits remaining|credit balance|exceeded your current quota|spend limit|billing hard limit|billing is not active|reached your (monthly )?usage limit/i;
/** Codes, bei denen OpenAI den Schlüssel oder das ganze Konto ablehnt (nicht nur einen Dienst). */
const ZUGANG_CODES = new Set([
  "invalid_api_key", "account_deactivated", "organization_deactivated", "no_organization",
  "unsupported_country_region_territory", "api_key_revoked", "invalid_organization",
]);
const ZUGANG_TEXT = /incorrect api key|invalid api key|api key .*(revoked|disabled|deleted)|account (has been )?(deactivated|disabled|suspended)|organization (has been )?(deactivated|disabled|suspended)|must be a member of an organization|not a member of an organization|country, region, or territory not supported/i;

/**
 * Aus Status und Antwort: „abrechnung" | „zugang" | null.
 *
 * Gemessen am 24.09.2026 (fiaon_ki_nutzung, 22 Zeilen):
 *   HTTP 429 {"message":"You have no credits remaining. Add credits …","type":"insufficient_quota"}
 * Dazu die Codes der OpenAI-Doku (credit_balance_exhausted, *_spend_limit_exceeded,
 * organization_usage_limit_exceeded) und aus der Community (billing_hard_limit_reached).
 *
 *   · Nur ein OpenAI-Fehlerobjekt ({"error":{…}}) kann pausieren. HTML oder Text
 *     (Cloudflare/Proxy „Attention Required", 429 vom Rand) → null.
 *   · Abrechnungs-Code/-Typ → abrechnung (auch bei 401/403, „billing_not_active").
 *   · 429 rate_limit_exceeded / slow_down → null, egal was im Text steht.
 *   · 429 mit eindeutigem Abrechnungstext in err.message → abrechnung.
 *   · 401 / 403 → zugang NUR, wenn Code oder Meldung auf Schlüssel oder Konto
 *     zeigt (invalid_api_key, account_deactivated, …). Fehlende Modellrechte
 *     (model_not_found), fehlende Schlüsselrechte (restricted key), falsche
 *     Organisation im Kopf (mismatched_organization) → null: nur dieser eine
 *     Aufruf scheitert, nicht das Konto.
 *   · 402 mit Fehlerobjekt → abrechnung.
 *   · alles andere (5xx, 400) → null, keine Pause.
 */
export function abrechnungsFehler(status: number, body: unknown): KiPauseArt | null {
  let j: any = body;
  if (typeof body === "string") { try { j = JSON.parse(body); } catch { j = null; } }
  const err = j && typeof j === "object" && j.error && typeof j.error === "object" ? j.error : null;
  if (!err) return null; // kein OpenAI-Fehlerobjekt → nie pausieren
  const typ = String(err.type ?? "");
  const code = String(err.code ?? "");
  const meldung = String(err.message ?? "");
  if (status !== 429 && status !== 402 && status !== 401 && status !== 403) return null;
  if (typ === "insufficient_quota" || ABRECHNUNG_CODES.has(code) || ABRECHNUNG_CODES.has(typ)) return "abrechnung";
  if (status === 429) {
    if (code === "rate_limit_exceeded" || code === "slow_down") return null;
    return ABRECHNUNG_TEXT.test(meldung) ? "abrechnung" : null;
  }
  if (status === 402) return "abrechnung";
  // 401 / 403
  if (code === "model_not_found" || /does not have access to model|model .* does not exist/i.test(meldung)) return null;
  if (ZUGANG_CODES.has(code) || ZUGANG_TEXT.test(meldung)) return "zugang";
  return null;
}

function grundAus(art: KiPauseArt, fehler: string, anbieter: KiAnbieter = "openai"): string {
  const wer = anbieterName(anbieter);
  if (art === "hand") return fehler || "Von Hand angehalten.";
  if (art === "zugang") return `${wer} lehnt den Zugang ab (Schlüssel oder Konto): ${fehler.slice(0, 160)}`;
  if (/no credits|credit balance/i.test(fehler)) return `${wer} meldet: kein Guthaben mehr.`;
  if (/spend limit|usage limit|hard_limit/i.test(fehler)) return `${wer} meldet: Ausgabengrenze erreicht.`;
  return `${wer} konnte nicht abbuchen.`;
}

// ── Pausieren (höchstens einmal, genau ein Alarm) ─────────────────────────
/**
 * Die Pause in die Zeile schreiben — nur, wenn dort noch keine steht. So gibt
 * es auch bei zwei gleichzeitigen Fehlern (zwei Prozesse) genau einen Alarm.
 * true = diese Pause steht jetzt da, false = es stand schon eine.
 */
async function pauseSchreiben(z: KiPauseZustand): Promise<boolean> {
  const v = JSON.stringify(z);
  const r = (await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${KI_PAUSE_SCHLUESSEL}, ${v}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${v}, updated_at = NOW()
     WHERE fiaon_settings.value NOT LIKE '{"an":true%'
    RETURNING key`) as any[];
  if (r.length > 0) zwischen = { wert: z, bis: Date.now() + 10_000 };
  return r.length > 0;
}

export async function pausieren(ein: { art: KiPauseArt; fehler: string; dienst: string; von: string; schluessel?: string | null; anbieter?: KiAnbieter }): Promise<{ neu: boolean; zustand: KiPauseZustand }> {
  const jetzt = new Date().toISOString();
  const vorher = await kiPauseRohLesen(true);
  const anbieter: KiAnbieter = ein.anbieter ?? (ein.art === "hand" ? aktiverAnbieter() : "openai");
  // E-279: Es gibt EINE Pausenzeile. Steht dort schon eine, bleibt sie — außer die neue betrifft den TRAGENDEN
  // Anbieter und die alte einen anderen (z. B. alte OpenAI-Pause, jetzt bucht Claude nicht ab): dann ersetzt
  // die neue sie, sonst liefe Mara gegen eine Wand ohne Pause und ohne Alarm.
  // Eine Pause von Hand (Chefbüro) ersetzt jede automatische.
  const ersetzen = vorher.an && vorher.art !== "hand"
    && (ein.art === "hand" || ((vorher.anbieter ?? "openai") !== anbieter && anbieter === aktiverAnbieter()));
  if (vorher.an && !ersetzen) return { neu: false, zustand: vorher };
  const grund = grundAus(ein.art, ein.fehler, anbieter);
  const fingerabdruck = ein.art === "hand" ? null
    : schluesselFingerabdruck(ein.schluessel ?? (anbieter === "claude" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY));
  const z: KiPauseZustand = {
    an: true, art: ein.art, grund, fehler: ein.fehler.slice(0, 400), dienst: ein.dienst, schluessel: fingerabdruck, anbieter,
    seit: jetzt, von: ein.von,
    aufgehobenAm: null, aufgehobenVon: null,
    verlauf: [{ am: jetzt, was: "pausiert" as const, von: ein.von, grund }, ...vorher.verlauf].slice(0, 20),
  };
  // Nachprüfung 27.09.: Automatisch pausiert nur der Produktionsdienst. Ein
  // lokales Skript gegen die Produktions-DB mit einem alten oder fremden
  // Schlüssel hielt sonst Mara, Postfach und Auswertungen für alle an — mit
  // falschem Alarm an Justin. Hier: nur dieser Prozess, nichts gespeichert.
  if (ein.art !== "hand" && !istProduktionsdienst()) {
    const lokal: KiPauseZustand = { ...z, nurLokal: true, verlauf: [] };
    lokalePause = lokal;
    lokalNurHier = true;
    zwischen = { wert: lokal, bis: Date.now() + 10_000 };
    console.error(`[KI-PAUSE] Nur in DIESEM Prozess pausiert (kein Produktionsdienst — nichts gespeichert, kein Alarm; Schlüssel ${fingerabdruck ?? "—"}, ${ein.dienst}): ${ein.fehler.slice(0, 200)}`);
    return { neu: true, zustand: lokal };
  }
  lokalePause = z;
  lokalNurHier = false;
  zwischen = { wert: z, bis: Date.now() + 10_000 };
  let gespeichert = false;
  try {
    // E-279: Ersetzen schreibt über die alte Pause hinweg (pauseSchreiben schreibt nur in eine leere Zeile).
    const neu = ersetzen ? (await speichern(z), true) : await pauseSchreiben(z);
    lokalePause = null;
    if (!neu) {
      zwischen = null;
      return { neu: false, zustand: await kiPauseRohLesen(true) };
    }
    gespeichert = true;
  } catch (e) {
    console.error("[KI-PAUSE] Pause nicht gespeichert (gilt in diesem Prozess trotzdem, Alarm folgt beim Nachtragen):", String(e).slice(0, 160));
  }
  console.error(`[KI-PAUSE] PAUSIERT (${ein.art}, erster Fehler bei ${ein.dienst}, von ${ein.von}, Schlüssel ${fingerabdruck ?? "—"}): ${ein.fehler.slice(0, 200)}`);
  try {
    const { nutzungMerken } = await import("./fiaon-postmeister-schema");
    await nutzungMerken({ dienst: "ki-pause", modell: "-", dauerMs: 0, ok: false, fehler: `pausiert (${ein.art}, ${ein.dienst}): ${ein.fehler}`.slice(0, 200) });
  } catch { /* nur Protokoll */ }
  if (ein.art !== "hand") {
    // Ohne gespeicherte Pause würde auch der Alarm an der DB scheitern — er folgt, sobald kiPauseLesen sie nachträgt.
    if (gespeichert) await alarm(z).catch((e) => console.error("[KI-PAUSE] Alarm:", e));
    else alarmOffen = true;
  }
  return { neu: true, zustand: z };
}

async function alarm(z: KiPauseZustand): Promise<void> {
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const zeit = z.seit ? new Date(z.seit).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const claude = z.anbieter === "claude";
  const wer = anbieterName(z.anbieter);
  // E-279: Pausiert ein Anbieter, der die KI gerade NICHT trägt (OpenAI, während Claude trägt), steht nur Whisper.
  if ((z.anbieter ?? "openai") !== aktiverAnbieter()) {
    await auftragFuerKunden({
      personId: null, ref: null, anBetreiber: true, dringend: false,
      titel: `${wer} lehnt ab — nur Telefon-Transkripte warten (Mara läuft über ${anbieterName(aktiverAnbieter())})`,
      text: `Seit ${zeit} · ${wer} meldet: ${String(z.fehler || "").slice(0, 240)}\n\nBetroffen sind nur die Telefon-Transkripte (Sprache zu Text gibt es bei Claude nicht). Alles andere — Mara, Postfach, Auswertungen — läuft über ${anbieterName(aktiverAnbieter())}.`,
      quelle: "ki-pause", bereich: "technik", link: KI_PAUSE_KLICKWEG, schluessel: `ki-pause-${z.seit}`, autorName: "System",
    });
    return;
  }
  const titel = z.art === "zugang"
    ? `${wer} lehnt den Zugang ab — alle KI-Funktionen pausiert`
    : `${wer} konnte nicht abbuchen — alle KI-Funktionen pausiert`;
  const text = [
    z.art === "zugang"
      ? `${wer} lehnt den Schlüssel oder das Konto ab — alle KI-Funktionen pausiert. Nach der Klärung im Chefbüro ‚KI wieder aktivieren' drücken.`
      : claude ? "Claude (Anthropic) konnte nicht abbuchen — alle KI-Funktionen pausiert. Nach dem Aufladen im Chefbüro ‚KI wieder aktivieren' drücken." : KI_PAUSE_ALARM_TEXT,
    "",
    `Seit ${zeit} · erster Fehler bei: ${z.dienst} · Schlüssel ${z.schluessel ?? "—"} · ${wer} meldet: ${String(z.fehler || "").slice(0, 240)}`,
    "",
    "Was steht: Mara auf WhatsApp und im Postfach, Mara-Aktion und Mara-Aufträge, Kontoauszug- und SCHUFA-Auswertung, Texterkennung, Transkripte, Ratgeber, Firmen-Radar, Copilot und alle KI-Knöpfe. Nichts davon schickt in der Pause etwas an Kunden — auch keinen Ersatzsatz.",
    "Was weiterläuft: alles ohne KI — Betreuer schreiben selbst, WA-Zentrale, Mailwerk, Rückholung, Auskunft-Verkauf (Vorlagen).",
    KI_PAUSE_MAIL_HINWEIS,
    "",
    claude
      ? (z.art === "zugang"
        ? "So geht es weiter: Schlüssel unter platform.claude.com → API-Schlüssel prüfen (bei Render: ANTHROPIC_API_KEY), dann Chefbüro → Band oben ‚KI wieder aktivieren' (oder Mara-Steuerpult /chef/s/mara)."
        : "So geht es weiter: platform.claude.com → Guthaben (Billing) aufladen oder die Ausgabengrenze anheben, dann Chefbüro → Band oben ‚KI wieder aktivieren' (oder Mara-Steuerpult /chef/s/mara). Vor dem Aktivieren macht das System einen Probe-Aufruf; liegen Gebliebenes holen die normalen Läufe danach von selbst nach.")
      : z.art === "zugang"
      ? "So geht es weiter: Schlüssel/Konto unter platform.openai.com prüfen, dann Chefbüro → Band oben ‚KI wieder aktivieren' (oder Mara-Steuerpult /chef/s/mara)."
      : "So geht es weiter: platform.openai.com → Settings → Billing → Guthaben aufladen, dann Chefbüro → Band oben ‚KI wieder aktivieren' (oder Mara-Steuerpult /chef/s/mara). Vor dem Aktivieren macht das System einen Probe-Aufruf; liegen Gebliebenes holen die normalen Läufe danach von selbst nach.",
  ].join("\n");
  await auftragFuerKunden({
    personId: null, ref: null, anBetreiber: true, dringend: true,
    titel, text, quelle: "ki-pause", bereich: "technik", link: KI_PAUSE_KLICKWEG,
    schluessel: `ki-pause-${z.seit}`, autorName: "System",
  });
}

// ── Wieder aktivieren (mit Probe) ─────────────────────────────────────────
export async function aktivieren(von: string, opt: { probe?: boolean; nachholen?: boolean } = {}): Promise<{ ok: boolean; zustand: KiPauseZustand; hinweis?: string; fehler?: string }> {
  const vorher = await kiPauseRohLesen(true);
  // Nicht pausiert (Route direkt aufgerufen, zwei Klicks gekreuzt): nichts
  // ändern. Früher setzte eine gescheiterte Probe hier an=true — eine Pause
  // ohne Alarm, ohne seit und ohne Dienst (Nachprüfung 27.09.). Bucht OpenAI
  // wirklich nicht ab, pausiert der nächste echte Aufruf regulär mit Alarm.
  if (!vorher.an) return { ok: true, zustand: vorher, hinweis: "Die KI war nicht pausiert — nichts geändert." };
  // Eine Pause nur dieses Prozesses (kein Produktionsdienst) stand nie in der DB — dort auch nichts schreiben.
  if (lokalNurHier && lokalePause && vorher === lokalePause) {
    lokalePause = null; lokalNurHier = false; zwischen = null;
    return { ok: true, zustand: await kiPauseRohLesen(true), hinweis: "Nur in diesem Prozess pausiert gewesen — aufgehoben, nichts gespeichert." };
  }
  let hinweis: string | undefined;
  // E-279: geprüft wird der Anbieter DIESER Pause (eine OpenAI-Pause mit OpenAI, eine Claude-Pause mit Claude).
  const pauseAnbieter: KiAnbieter = vorher.art === "hand" ? aktiverAnbieter() : (vorher.anbieter ?? "openai") as KiAnbieter;
  const probeSchluessel = pauseAnbieter === "claude" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (opt.probe !== false && probeSchluessel) {
    const p = pauseAnbieter === "claude" ? await claudeProbe() : await probe();
    if (p.art) {
      const jetzt = new Date().toISOString();
      const z: KiPauseZustand = {
        ...vorher, an: true,
        verlauf: [{ am: jetzt, was: "probe_gescheitert" as const, von, grund: p.fehler.slice(0, 200) }, ...vorher.verlauf].slice(0, 20),
      };
      await speichern(z).catch(() => {});
      return {
        ok: false, zustand: z,
        fehler: p.art === "abrechnung"
          ? `${anbieterName(pauseAnbieter)} bucht noch nicht ab — die Pause bleibt. (${p.fehler.slice(0, 160)})`
          : `${anbieterName(pauseAnbieter)} lehnt den Zugang noch ab — die Pause bleibt. (${p.fehler.slice(0, 160)})`,
      };
    }
    if (!p.ok) hinweis = `Probe-Aufruf unklar (${p.fehler.slice(0, 120)}) — trotzdem aktiviert. Kommt wieder ein Abrechnungsfehler, pausiert sie sofort erneut.`;
  }
  const jetzt = new Date().toISOString();
  const z: KiPauseZustand = {
    ...vorher, an: false, aufgehobenAm: jetzt, aufgehobenVon: von,
    verlauf: [{ am: jetzt, was: "aktiviert" as const, von, grund: vorher.grund }, ...vorher.verlauf].slice(0, 20),
  };
  lokalePause = null; lokalNurHier = false; alarmOffen = false;
  await speichern(z);
  console.log(`[KI-PAUSE] AKTIVIERT von ${von} (Pause seit ${vorher.seit ?? "—"}).`);
  if (opt.nachholen !== false) {
    // Nicht warten: Die Läufe holen im Hintergrund nach, der Knopf antwortet sofort.
    void nachDerPause(vorher).catch((e) => console.error("[KI-PAUSE] Nachholen:", e));
  }
  return { ok: true, zustand: z, hinweis };
}

/** Ein winziger echter Aufruf — kostet Bruchteile eines Cents. */
async function probe(): Promise<{ ok: boolean; art: KiPauseArt | null; fehler: string }> {
  try {
    const res = await rohFetch()(`${OPENAI_V1}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", max_tokens: 1, messages: [{ role: "user", content: "ok" }] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return { ok: true, art: null, fehler: "" };
    const t = await res.text().catch(() => "");
    return { ok: false, art: abrechnungsFehler(res.status, t), fehler: `HTTP ${res.status}: ${t.slice(0, 240)}` };
  } catch (e: any) {
    return { ok: false, art: null, fehler: String(e?.message || e) };
  }
}

/**
 * Nach dem Aktivieren: die Läufe anstoßen, die sonst erst im nächsten Takt
 * kämen. Jeder Lauf findet seine liegen gebliebene Arbeit selbst — hier wird
 * nichts doppelt gebaut. Scheitert einer, laufen die anderen trotzdem.
 *
 * Nebenläufig sicher (Nachprüfung 27.09.): Kontoauszug, SCHUFA und Transkript
 * gehen durch DIESELBE Laufsperre wie ihre Takte (laufMitHistorie mit dem Namen
 * des Takts, DB-seitig über fiaon_lauf_historie) — läuft der Takt gerade, lässt
 * dieser Schritt ihn machen. Dazu sperrt jede Nachhol-Funktion prozessweit und
 * prüft je Fall direkt vor dem Aufruf, ob er noch an der Pause hängt.
 */
export async function nachDerPause(pause: KiPauseZustand): Promise<void> {
  const schritt = async (name: string, f: () => Promise<unknown>) => {
    try { await f(); } catch (e) { console.error(`[KI-PAUSE] Nachholen ${name}:`, String(e).slice(0, 200)); }
  };
  const gesperrt = async (takt: string, f: () => Promise<unknown>) => {
    const { laufMitHistorie } = await import("./fiaon-crons");
    const r = await laufMitHistorie(takt, async () => await f());
    if (!r.gelaufen) console.log(`[KI-PAUSE] Nachholen ${takt}: ${r.grund ?? "nicht gelaufen"} — der Takt übernimmt.`);
  };
  await schritt("whatsapp", async () => {
    const m = await import("./fiaon-whatsapp-mara");
    await m.nachholLauf();
    await m.zuAltFuerMara(pause.seit);
  });
  await schritt("postmeister", async () => {
    const { postmeisterNachDerPause } = await import("../routes/fiaon-postmeister");
    await postmeisterNachDerPause(pause.seit);
  });
  await schritt("kontoauszug", () => gesperrt("kontoauszug_nachholen", async () => {
    const { auszuegeNachholen } = await import("./fiaon-kontoauszug-analyse");
    return auszuegeNachholen(10);
  }));
  await schritt("schufa", () => gesperrt("schufa_nachholen", async () => {
    const { schufaNachholen } = await import("./fiaon-schufa-analyse");
    return schufaNachholen(10);
  }));
  await schritt("transkript", () => gesperrt("transkript_nachholen", async () => {
    const { transkriptLauf } = await import("./fiaon-transkript");
    return transkriptLauf(10);
  }));
}

// ── Der eine Weg ins Netz ─────────────────────────────────────────────────
/** Das echte fetch — das Netz (kiNetzAbsichern) legt es hier ab, Prüfstände setzen ihre Attrappe auf globalThis.fetch. */
function rohFetch(): typeof fetch {
  return ((globalThis as any).__kiRohFetch as typeof fetch | undefined) ?? globalThis.fetch;
}

function zuUrl(pfad: string): string {
  return /^https?:\/\//i.test(pfad) ? pfad : `${OPENAI_V1}${pfad.startsWith("/") ? "" : "/"}${pfad}`;
}

function istOpenAi(url: string): boolean {
  try { return new URL(url).hostname === OPENAI_HOST; } catch { return false; }
}

/** Der Schlüssel aus dem Authorization-Kopf (Objekt, Headers oder Paare) — null, wenn keiner mitging. */
function schluesselAus(init?: RequestInit): string | null {
  const h: any = init?.headers;
  if (!h) return null;
  let auth: string | null = null;
  if (typeof h.get === "function") auth = h.get("authorization");
  else if (Array.isArray(h)) auth = (h.find((x: any) => String(x?.[0]).toLowerCase() === "authorization") ?? [])[1] ?? null;
  else for (const k of Object.keys(h)) if (k.toLowerCase() === "authorization") auth = String(h[k]);
  return auth ? auth.replace(/^Bearer\s+/i, "").trim() : null;
}

/** Welcher Schlüssel ging mit? Nur Fehler mit DEM Hausschlüssel (OPENAI_API_KEY) lösen die Pause aus. */
function hausSchluessel(init?: RequestInit): boolean {
  const haus = process.env.OPENAI_API_KEY;
  if (!haus) return true;
  const k = schluesselAus(init);
  return !k || k === haus;
}

/**
 * JEDER OpenAI-Aufruf geht hier durch.
 *   pfad: „/chat/completions" (wird zu https://api.openai.com/v1/…) oder eine volle URL.
 *   Ist die URL NICHT api.openai.com (z. B. ASSISTENT_BASIS_URL auf einen anderen
 *   Anbieter), bleibt alles wie ein normales fetch.
 * Pausiert → KiPausiertFehler, KEIN Netzaufruf.
 * Abrechnungs-/Zugangsfehler → pausieren (einmal Alarm) und KiPausiertFehler.
 * Jede andere Antwort (auch 429 Ratenlimit, 5xx) kommt unverändert zurück.
 */
export async function openaiFetch(dienst: string, pfad: string, init: RequestInit = {}): Promise<Response> {
  const url = zuUrl(pfad);
  if (!istOpenAi(url)) return rohFetch()(url, init);
  // E-279: Text, Bild, PDF → Claude, solange Claude trägt. Sprache (/audio) bleibt bei OpenAI.
  if (aktiverAnbieter() === "claude" && claudeKannPfad(url, init.method ?? "POST")) return claudeStatt(dienst, url, init);
  await kiBereit(dienst, "openai");
  const res = await rohFetch()(url, init);
  if (!res.ok) await antwortPruefen(dienst, res, init);
  return res;
}

async function antwortPruefen(dienst: string, res: Response, init?: RequestInit): Promise<void> {
  if (res.status !== 429 && res.status !== 401 && res.status !== 403 && res.status !== 402) return;
  const text = await res.clone().text().catch(() => "");
  const art = abrechnungsFehler(res.status, text);
  if (!art) return;
  if (!hausSchluessel(init)) return; // fremder Schlüssel (z. B. ASSISTENT_API_KEY) — nicht das Hauskonto
  const { zustand } = await pausieren({
    art, fehler: `HTTP ${res.status}: ${text.slice(0, 360)}`, dienst, von: "automatisch",
    schluessel: schluesselAus(init) ?? process.env.OPENAI_API_KEY ?? null,
  });
  throw new KiPausiertFehler(dienst, zustand.art ?? art);
}

/**
 * Ein Request-Objekt an api.openai.com — wie das native fetch(Request, init):
 * Methode, Körper und Kopf kommen aus dem Request, init hat Vorrang. Der
 * Aufruf geht deshalb unverändert an das echte fetch; nur Pause und
 * Abrechnungsprüfung legen sich darum (Nachprüfung 27.09.: vorher ging bei
 * fetch(Request, init) der Körper verloren, gemessen: leerer GET).
 */
async function requestFetch(dienst: string, input: Request, init?: RequestInit): Promise<Response> {
  // E-279: ein Request-Objekt (SDK) an einen übersetzbaren Pfad → Körper lesen und über die Weiche schicken.
  if (aktiverAnbieter() === "claude" && claudeKannPfad(input.url, init?.method ?? input.method)) {
    const koerper = typeof init?.body === "string" ? init.body : await input.clone().text().catch(() => "");
    return claudeStatt(dienst, input.url, { method: "POST", body: koerper, signal: init?.signal ?? input.signal });
  }
  await kiBereit(dienst, "openai");
  const res = await rohFetch()(input, init);
  if (!res.ok) {
    const kopf = new Headers(input.headers);
    if (init?.headers) new Headers(init.headers as any).forEach((v, k) => kopf.set(k, v));
    await antwortPruefen(dienst, res, { headers: kopf });
  }
  return res;
}

const istRequest = (x: any): x is Request => !!x && typeof x === "object" && !(x instanceof URL) && typeof x.url === "string" && typeof x.headers === "object";

/** fetch für das OpenAI-SDK: new OpenAI({ apiKey, fetch: sdkFetch("dienst") }). */
export function sdkFetch(dienst: string): typeof fetch {
  return ((input: any, init?: RequestInit) => {
    if (istRequest(input)) return istOpenAi(input.url) ? requestFetch(dienst, input, init) : rohFetch()(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    return openaiFetch(dienst, url, init ?? {});
  }) as typeof fetch;
}

/**
 * Das Netz unter allem (server/index.ts, vor den Routen): globalThis.fetch an
 * api.openai.com läuft durch dieselbe Wand — auch eine Stelle, die jemand
 * künftig ohne openaiFetch baut. Einmal je Prozess.
 */
export function kiNetzAbsichern(): void {
  const g = globalThis as any;
  if (g.__kiRohFetch) return;
  const roh: typeof fetch = g.fetch.bind(globalThis);
  g.__kiRohFetch = roh;
  // E-279: Beim Start des Produktionsdienstes einmal sagen, wer trägt und ob Claude antwortet (Render-Protokoll).
  if (istProduktionsdienst() && aktiverAnbieter() === "claude") {
    setTimeout(() => {
      void claudeProbe().then((p) => console.log(p.ok
        ? `[KI-WEICHE] Claude trägt die KI — Probe ok (groß ${claudeModellFuer("gpt-5.5")}, klein ${claudeModellFuer("gpt-4.1-mini")}).`
        : `[KI-WEICHE] Claude-Probe gescheitert (${p.art ?? "vorübergehend"}): ${p.fehler.slice(0, 300)}`));
    }, 8_000);
  }
  g.fetch = (async (input: any, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input?.url ?? "");
    if (!istOpenAi(url)) return roh(input, init);
    // Request-Objekte: Kopf und Körper stecken im Objekt selbst — auch mit init unverändert weiterreichen.
    if (istRequest(input)) return requestFetch("netz", input, init);
    return openaiFetch("netz", url, init ?? {});
  }) as typeof fetch;
}

// ── E-279: Der Weg zu Claude ─────────────────────────────────────────────
/**
 * Was die Weiche je Modell gelernt hat (03.10.2026). Gemessen: Claude Sonnet 5.5 lehnte `thinking: disabled` ab und
 * nannte den richtigen Wert. Die Übersetzung hält sich an die Doku (denkArt); lehnt Claude trotzdem ein Feld ab
 * (Denken, Aufwand, Websuche-Fassung), merkt sich die Weiche das je Modell und Prozess und sendet einmal neu —
 * statt bei jedem Aufruf zu scheitern.
 */
interface Gelernt { denken?: Record<string, string>; denkenWeg?: boolean; effortWeg?: boolean; websucheAlt?: boolean }
const GELERNT = new Map<string, Gelernt>();
function lernen(modell: string, g: Gelernt): void {
  const alt = GELERNT.get(modell) ?? {};
  GELERNT.set(modell, { ...alt, ...g, denken: { ...(alt.denken ?? {}), ...(g.denken ?? {}) } });
}

function denkenAnpassen(anfrage: any): any {
  const g = GELERNT.get(String(anfrage?.model));
  if (!g) return anfrage;
  let a = anfrage;
  const t = a?.thinking?.type;
  if (g.denkenWeg && a.thinking) { a = { ...a }; delete a.thinking; }
  else if (t && g.denken?.[t]) a = { ...a, thinking: { type: g.denken[t] } };
  if (g.effortWeg && a.output_config?.effort) {
    const { effort: _e, ...rest } = a.output_config;
    a = { ...a };
    if (Object.keys(rest).length) a.output_config = rest; else delete a.output_config;
  }
  if (g.websucheAlt && Array.isArray(a.tools) && a.tools.some((w: any) => w?.type === "web_search_20260209")) {
    a = { ...a, tools: a.tools.map((w: any) => (w?.type === "web_search_20260209" ? { ...w, type: "web_search_20250305" } : w)) };
  }
  return a;
}

/** „send "thinking": {"type": "X"} instead of {"type": "Y"}“ → { neu: X, alt: Y }. Rein. */
export function denkHinweis(meldung: string): { neu: string; alt: string } | null {
  const m = /"thinking"\s*:\s*\{\s*"type"\s*:\s*"([a-z_]+)"\s*\}\s*instead of\s*\{\s*"type"\s*:\s*"([a-z_]+)"\s*\}/i.exec(String(meldung || ""));
  return m ? { neu: m[1], alt: m[2] } : null;
}

/** Arbeitsbereich für Organisations-Schlüssel (anthropic-workspace-id): Umgebung, sonst einmal ermittelt. */
let claudeArbeitsbereich: string | null | undefined;
/** Wie der Schlüssel mitgeht — x-api-key (Standard) oder Bearer (identitätsgebundene Schlüssel). */
let claudeKopfArt: "x-api-key" | "bearer" = "x-api-key";

function claudeKopf(art: "x-api-key" | "bearer" = claudeKopfArt): Record<string, string> {
  const k = String(process.env.ANTHROPIC_API_KEY || "").trim();
  const h: Record<string, string> = { "content-type": "application/json", "anthropic-version": ANTHROPIC_VERSION };
  if (art === "bearer") h.authorization = `Bearer ${k}`; else h["x-api-key"] = k;
  const ws = String(process.env.ANTHROPIC_WORKSPACE_ID || "").trim() || claudeArbeitsbereich;
  if (ws) h["anthropic-workspace-id"] = ws;
  return h;
}

/** Organisations-Schlüssel ohne Arbeitsbereich: den Standard-Arbeitsbereich über die Admin-API ermitteln (einmal je Prozess). */
async function arbeitsbereichErmitteln(): Promise<string | null> {
  try {
    const res = await rohFetch()(`${ANTHROPIC_V1}/organizations/workspaces?limit=100&include_default=true`, { headers: claudeKopf(), signal: AbortSignal.timeout(15_000) });
    const j: any = await res.json().catch(() => null);
    const liste = Array.isArray(j?.data) ? j.data.filter((w: any) => !w?.archived_at) : [];
    const w = liste.find((x: any) => /^(default|standard)$/i.test(String(x?.name ?? ""))) ?? liste[0];
    console.log(`[KI-WEICHE] Arbeitsbereich ermittelt: ${w?.id ?? "keiner"} (${liste.length} aktiv, HTTP ${res.status}).`);
    return w?.id ? String(w.id) : null;
  } catch (e) {
    console.error("[KI-WEICHE] Arbeitsbereich nicht ermittelbar:", String(e).slice(0, 160));
    return null;
  }
}

/**
 * Ein Aufruf an Claude (POST /v1/messages). Wiederholt bei Überlastung (529/503/500) und reinem Ratenlimit
 * (429 ohne Abrechnungsmerkmal) bis zu dreimal; ermittelt einmal den Arbeitsbereich (Organisations-Schlüssel)
 * und probiert einmal die andere Schlüssel-Kopfart (401). Wirft nie wegen HTTP — der Status kommt zurück.
 */
async function claudeSenden(anfrage: any, signal?: AbortSignal | null): Promise<{ status: number; json: any; text: string }> {
  let letzte = { status: 0, json: null as any, text: "" };
  let kopfProbiert = false;
  const geheilt = new Set<string>();
  for (let versuch = 1; versuch <= 7; versuch++) {
    anfrage = denkenAnpassen(anfrage);
    const res = await rohFetch()(`${ANTHROPIC_V1}/messages`, {
      method: "POST", headers: claudeKopf(), body: JSON.stringify(anfrage), signal: signal ?? undefined,
    });
    const text = await res.text().catch(() => "");
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* kein JSON */ }
    letzte = { status: res.status, json, text };
    if (res.ok) return letzte;
    const meldung = String(json?.error?.message ?? "");
    // Selbstkorrektur: Claude lehnt ein Feld ab → je Art einmal anpassen (und je Modell merken), dann neu.
    if (res.status === 400) {
      const modell = String(anfrage.model);
      const heilen = (art: string, g: Gelernt | null, aendern: (a: any) => any, satz: string): boolean => {
        if (geheilt.has(art)) return false;
        geheilt.add(art);
        if (g) lernen(modell, g);
        anfrage = aendern({ ...anfrage });
        console.log(`[KI-WEICHE] ${modell}: ${satz} — ${g ? "gemerkt, " : ""}neu gesendet.`);
        return true;
      };
      const hinweis = denkHinweis(meldung);
      if (hinweis && heilen("denken", { denken: { [hinweis.alt]: hinweis.neu } }, (a) => ({ ...a, thinking: { type: hinweis.neu } }), `Denken „${hinweis.alt}“ heißt hier „${hinweis.neu}“`)) continue;
      if (anfrage.thinking && /thinking/i.test(meldung) && heilen("denken-weg", { denkenWeg: true }, (a) => { delete a.thinking; return a; }, "Denk-Einstellung abgelehnt")) continue;
      if (anfrage.output_config?.effort && /effort/i.test(meldung) && heilen("effort", { effortWeg: true }, (a) => {
        const { effort: _e, ...rest } = a.output_config;
        if (Object.keys(rest).length) a.output_config = rest; else delete a.output_config;
        return a;
      }, "Aufwand abgelehnt")) continue;
      if ((anfrage.temperature != null || anfrage.top_p != null || anfrage.top_k != null) && /temperature|top_p|top_k/i.test(meldung)
        && heilen("sampling", null, (a) => { delete a.temperature; delete a.top_p; delete a.top_k; return a; }, "Temperatur abgelehnt")) continue;
      if (anfrage.tool_choice && anfrage.tool_choice.type !== "auto" && /tool_choice/i.test(meldung)
        && heilen("tool_choice", null, (a) => ({ ...a, tool_choice: { type: "auto" } }), "Werkzeugwahl abgelehnt")) continue;
      if (Array.isArray(anfrage.tools) && anfrage.tools.some((w: any) => w?.type === "web_search_20260209") && /web_search/i.test(meldung)
        && heilen("websuche", { websucheAlt: true }, (a) => ({ ...a, tools: a.tools.map((w: any) => (w?.type === "web_search_20260209" ? { ...w, type: "web_search_20250305" } : w)) }), "neue Websuche abgelehnt")) continue;
    }
    if (res.status === 400 && /workspace/i.test(meldung) && !process.env.ANTHROPIC_WORKSPACE_ID && claudeArbeitsbereich === undefined) {
      claudeArbeitsbereich = await arbeitsbereichErmitteln();
      if (claudeArbeitsbereich) continue;
    }
    if (res.status === 401 && !kopfProbiert) {
      kopfProbiert = true;
      const vorher = claudeKopfArt;
      claudeKopfArt = vorher === "x-api-key" ? "bearer" : "x-api-key";
      const r2 = await rohFetch()(`${ANTHROPIC_V1}/messages`, { method: "POST", headers: claudeKopf(), body: JSON.stringify(anfrage), signal: signal ?? undefined });
      const t2 = await r2.text().catch(() => "");
      let j2: any = null;
      try { j2 = JSON.parse(t2); } catch { /* kein JSON */ }
      if (r2.ok) { console.log(`[KI-WEICHE] Schlüssel geht als ${claudeKopfArt} mit.`); return { status: r2.status, json: j2, text: t2 }; }
      claudeKopfArt = vorher;
      return letzte;
    }
    const voruebergehend = res.status === 529 || res.status === 503 || res.status === 500 || (res.status === 429 && !claudeFehlerArt(429, json));
    if (!voruebergehend || versuch >= 4) return letzte;
    const warte = (Number(res.headers.get("retry-after")) || 0) * 1000 || 1_500 * versuch * versuch;
    await new Promise((r) => setTimeout(r, Math.min(warte, 20_000)));
  }
  return letzte;
}

function jsonAntwort(x: unknown, status = 200): Response {
  return new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });
}

/**
 * Ein OpenAI-Aufruf (Chat Completions oder Responses), ausgeführt von Claude. Die Antwort hat dieselbe Form,
 * die der Aufrufer von OpenAI erwartet — auch als Datenstrom (stream: true) und auch im Fehlerfall (error.message).
 * Pausiert → KiPausiertFehler. Abrechnung/Zugang → pausieren (Anbieter claude, einmal Alarm).
 */
async function claudeStatt(dienst: string, url: string, init: RequestInit): Promise<Response> {
  await kiBereit(dienst, "claude");
  if (!process.env.ANTHROPIC_API_KEY) return jsonAntwort({ error: { message: "Kein Claude-Schlüssel gesetzt (ANTHROPIC_API_KEY).", type: "claude_error", code: "kein_schluessel" } }, 500);
  let pfad = url;
  try { pfad = new URL(url).pathname; } catch { /* Pfad */ }
  const istResponses = /\/responses\/?$/.test(pfad);
  let body: any = {};
  try {
    const roh = typeof init.body === "string" ? init.body : init.body ? await new Response(init.body as any).text() : "{}";
    body = JSON.parse(roh || "{}");
  } catch { body = {}; }
  const chat = istResponses ? responsesNachChat(body) : body;
  let ueb = chatNachClaude(chat);
  let r = await claudeSenden(ueb.anfrage, init.signal);
  // Festes Format abgelehnt (Schema-Eigenheit, Websuche mit Belegen …) → einmal als klare Anweisung.
  if (r.status === 400 && ueb.anfrage.output_config?.format && !claudeFehlerArt(r.status, r.json)
    && /output_config|format|schema/i.test(String(r.json?.error?.message ?? r.text))) {
    console.warn(`[KI-WEICHE] ${dienst}: festes Format abgelehnt (${String(r.json?.error?.message ?? r.text).slice(0, 160)}) — zweiter Versuch mit Anweisung.`);
    ueb = alsAnweisung(ueb);
    r = await claudeSenden(ueb.anfrage, init.signal);
  }
  if (r.status < 200 || r.status >= 300) {
    const art = claudeFehlerArt(r.status, r.json);
    if (art) {
      const { zustand } = await pausieren({
        art, fehler: `HTTP ${r.status}: ${r.text.slice(0, 360)}`, dienst, von: "automatisch",
        schluessel: process.env.ANTHROPIC_API_KEY ?? null, anbieter: "claude",
      });
      throw new KiPausiertFehler(dienst, zustand.art ?? art, (zustand.anbieter ?? "claude") as KiAnbieter);
    }
    console.error(`[KI-WEICHE] ${dienst}: Claude HTTP ${r.status}: ${r.text.slice(0, 300)}`);
    return jsonAntwort(alsOpenAiFehler(r.status, r.json, r.text), r.status || 502);
  }
  // Websuche: Claude hält nach seiner Schleifengrenze an („pause_turn“) — den Zwischenstand zurückgeben und
  // weitermachen lassen (höchstens dreimal); die Blöcke werden für die Antwort zusammengelegt.
  let roh = r.json;
  const vorher: any[] = [];
  for (let n = 0; n < 3 && roh?.stop_reason === "pause_turn"; n++) {
    vorher.push(...(Array.isArray(roh.content) ? roh.content : []));
    const weiter = { ...ueb.anfrage, messages: [...ueb.anfrage.messages, { role: "assistant", content: roh.content }] };
    const r2 = await claudeSenden(weiter, init.signal);
    if (r2.status < 200 || r2.status >= 300) break;
    roh = r2.json;
    ueb = { ...ueb, anfrage: weiter };
  }
  if (vorher.length) roh = { ...roh, content: [...vorher, ...(Array.isArray(roh?.content) ? roh.content : [])] };
  const antwort = claudeNachChat(roh, { json: ueb.json, modell: ueb.anfrage.model });
  if (istResponses) return jsonAntwort(chatNachResponses(antwort));
  if (ueb.stream) return new Response(chatAlsSse(antwort), { status: 200, headers: { "content-type": "text/event-stream" } });
  return jsonAntwort(antwort);
}

/** Ein winziger echter Claude-Aufruf (Probe beim Aktivieren und beim Start) — kostet Bruchteile eines Cents. */
async function claudeProbe(): Promise<{ ok: boolean; art: KiPauseArt | null; fehler: string }> {
  try {
    // Dieselbe Übersetzung wie jeder echte Aufruf (Denken je Modell, Sonnet 5.5 mit „between_tools“).
    const { anfrage } = chatNachClaude({ model: "gpt-4.1-mini", max_tokens: 1_024, messages: [{ role: "user", content: "Antworte nur mit OK." }] }, { denkenAus: true });
    const r = await claudeSenden(anfrage, AbortSignal.timeout(30_000));
    if (r.status >= 200 && r.status < 300) return { ok: true, art: null, fehler: "" };
    return { ok: false, art: claudeFehlerArt(r.status, r.json), fehler: `HTTP ${r.status}: ${r.text.slice(0, 240)}` };
  } catch (e: any) {
    return { ok: false, art: null, fehler: String(e?.message || e) };
  }
}

/** Nur für Prüfstände: ein Rohaufruf an Claude (mit Selbstkorrektur), wie ihn claudeStatt macht. */
export const claudeSendenFuerPruefstand = (anfrage: any) => claudeSenden(anfrage);

/** Nur für Prüfstände: Arbeitsbereich, Kopfart und Gelerntes vergessen. */
export function kiWeicheZuruecksetzen(): void {
  GELERNT.clear();
  claudeArbeitsbereich = undefined;
  claudeKopfArt = "x-api-key";
}

/** Nur für Prüfstände: Zwischenspeicher vergessen. */
export function kiPauseZwischenspeicherLeeren(): void {
  zwischen = null;
  lokalePause = null;
  lokalNurHier = false;
  alarmOffen = false;
}
