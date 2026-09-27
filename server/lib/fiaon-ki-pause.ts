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
import { sqlPool } from "./db-pool";

export const OPENAI_HOST = "api.openai.com";
export const OPENAI_V1 = "https://api.openai.com/v1";
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
  constructor(readonly dienst: string, readonly art: KiPauseArt | null = null) {
    super(kiPauseMeldung(art));
    this.name = "KiPausiertFehler";
  }
}

/** Die Meldung, die interaktive Stellen zeigen. Beginnt IMMER mit „KI pausiert" (Aufrufer prüfen darauf). */
export function kiPauseMeldung(art: KiPauseArt | null): string {
  if (art === "hand") return "KI pausiert — im Chefbüro von Hand angehalten. Justin aktiviert sie dort wieder.";
  if (art === "zugang") return "KI pausiert — OpenAI lehnt den Zugang ab (Schlüssel oder Konto). Justin aktiviert sie im Chefbüro wieder.";
  return "KI pausiert — OpenAI konnte nicht abbuchen (Guthaben). Justin aktiviert sie im Chefbüro wieder.";
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

export async function kiPauseLesen(frisch = false): Promise<KiPauseZustand> {
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
        return neu ? z : await kiPauseLesen(true);
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

export async function kiPausiert(): Promise<boolean> {
  return (await kiPauseLesen()).an;
}

/** Vor jedem OpenAI-Aufruf: wirft KiPausiertFehler, wenn pausiert. */
export async function kiBereit(dienst: string): Promise<void> {
  const z = await kiPauseLesen();
  if (z.an) throw new KiPausiertFehler(dienst, z.art);
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

function grundAus(art: KiPauseArt, fehler: string): string {
  if (art === "hand") return fehler || "Von Hand angehalten.";
  if (art === "zugang") return `OpenAI lehnt den Zugang ab (Schlüssel oder Konto): ${fehler.slice(0, 160)}`;
  if (/no credits|credit balance/i.test(fehler)) return "OpenAI meldet: kein Guthaben mehr.";
  if (/spend limit|usage limit|hard_limit/i.test(fehler)) return "OpenAI meldet: Ausgabengrenze erreicht.";
  return "OpenAI konnte nicht abbuchen.";
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

export async function pausieren(ein: { art: KiPauseArt; fehler: string; dienst: string; von: string; schluessel?: string | null }): Promise<{ neu: boolean; zustand: KiPauseZustand }> {
  const jetzt = new Date().toISOString();
  const vorher = await kiPauseLesen(true);
  if (vorher.an) return { neu: false, zustand: vorher };
  const grund = grundAus(ein.art, ein.fehler);
  const fingerabdruck = ein.art === "hand" ? null : schluesselFingerabdruck(ein.schluessel ?? process.env.OPENAI_API_KEY);
  const z: KiPauseZustand = {
    an: true, art: ein.art, grund, fehler: ein.fehler.slice(0, 400), dienst: ein.dienst, schluessel: fingerabdruck,
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
    const neu = await pauseSchreiben(z);
    lokalePause = null;
    if (!neu) {
      zwischen = null;
      return { neu: false, zustand: await kiPauseLesen(true) };
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
  const titel = z.art === "zugang"
    ? "OpenAI lehnt den Zugang ab — alle KI-Funktionen pausiert"
    : "OpenAI konnte nicht abbuchen — alle KI-Funktionen pausiert";
  const text = [
    z.art === "zugang"
      ? "OpenAI lehnt den Schlüssel oder das Konto ab — alle KI-Funktionen pausiert. Nach der Klärung im Chefbüro ‚KI wieder aktivieren' drücken."
      : KI_PAUSE_ALARM_TEXT,
    "",
    `Seit ${zeit} · erster Fehler bei: ${z.dienst} · Schlüssel ${z.schluessel ?? "—"} · OpenAI meldet: ${String(z.fehler || "").slice(0, 240)}`,
    "",
    "Was steht: Mara auf WhatsApp und im Postfach, Mara-Aktion und Mara-Aufträge, Kontoauszug- und SCHUFA-Auswertung, Texterkennung, Transkripte, Ratgeber, Firmen-Radar, Copilot und alle KI-Knöpfe. Nichts davon schickt in der Pause etwas an Kunden — auch keinen Ersatzsatz.",
    "Was weiterläuft: alles ohne KI — Betreuer schreiben selbst, WA-Zentrale, Mailwerk, Rückholung, Auskunft-Verkauf (Vorlagen).",
    KI_PAUSE_MAIL_HINWEIS,
    "",
    z.art === "zugang"
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
  const vorher = await kiPauseLesen(true);
  // Nicht pausiert (Route direkt aufgerufen, zwei Klicks gekreuzt): nichts
  // ändern. Früher setzte eine gescheiterte Probe hier an=true — eine Pause
  // ohne Alarm, ohne seit und ohne Dienst (Nachprüfung 27.09.). Bucht OpenAI
  // wirklich nicht ab, pausiert der nächste echte Aufruf regulär mit Alarm.
  if (!vorher.an) return { ok: true, zustand: vorher, hinweis: "Die KI war nicht pausiert — nichts geändert." };
  // Eine Pause nur dieses Prozesses (kein Produktionsdienst) stand nie in der DB — dort auch nichts schreiben.
  if (lokalNurHier && lokalePause && vorher === lokalePause) {
    lokalePause = null; lokalNurHier = false; zwischen = null;
    return { ok: true, zustand: await kiPauseLesen(true), hinweis: "Nur in diesem Prozess pausiert gewesen — aufgehoben, nichts gespeichert." };
  }
  let hinweis: string | undefined;
  if (opt.probe !== false && process.env.OPENAI_API_KEY) {
    const p = await probe();
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
          ? `OpenAI bucht noch nicht ab — die Pause bleibt. (${p.fehler.slice(0, 160)})`
          : `OpenAI lehnt den Zugang noch ab — die Pause bleibt. (${p.fehler.slice(0, 160)})`,
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
  await kiBereit(dienst);
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
  await kiBereit(dienst);
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
  g.fetch = (async (input: any, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input?.url ?? "");
    if (!istOpenAi(url)) return roh(input, init);
    // Request-Objekte: Kopf und Körper stecken im Objekt selbst — auch mit init unverändert weiterreichen.
    if (istRequest(input)) return requestFetch("netz", input, init);
    return openaiFetch("netz", url, init ?? {});
  }) as typeof fetch;
}

/** Nur für Prüfstände: Zwischenspeicher vergessen. */
export function kiPauseZwischenspeicherLeeren(): void {
  zwischen = null;
  lokalePause = null;
  lokalNurHier = false;
  alarmOffen = false;
}
