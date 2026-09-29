// ═══════════════════════════════════════════════════════════════════════════
// DIE WHATSAPP-BREMSE (29.09.2026, E-261)
//
// Was am 28.09. passiert ist (nachgemessen): 89 Vorlagen scheiterten bei Meta
// mit „(#131042) Business eligibility payment issue" — Meta konnte nicht
// abbuchen —, an 88 Menschen, von 13:36 bis 21:46 Uhr. Niemand hielt an: Meta
// nimmt die Sendung SYNCHRON an (wa_id kommt zurück → ok), der Fehler kommt
// Sekunden später ASYNCHRON im Status-Webhook. Der Webhook setzte nur
// fiaon_whatsapp.status = 'fehler' — die Automatik lief weiter, der Verkaufstakt
// auch, die Begrüßung neuer Leads auch, und fiaon_wa_aktion.ok blieb TRUE.
// Dazu las die Meta-Qualität nur, wer gerade den Tagesraum der Zentrale rief;
// ROT stoppte in der Zentrale ALLES (auch die Monatsrate), Begrüßung, Kette,
// Telefonkartei, Akte, Raum und Mara-Auftrag prüften ROT gar nicht.
//
// DIESE DATEI IST DIE EINZIGE WAHRHEIT (Muster KI-Pause E-246, fiaon-ki-pause.ts):
//
//   · NOTBREMSE — Zustand fiaon_settings.wa_pause (JSON als Text, 10 s
//     zwischengespeichert, beim Setzen im eigenen Prozess sofort). Auslöser:
//     kontofehlerMelden() aus dem Status-Webhook (waEingang) und aus dem
//     synchronen Fehler in waSenden. Jede Meldung steht in fiaon_wa_kontofehler.
//       – Kontosperre (131031, 368, 131045, 133010, 131005): beim ERSTEN
//         Fehler — das Konto ist zu, jede weitere Nachricht ist sinnlos.
//       – 190 (Token abgelaufen) ist KEINE Kontosperre, sondern ein eigener Fall
//         „zugang" (Gegenprüfung 29.09.): Titel und Anweisung sagen „Token
//         erneuern (Render: META_SYSTEM_TOKEN)", und aktiviert wird nur, wenn der
//         Probe-GET wieder ohne #190 zurückkommt — sonst pausierte die nächste
//         Sendung sofort wieder, mit einer neuen Aufgabe je Durchgang. Wie bei der
//         Kontosperre geht dann gar nichts raus (auch kein Text).
//       – 131042 (Zahlung), 131048 (Spam-Grenze): bei ZWEI gleichen Codes in
//         60 Minuten. Warum nicht „3 in 10 Min.": Die Automatik sendet einzeln im
//         5-Min.-Takt; gemessen am 28.09.: 13:36:46, 13:41:45, 13:41:48, 13:51:46
//         … — „3 in 10 Min." hätte nur zufällig gegriffen. Mit „2 in 60 Min."
//         stünde der Versand ab 13:41:54 — dem Webhook der 2. Sendung (13:41:45);
//         die Sendung von 13:41:48 lag im Webhook-Verzug und ging noch an Meta.
//         Nachgespielt mit den 118 echten Sendungen des 28.09.: 86 Fehlsendungen
//         weniger. Dieselbe wa_id zählt nie zweimal (Meta wiederholt Webhooks).
//       – Gezählt wird erst ab dem letzten „wieder aktivieren" — nach der
//         EINGANGSZEIT der Meldung UND nach der SENDEZEIT der Nachricht
//         (fiaon_wa_kontofehler.gesendet_am, aus fiaon_whatsapp über die wa_id).
//         Ein von Meta wiederholter Webhook einer Sendung von VOR der Pause, der
//         erst nach dem Aktivieren eintrifft (z. B. Endpunkt beim Deploy nicht
//         erreichbar), steht in der Tabelle, zählt aber nicht — sonst legte bei
//         einer Kontosperre schon eine einzige solche Meldung alles neu still.
//       – Empfänger-Codes pausieren NIE global: 131026 (unzustellbar), 131049
//         (Werbegrenze je Empfänger), 131056 (Paar-Ratenlimit — nur diese eine
//         Nummer), 131047 (Fenster zu), 130429/131016/131000 (vorübergehend).
//         131050 (Empfänger hat unsere Werbung abbestellt) sperrt die NUMMER für
//         Werbe-Vorlagen (fiaon-wa-unzustellbar.ts). „Eine Bremse, die falsch
//         auslöst, ist gefährlicher als keine." (AGENTS)
//     Automatisch pausiert NUR der Produktionsdienst (istProduktionsdienst, wie
//     E-246): ein lokales Skript gegen die Produktions-DB legt nur sich selbst
//     still — kein DB-Schreiben, kein Alarm. Genau EINE dringende Aufgabe an
//     Justin je Pause (Schlüssel wa-pause-<seit>). Nichts an Kunden als Ersatz.
//     Zwei gleichzeitige Meldungen im selben Prozess (Meta bündelt Status, ein
//     Hand-Lauf und die Automatik senden zugleich) teilen sich EIN pausieren()
//     (pausierFlug) — der Nachtrag in waPauseLesen greift nur, wenn das Speichern
//     wirklich scheiterte, und wer dort schreibt, alarmiert (Gegenprüfung 29.09.:
//     sonst stand die Pause, aber niemand bekam eine Aufgabe).
//     Wieder aktivieren nur der Inhaber — vorher eine Probe OHNE Nachricht
//     (health_status an Konto und Nummer, nur lesend). Nach einer Kontosperre
//     oder einem abgelaufenen Zugang sammelt fiaon-whatsapp-mara.ts
//     (zuAltFuerMara, Quelle „wa") die Nachrichten aus der Sperrzeit, die älter
//     als 12 Stunden sind, in EINE Aufgabe — auch die über 23,5 Stunden, die der
//     Nachhol-Takt nicht mehr sieht.
//
//   · QUALITÄTSBREMSE — Metas Bewertung der Nummer wird im Takt wa_meta_stand
//     (5 Min., nur Betrieb) gelesen und in fiaon_settings.wa_meta_stand gelegt;
//     alle Instanzen lesen denselben Stand. GELB halbiert die Automatik (Zentrale,
//     Lead-Kette, Verkaufstakt, Hand-Lauf), ROT stoppt alle WERBE-Vorlagen auf
//     allen Wegen; Monatsrate, einzelne Termin-Nachrichten (Akte, Raum) und
//     Antworten im offenen Fenster laufen weiter. In der ZENTRALE zählt bei ROT
//     und GELB die Gruppe, nicht der Vorlagenname: Service ist dort nur die
//     Monatsrate (rate_offen) — eine Termin-Einladung an Lead-Gruppen ist ein
//     Massenversand an kalte Leads (Gegenprüfung 29.09., fiaon-wa-zentrale.ts,
//     gruppenBremse).
//
//   · DIE REGEL — waBremse({ vorlage | text | werbung }) → { erlaubt, grund, faktor }:
//       Zustand            Werbe-Vorlage     Service-Vorlage   Text im 24-h-Fenster
//       GRÜN / unbekannt   ja                ja                ja
//       GELB               ja (Faktor 0,5)   ja                ja
//       ROT                nein*             ja                ja
//       Pause zahlung/spam/hand   nein       nein              ja
//       Pause gesperrt/zugang     nein       nein              nein
//     * Ausnahme bei ROT (Justin, 29.09.): die Begrüßung eines frischen Leads (Formular
//       ≤ 24 h, frischerLead) — er hat selbst um Kontakt gebeten. Die Pause hält auch sie an.
//     „Werbe-Vorlage" = unsere Regel (waVorlageWerblich, fiaon-mail-frequenz.ts)
//     ODER Metas Kategorie MARKETING — sagt eine der beiden „Werbung", gilt Werbung.
//     Jeder Grund beginnt mit „WhatsApp pausiert" bzw. „Meta-Qualität ROT".
//     Die harte Wand steht in waSenden (vor jeder Meta-Anfrage) und in
//     waTagesplatz (kein verbrauchter Tagesplatz in der Pause).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { istProduktionsdienst } from "./fiaon-ki-pause";

type Lauf = typeof sqlPool;

export const WA_PAUSE_SCHLUESSEL = "wa_pause";
export const WA_META_STAND_SCHLUESSEL = "wa_meta_stand";
/** Wo der Knopf steht — rotes Band auf jeder /chef-Seite, dazu der Chip „WhatsApp" im Mara-Steuerpult. */
export const WA_PAUSE_KLICKWEG = "/chef/s/mara";
/** Zwei gleiche Kontofehler (131042, 131048) in so vielen Minuten → Pause. */
export const WA_SCHWELLE_ANZAHL = 2;
export const WA_SCHWELLE_MINUTEN = 60;
/** Älter als das → der gespeicherte Meta-Stand wird beim Lesen einmal frisch geholt. */
export const WA_STAND_ALT_MIN = 15;
/** GELB: so viel der Automatik bleibt. */
export const WA_FAKTOR_GELB = 0.5;

export type WaPauseArt = "zahlung" | "gesperrt" | "zugang" | "spam" | "hand";
export type WaFehlerArt = "zahlung" | "gesperrt" | "zugang" | "spam" | "nummer" | "empfaenger" | "vorlage" | "voruebergehend" | "sonst";

/** Kontosperre oder abgelaufener Zugang: dann geht GAR NICHTS raus, auch kein Text im offenen Fenster. */
export function waAllesZu(art: WaPauseArt | string | null | undefined): boolean {
  return art === "gesperrt" || art === "zugang";
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE CODE-TABELLE — eine Stelle, die jeder liest (Prüfstand Teil 1)
// ═══════════════════════════════════════════════════════════════════════════
export const WA_FEHLER_ART: Readonly<Record<number, { art: WaFehlerArt; satz: string }>> = {
  131042: { art: "zahlung", satz: "Meta kann nicht abbuchen (Zahlungsproblem im WhatsApp-Konto)" },
  131031: { art: "gesperrt", satz: "Meta hat das WhatsApp-Konto gesperrt" },
  368: { art: "gesperrt", satz: "Meta hat das Konto wegen eines Richtlinienverstoßes vorübergehend gesperrt" },
  131045: { art: "gesperrt", satz: "Die Nummer ist bei Meta nicht (mehr) richtig registriert (Zertifikat)" },
  133010: { art: "gesperrt", satz: "Die Nummer ist bei Meta nicht registriert" },
  131005: { art: "gesperrt", satz: "Meta verweigert den Zugriff auf das WhatsApp-Konto" },
  190: { art: "zugang", satz: "Der Meta-Zugang (Token) ist ungültig oder abgelaufen" },
  131048: { art: "spam", satz: "Meta bremst wegen Spam-Meldungen (Ratenlimit des Kontos)" },
  131050: { art: "nummer", satz: "Der Empfänger hat Werbung von uns abbestellt" },
  131026: { art: "empfaenger", satz: "Nachricht an diese Nummer nicht zustellbar" },
  131049: { art: "empfaenger", satz: "Metas Grenze für Werbenachrichten an diesen Empfänger erreicht" },
  131056: { art: "empfaenger", satz: "Zu viele Nachrichten an genau diese Nummer in kurzer Zeit (Paar-Ratenlimit)" },
  131047: { art: "empfaenger", satz: "Das 24-Stunden-Fenster ist zu" },
  130429: { art: "voruebergehend", satz: "Meta drosselt den Durchsatz gerade" },
  131016: { art: "voruebergehend", satz: "Meta ist vorübergehend nicht erreichbar" },
  131000: { art: "voruebergehend", satz: "Unbekannter Fehler bei Meta" },
  132000: { art: "vorlage", satz: "Platzhalter passen nicht zur Vorlage" },
  132001: { art: "vorlage", satz: "Vorlage nicht vorhanden" },
  132005: { art: "vorlage", satz: "Vorlagentext zu lang" },
  132007: { art: "vorlage", satz: "Vorlage verstößt gegen Metas Richtlinien" },
  132012: { art: "vorlage", satz: "Platzhalter im falschen Format" },
  132015: { art: "vorlage", satz: "Vorlage pausiert (geringe Qualität)" },
  132016: { art: "vorlage", satz: "Vorlage gesperrt (geringe Qualität)" },
  131008: { art: "vorlage", satz: "Pflichtangabe fehlt" },
  131009: { art: "vorlage", satz: "Ungültiger Wert" },
};

export function waFehlerArt(code: unknown): WaFehlerArt {
  const n = Number(code);
  return (Number.isFinite(n) && WA_FEHLER_ART[n]?.art) || "sonst";
}

/** Welche Pause löst dieser Code aus — und ab dem wievielten gleichen Fehler? null = keine globale Pause. */
export function pauseRegel(code: unknown): { art: WaPauseArt; ab: number } | null {
  const art = waFehlerArt(code);
  if (art === "gesperrt") return { art: "gesperrt", ab: 1 };
  if (art === "zugang") return { art: "zugang", ab: 1 };
  if (art === "zahlung") return { art: "zahlung", ab: WA_SCHWELLE_ANZAHL };
  if (art === "spam") return { art: "spam", ab: WA_SCHWELLE_ANZAHL };
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER PAUSENZUSTAND (fiaon_settings.wa_pause)
// ═══════════════════════════════════════════════════════════════════════════
export interface WaPauseEreignis { am: string; was: "pausiert" | "aktiviert" | "probe_gescheitert"; von: string; grund: string | null }

export interface WaPauseZustand {
  an: boolean;
  art: WaPauseArt | null;
  /** Metas Fehlercode, der die Pause auslöste (131042 …) — null bei „hand". */
  code: number | null;
  /** Klartext für Menschen. */
  grund: string | null;
  /** Rohmeldung von Meta (erste), gekürzt. */
  fehler: string | null;
  /** Ein Link aus Metas Fehlertext (z. B. Abrechnung), sonst null. */
  link: string | null;
  quelle: "webhook" | "senden" | "hand" | null;
  /** Nur in diesem Prozess pausiert (kein Produktionsdienst) — nie gespeichert. */
  nurLokal?: boolean;
  seit: string | null;
  von: string | null;
  aufgehobenAm: string | null;
  aufgehobenVon: string | null;
  /** Die letzten Ereignisse — neueste zuerst, höchstens 20. */
  verlauf: WaPauseEreignis[];
}

const LEER: WaPauseZustand = {
  an: false, art: null, code: null, grund: null, fehler: null, link: null, quelle: null, seit: null, von: null,
  aufgehobenAm: null, aufgehobenVon: null, verlauf: [],
};

let produktionSimuliert: boolean | null = null;
/** Nur für Prüfstände: die Produktionsbedingung vorgeben (null = echte Umgebung). */
export function waPauseProduktionSimulieren(an: boolean | null): void { produktionSimuliert = an; }
function produktion(): boolean { return produktionSimuliert ?? istProduktionsdienst(); }

let zwischen: { wert: WaPauseZustand; bis: number } | null = null;
/** Wie E-246: eine erkannte, (noch) nicht gespeicherte Pause gilt trotzdem; lokal wird sie nie gespeichert. */
let lokalePause: WaPauseZustand | null = null;
let lokalNurHier = false;
/**
 * Gegenprüfung 29.09. (Rennen „Pause ohne Aufgabe"): NUR wenn das Speichern der Pause
 * wirklich scheiterte, trägt waPauseLesen sie nach — und wer sie dort schreibt, alarmiert.
 * Solange pausieren() noch auf die Datenbank wartet, gilt die Pause hier schon, geschrieben
 * wird aber nur von pausieren() selbst (sonst schrieb ein gleichzeitiges Lesen sie „nach",
 * das eigentliche Schreiben ging leer aus, und keiner der beiden alarmierte).
 */
let nachtragOffen = false;
/** Ein pausieren() je Prozess zur selben Zeit — eine zweite, gleichzeitige Meldung wartet auf die erste. */
let pausierFlug: Promise<{ neu: boolean; zustand: WaPauseZustand }> | null = null;
/** Nur für Prüfstände: das erste Schreiben der Pause aufhalten oder einmal scheitern lassen. */
let pruefHaken: { verzoegernEinmalMs?: number; fehlerEinmal?: boolean } | null = null;
export function waPausePruefHaken(h: { verzoegernEinmalMs?: number; fehlerEinmal?: boolean } | null): void { pruefHaken = h ? { ...h } : null; }

function lesen(roh: unknown): WaPauseZustand {
  if (!roh) return { ...LEER };
  try {
    const j = typeof roh === "string" ? JSON.parse(roh) : roh;
    return {
      ...LEER, ...j,
      an: j?.an === true,
      code: j?.code != null && Number.isFinite(Number(j.code)) ? Number(j.code) : null,
      verlauf: Array.isArray(j?.verlauf) ? j.verlauf.slice(0, 20) : [],
    };
  } catch {
    return { ...LEER };
  }
}

export async function waPauseLesen(frisch = false): Promise<WaPauseZustand> {
  if (!frisch && zwischen && zwischen.bis > Date.now()) return lokalePause ?? zwischen.wert;
  try {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${WA_PAUSE_SCHLUESSEL} LIMIT 1`) as any[];
    const wert = lesen(r?.value);
    zwischen = { wert, bis: Date.now() + 10_000 };
    if (lokalePause && lokalNurHier) return wert.an ? wert : lokalePause; // nie speichern
    if (lokalePause && !wert.an) {
      // Hat Justin inzwischen (in einem anderen Prozess) aktiviert, gilt das.
      if (wert.aufgehobenAm && lokalePause.seit && wert.aufgehobenAm > lokalePause.seit) {
        lokalePause = null; nachtragOffen = false;
        return wert;
      }
      // pausieren() schreibt gerade selbst (die Datenbank antwortet noch): die Pause gilt hier schon — nicht nachtragen.
      if (!nachtragOffen) return lokalePause;
      // Die Pause des Produktionsdienstes ließ sich nicht speichern — jetzt nachtragen. Wer sie hier schreibt, alarmiert
      // (vorher ging kein Alarm raus: pausieren() alarmiert nur nach einem gelungenen Schreiben).
      const z = lokalePause;
      const neu = await pauseSchreiben(z).catch(() => null);
      if (neu !== null) {
        lokalePause = null;
        nachtragOffen = false;
        zwischen = null;
        if (neu) console.error(`[WA-BREMSE] Pause nachgetragen (${z.art}${z.code ? `, #${z.code}` : ""}, von ${z.von}): ${String(z.fehler ?? "").slice(0, 200)}`);
        if (neu && z.art !== "hand") await alarm(z).catch((e) => console.error("[WA-BREMSE] Alarm (nachgeholt):", e));
        return neu ? z : await waPauseLesen(true);
      }
      return z;
    }
    if (wert.an) { lokalePause = null; nachtragOffen = false; }
    return wert;
  } catch (e) {
    console.error("[WA-BREMSE] Pausenzustand nicht lesbar:", String(e).slice(0, 160));
    // Ohne Datenbank: der letzte bekannte Stand; kein Stand → nicht pausiert (eine DB-Störung legt WhatsApp nicht still).
    const wert = lokalePause ?? zwischen?.wert ?? { ...LEER };
    zwischen = { wert, bis: Date.now() + 10_000 };
    return wert;
  }
}

async function speichern(z: WaPauseZustand): Promise<void> {
  const v = JSON.stringify(z);
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${WA_PAUSE_SCHLUESSEL}, ${v}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${v}, updated_at = NOW()`;
  zwischen = { wert: z, bis: Date.now() + 10_000 };
}

/** Nur schreiben, wenn dort noch keine Pause steht — zwei gleichzeitige Fehler (zwei Instanzen) = genau ein Alarm. */
async function pauseSchreiben(z: WaPauseZustand): Promise<boolean> {
  if (pruefHaken?.verzoegernEinmalMs) {
    const ms = pruefHaken.verzoegernEinmalMs;
    pruefHaken = { ...pruefHaken, verzoegernEinmalMs: 0 };
    await new Promise((r) => setTimeout(r, ms));
  }
  if (pruefHaken?.fehlerEinmal) {
    pruefHaken = { ...pruefHaken, fehlerEinmal: false };
    throw new Error("Prüfstand: Schreiben der Pause gescheitert");
  }
  const v = JSON.stringify(z);
  const r = (await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${WA_PAUSE_SCHLUESSEL}, ${v}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${v}, updated_at = NOW()
     WHERE fiaon_settings.value NOT LIKE '{"an":true%'
    RETURNING key`) as any[];
  if (r.length > 0) zwischen = { wert: z, bis: Date.now() + 10_000 };
  return r.length > 0;
}

function linkAus(text: string): string | null {
  const m = /https?:\/\/[^\s"'<>)]+/i.exec(String(text || ""));
  return m ? m[0].replace(/[.,;]+$/, "") : null;
}

/** Der Satz, den Justin im Band und im Alarm liest. Beginnt IMMER mit „WhatsApp pausiert". */
export function waPauseMeldung(z: Pick<WaPauseZustand, "art" | "code"> | null): string {
  const c = z?.code ? ` (#${z.code})` : "";
  if (!z || z.art === "hand") return "WhatsApp pausiert — im Chefbüro von Hand angehalten. Keine Vorlage geht raus; Antworten im offenen 24-Stunden-Fenster schon.";
  if (z.art === "gesperrt") return `WhatsApp pausiert${c} — ${WA_FEHLER_ART[Number(z.code)]?.satz ?? "Meta hat das Konto gesperrt"}. Nichts geht raus, auch keine Antworten.`;
  if (z.art === "zugang") return `WhatsApp pausiert${c} — der Meta-Zugang (Token) ist ungültig oder abgelaufen. Nichts geht raus, auch keine Antworten.`;
  if (z.art === "spam") return `WhatsApp pausiert${c} — Meta bremst das Konto wegen Spam-Meldungen. Keine Vorlage geht raus; Antworten im offenen 24-Stunden-Fenster schon.`;
  return `WhatsApp pausiert${c} — Meta kann nicht abbuchen. Keine Vorlage geht raus; Antworten im offenen 24-Stunden-Fenster schon.`;
}

export interface PausierenEingabe {
  art: WaPauseArt; code?: number | null; fehler: string; von: string; quelle?: WaPauseZustand["quelle"];
}

/**
 * WhatsApp anhalten. Gegenprüfung 29.09.: Meta bündelt Status in EINER Webhook-Nutzlast
 * (gemessen: 4× #131042), Hand-Lauf und Automatik senden zugleich — zwei Meldungen
 * erreichen die Schwelle im selben Augenblick. Eine zweite, gleichzeitige Meldung wartet
 * auf die erste und bekommt deren Ergebnis (neu = false): genau eine Pause, genau ein Alarm.
 */
export function pausieren(ein: PausierenEingabe): Promise<{ neu: boolean; zustand: WaPauseZustand }> {
  if (pausierFlug) return pausierFlug.then((r) => ({ neu: false, zustand: r.zustand }));
  const flug: Promise<{ neu: boolean; zustand: WaPauseZustand }> = pausierenEinmal(ein)
    .finally(() => { if (pausierFlug === flug) pausierFlug = null; });
  pausierFlug = flug;
  return flug;
}

async function pausierenEinmal(ein: PausierenEingabe): Promise<{ neu: boolean; zustand: WaPauseZustand }> {
  const jetzt = new Date().toISOString();
  const vorher = await waPauseLesen(true);
  if (vorher.an) return { neu: false, zustand: vorher };
  const code = ein.code != null && Number.isFinite(Number(ein.code)) ? Number(ein.code) : null;
  const grund = ein.art === "hand" ? (ein.fehler || "Von Hand angehalten.") : waPauseMeldung({ art: ein.art, code });
  const z: WaPauseZustand = {
    an: true, art: ein.art, code, grund, fehler: String(ein.fehler || "").slice(0, 400), link: linkAus(ein.fehler),
    quelle: ein.quelle ?? (ein.art === "hand" ? "hand" : null),
    seit: jetzt, von: ein.von, aufgehobenAm: null, aufgehobenVon: null,
    verlauf: [{ am: jetzt, was: "pausiert" as const, von: ein.von, grund }, ...vorher.verlauf].slice(0, 20),
  };
  // Automatisch pausiert nur der Produktionsdienst (E-246-Lehre): ein lokales Skript gegen die
  // Produktions-DB legte sonst Mara, Zentrale und Begrüßung für alle still — mit falschem Alarm.
  if (ein.art !== "hand" && !produktion()) {
    const lokal: WaPauseZustand = { ...z, nurLokal: true, verlauf: [] };
    lokalePause = lokal;
    lokalNurHier = true;
    zwischen = { wert: lokal, bis: Date.now() + 10_000 };
    console.error(`[WA-BREMSE] Nur in DIESEM Prozess pausiert (kein Produktionsdienst — nichts gespeichert, kein Alarm): ${z.fehler}`);
    return { neu: true, zustand: lokal };
  }
  lokalePause = z;
  lokalNurHier = false;
  nachtragOffen = false;
  zwischen = { wert: z, bis: Date.now() + 10_000 };
  let gespeichert = false;
  try {
    const neu = await pauseSchreiben(z);
    lokalePause = null;
    if (!neu) {
      zwischen = null;
      return { neu: false, zustand: await waPauseLesen(true) };
    }
    gespeichert = true;
  } catch (e) {
    // Erst JETZT darf waPauseLesen nachtragen — und wer dort schreibt, alarmiert.
    nachtragOffen = true;
    console.error("[WA-BREMSE] Pause nicht gespeichert (gilt in diesem Prozess trotzdem, Alarm folgt beim Nachtragen):", String(e).slice(0, 160));
  }
  console.error(`[WA-BREMSE] PAUSIERT (${ein.art}${code ? `, #${code}` : ""}, von ${ein.von}): ${String(z.fehler ?? "").slice(0, 200)}`);
  if (ein.art !== "hand" && gespeichert) await alarm(z).catch((e) => console.error("[WA-BREMSE] Alarm:", e));
  return { neu: true, zustand: z };
}

function zeitBerlin(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
}

/** Genau EINE dringende Aufgabe an Justin je Pause (Schlüssel wa-pause-<seit>). */
async function alarm(z: WaPauseZustand): Promise<void> {
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const c = z.code ? ` (#${z.code})` : "";
  const titel = z.art === "gesperrt" ? `WhatsApp: Meta hat das Konto gesperrt${c} — alles pausiert`
    : z.art === "zugang" ? `WhatsApp: Meta-Zugang (Token) abgelaufen${c} — alles pausiert`
      : z.art === "spam" ? `WhatsApp: Meta bremst wegen Spam${c} — alle Vorlagen pausiert`
        : `WhatsApp: Meta kann nicht abbuchen${c} — alle Vorlagen pausiert`;
  // Gegenprüfung 29.09.: #190 ist keine Kontosperre — der Weg ist ein neuer Token (fehlerKlartext(190), fiaon-meta.ts).
  const tun = z.art === "gesperrt"
    ? "Im Business-Manager → WhatsApp-Manager → Kontoqualität bzw. Kontostatus nachsehen und die Sperre klären"
    : z.art === "zugang"
      ? "Im Business-Manager → Einstellungen → Systemnutzer einen neuen Token (Ablauf: nie, Rechte whatsapp_business_messaging und whatsapp_business_management) erzeugen und in Render als Umgebungsvariable META_SYSTEM_TOKEN eintragen (der Dienst startet neu)"
      : z.art === "spam"
      ? "Im Business-Manager → WhatsApp-Manager → Kontoqualität nachsehen, warum Meta bremst; Automatik und Verkaufstakt vorsichtig wieder anlaufen lassen"
      : "Business-Manager → Abrechnung und Zahlungen → Zahlungsmethode des WhatsApp-Kontos prüfen und die offene Zahlung begleichen";
  const text = [
    `${titel}. ${tun}, dann /chef/s/mara → ‚WhatsApp wieder aktivieren'.`,
    "",
    `Seit ${zeitBerlin(z.seit)} · ausgelöst über ${z.quelle === "webhook" ? "den Status-Webhook von Meta" : z.quelle === "senden" ? "die Antwort beim Senden" : "—"} · Meta meldet: ${String(z.fehler || "").slice(0, 240)}`,
    z.link ? `Metas Link aus der Fehlermeldung: ${z.link}` : "",
    "",
    waAllesZu(z.art)
      ? "Was steht: jede WhatsApp — Vorlagen auf allen Wegen (Zentrale, Automatik, Begrüßung, Lead-Kette, Verkaufstakt, Telefonkartei, Akte, Raum, Mara-Auftrag) UND Maras Antworten. Mara denkt in der Zeit gar nicht (keine KI-Kosten); offene Gespräche holt sie nach dem Aktivieren nach."
      : "Was steht: alle Vorlagen auf allen Wegen (Zentrale, Automatik, Begrüßung, Lead-Kette, Verkaufstakt, Telefonkartei, Akte, Raum, Mara-Auftrag). Was weiterläuft: Maras Antworten und freier Text im offenen 24-Stunden-Fenster, Mail und Telefon.",
    "Nichts geht als Ersatz an Kunden (keine Mail, keine SMS statt der WhatsApp). Wer heute eine Vorlage bekommen hätte, kommt nach dem Aktivieren von selbst wieder dran — gescheiterte Vorlagen zählen nicht als Kontakt.",
    z.art === "zugang"
      ? "Vor dem Aktivieren fragt das System Meta mit dem Token nach dem Kontostand (ohne Nachricht). Lehnt Meta den Token weiter ab (#190) oder antwortet gar nicht, bleibt die Pause."
      : "Vor dem Aktivieren fragt das System Meta nach dem Kontostand (health_status, ohne Nachricht). Sagt Meta „gesperrt“, bleibt die Pause.",
  ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  await auftragFuerKunden({
    personId: null, ref: null, anBetreiber: true, dringend: true,
    titel, text, quelle: "wa-pause", bereich: "technik", link: WA_PAUSE_KLICKWEG,
    schluessel: `wa-pause-${z.seit}`, autorName: "System",
  } as any);
}

// ── Kontofehler melden (Webhook + Senden) ───────────────────────────────────
let kontofehlerBereit: Promise<void> | null = null;
function kontofehlerTabelle(): Promise<void> {
  if (!kontofehlerBereit) {
    kontofehlerBereit = (async () => {
      // Dieselben Anweisungen wie Migration 086 — für frische Datenbanken (über die DDL-Wache).
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_wa_kontofehler (
          id BIGSERIAL PRIMARY KEY,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          code INTEGER NOT NULL,
          art TEXT NOT NULL,
          quelle TEXT NOT NULL,
          wa_id TEXT, nummer TEXT, person_id INTEGER, vorlage TEXT,
          text TEXT,
          gesendet_am TIMESTAMPTZ
        )`;
      // Gegenprüfung 29.09.: die Sendezeit der Nachricht — späte Webhooks alter Sendungen zählen nicht (Kopf dieser Datei).
      await sqlPool`ALTER TABLE fiaon_wa_kontofehler ADD COLUMN IF NOT EXISTS gesendet_am TIMESTAMPTZ`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_wa_kontofehler_code_am ON fiaon_wa_kontofehler (code, am DESC)`;
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_wa_kontofehler_wa_code ON fiaon_wa_kontofehler (wa_id, code) WHERE wa_id IS NOT NULL`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      kontofehlerBereit = null;
      throw e;
    });
  }
  return kontofehlerBereit;
}

/** Außerhalb des Produktionsdienstes: Fehler nur im Speicher zählen (nie in die Produktions-DB). */
const lokaleFehler: { code: number; am: number; waId: string | null; gesendetAm: number | null }[] = [];

export interface KontofehlerMeldung {
  code: number | null | undefined;
  quelle: "webhook" | "senden";
  waId?: string | null;
  nummer?: string | null;
  personId?: number | null;
  vorlage?: string | null;
  text?: string | null;
  /**
   * Wann die Nachricht an Meta ging (fiaon_whatsapp.gesendet_am) — nur beim Webhook bekannt.
   * Lag sie VOR dem letzten „wieder aktivieren", steht die Meldung in der Tabelle, zählt aber nicht.
   */
  gesendetAm?: Date | string | null;
}

/**
 * Einen Fehler von Meta melden — aus dem Status-Webhook und aus waSenden.
 * Schreibt jede Meldung in fiaon_wa_kontofehler (nur Produktionsdienst) und
 * pausiert nach der Schwelle. Wirft NIE (der Webhook antwortet weiter in
 * Millisekunden). `pausiert` = diese Meldung hat die Pause ausgelöst.
 */
export async function kontofehlerMelden(ein: KontofehlerMeldung, lauf: Lauf = sqlPool): Promise<{ art: WaFehlerArt; gezaehlt: number; pausiert: boolean; doppelt?: boolean }> {
  const code = Number(ein.code);
  if (!Number.isFinite(code) || code <= 0) return { art: "sonst", gezaehlt: 0, pausiert: false };
  const art = waFehlerArt(code);
  const waId = ein.waId ? String(ein.waId).slice(0, 200) : null;
  try {
    const regel = pauseRegel(code);
    const p = await waPauseLesen();
    // Gezählt wird ab dem letzten Aktivieren — nach Eingang der Meldung UND nach Sendezeit der Nachricht:
    // ein später (von Meta wiederholter) Webhook einer Sendung von VOR der Pause legt nichts neu still.
    const aktiviert = p.aufgehobenAm && !p.an ? Date.parse(p.aufgehobenAm) : 0;
    const ab = Math.max(Date.now() - WA_SCHWELLE_MINUTEN * 60_000, aktiviert);
    const gesendetMs = ein.gesendetAm ? new Date(ein.gesendetAm).getTime() : NaN;
    const gesendetAm = Number.isFinite(gesendetMs) ? new Date(gesendetMs) : null;
    let gezaehlt = 0;
    if (produktion()) {
      await kontofehlerTabelle();
      const neu = (await lauf`
        INSERT INTO fiaon_wa_kontofehler (code, art, quelle, wa_id, nummer, person_id, vorlage, text, gesendet_am)
        VALUES (${code}, ${art}, ${ein.quelle}, ${waId}, ${ein.nummer ?? null}, ${ein.personId ?? null}, ${ein.vorlage ?? null},
                ${ein.text ? String(ein.text).slice(0, 400) : null}, ${gesendetAm})
        ON CONFLICT (wa_id, code) WHERE wa_id IS NOT NULL DO NOTHING
        RETURNING id`) as any[];
      if (!neu.length) return { art, gezaehlt: 0, pausiert: false, doppelt: true };
      if (!regel) return { art, gezaehlt: 0, pausiert: false };
      const [z] = (await lauf`
        SELECT COUNT(*)::int AS n FROM fiaon_wa_kontofehler
         WHERE code = ${code} AND am >= ${new Date(ab)}
           AND (gesendet_am IS NULL OR gesendet_am >= ${new Date(aktiviert)})`) as any[];
      gezaehlt = Number(z?.n || 0);
    } else {
      if (waId && lokaleFehler.some((f) => f.waId === waId && f.code === code)) return { art, gezaehlt: 0, pausiert: false, doppelt: true };
      lokaleFehler.push({ code, am: Date.now(), waId, gesendetAm: gesendetAm ? gesendetAm.getTime() : null });
      while (lokaleFehler.length > 500) lokaleFehler.shift();
      if (!regel) return { art, gezaehlt: 0, pausiert: false };
      gezaehlt = lokaleFehler.filter((f) => f.code === code && f.am >= ab && (f.gesendetAm === null || f.gesendetAm >= aktiviert)).length;
    }
    if (gesendetAm && aktiviert && gesendetAm.getTime() < aktiviert) {
      console.warn(`[WA-BREMSE] Später Webhook #${code} einer Sendung von vor dem Aktivieren (${gesendetAm.toISOString()}) — nur vermerkt, nicht gezählt.`);
    }
    if (gezaehlt < regel.ab || p.an) return { art, gezaehlt, pausiert: false };
    const r = await pausieren({
      art: regel.art, code, von: "automatisch", quelle: ein.quelle,
      fehler: String(ein.text || WA_FEHLER_ART[code]?.satz || `Meta-Fehler #${code}`),
    });
    return { art, gezaehlt, pausiert: r.neu };
  } catch (e) {
    console.error("[WA-BREMSE] Kontofehler melden:", String((e as Error)?.message || e).slice(0, 200));
    return { art, gezaehlt: 0, pausiert: false };
  }
}

// ── Wieder aktivieren (mit Probe ohne Nachricht) ────────────────────────────
export type WaGesundheit = { kann: "AVAILABLE" | "LIMITED" | "BLOCKED" | null; text: string | null };

function gesundheitAus(h: any): WaGesundheit {
  const kann = String(h?.can_send_message ?? "").toUpperCase();
  const fehler: string[] = [];
  for (const e of Array.isArray(h?.entities) ? h.entities : []) {
    for (const f of Array.isArray(e?.errors) ? e.errors : []) {
      const t = [f?.error_description, f?.possible_solution].filter(Boolean).join(" — ");
      if (t) fehler.push(`${e?.entity_type ?? "?"}${f?.error_code ? ` #${f.error_code}` : ""}: ${t}`);
    }
  }
  for (const f of Array.isArray(h?.errors) ? h.errors : []) {
    const t = [f?.error_description, f?.possible_solution].filter(Boolean).join(" — ");
    if (t) fehler.push(`${f?.error_code ? `#${f.error_code}: ` : ""}${t}`);
  }
  return {
    kann: kann === "AVAILABLE" || kann === "LIMITED" || kann === "BLOCKED" ? kann : null,
    text: fehler.length ? fehler.join(" · ").slice(0, 400) : null,
  };
}

const RANG_GESUND: Record<string, number> = { AVAILABLE: 1, LIMITED: 2, BLOCKED: 3 };

export type WaProbe = WaGesundheit & {
  status: string | null; qualitaet: string | null;
  /** Mindestens eine der beiden Abfragen kam ohne Fehler zurück (der Token gilt). */
  antwort: boolean;
  /** Meta lehnte den Token ab (#190). */
  zugangFehler: boolean;
};

/**
 * Metas Kontostand — nur lesend, keine Nachricht: health_status am WhatsApp-Konto
 * und an der Nummer. Das Schlechtere gilt. kann = null: nicht lesbar (Feld fehlt, Netz).
 * `antwort`/`zugangFehler` sagen, ob Meta den Token angenommen hat (Pause „zugang", #190).
 */
export async function gesundheitLesen(): Promise<WaProbe> {
  const { waKonfig } = await import("./fiaon-whatsapp");
  const { graph } = await import("./fiaon-meta");
  const k = waKonfig();
  const teile: WaGesundheit[] = [];
  let status: string | null = null, qualitaet: string | null = null;
  let antwort = false, zugangFehler = false;
  const fehlerMerken = (wo: string, e: unknown) => {
    if (Number((e as any)?.code) === 190) zugangFehler = true;
    console.warn(`[WA-BREMSE] health_status (${wo}) nicht lesbar:`, String((e as Error)?.message || e).slice(0, 160));
  };
  if (k.wabaId) {
    try { const j = await graph(k.wabaId, { params: { fields: "health_status" }, zeitMs: 8000 }); antwort = true; if (j?.health_status) teile.push(gesundheitAus(j.health_status)); }
    catch (e) { fehlerMerken("Konto", e); }
  }
  if (k.nummerId) {
    try {
      const j = await graph(k.nummerId, { params: { fields: "health_status,status,quality_rating" }, zeitMs: 8000 });
      antwort = true;
      if (j?.health_status) teile.push(gesundheitAus(j.health_status));
      status = j?.status ? String(j.status) : null;
      qualitaet = j?.quality_rating ? String(j.quality_rating) : null;
    } catch (e) { fehlerMerken("Nummer", e); }
  }
  const lesbar = teile.filter((t) => t.kann);
  if (!lesbar.length) return { kann: null, text: teile.map((t) => t.text).filter(Boolean).join(" · ") || null, status, qualitaet, antwort, zugangFehler };
  const schlimmst = lesbar.reduce((a, b) => (RANG_GESUND[b.kann!] > RANG_GESUND[a.kann!] ? b : a));
  const text = teile.map((t) => t.text).filter(Boolean).join(" · ") || null;
  return { kann: schlimmst.kann, text, status, qualitaet, antwort, zugangFehler };
}

export async function aktivieren(von: string, opt: { probe?: boolean } = {}): Promise<{ ok: boolean; zustand: WaPauseZustand; hinweis?: string; fehler?: string }> {
  const vorher = await waPauseLesen(true);
  if (!vorher.an) return { ok: true, zustand: vorher, hinweis: "WhatsApp war nicht pausiert — nichts geändert." };
  if (lokalNurHier && lokalePause && vorher === lokalePause) {
    lokalePause = null; lokalNurHier = false; zwischen = null;
    return { ok: true, zustand: await waPauseLesen(true), hinweis: "Nur in diesem Prozess pausiert gewesen — aufgehoben, nichts gespeichert." };
  }
  let hinweis: string | undefined;
  // Pause „zugang" (#190): immer mit Probe — aktiviert wird nur, wenn Meta den Token wieder annimmt.
  if (opt.probe !== false || vorher.art === "zugang") {
    const g = await gesundheitLesen().catch((): WaProbe => ({ kann: null, text: null, status: null, qualitaet: null, antwort: false, zugangFehler: false }));
    const bleibt = async (t: string) => {
      const jetzt = new Date().toISOString();
      const z: WaPauseZustand = {
        ...vorher, an: true,
        verlauf: [{ am: jetzt, was: "probe_gescheitert" as const, von, grund: t.slice(0, 200) }, ...vorher.verlauf].slice(0, 20),
      };
      await speichern(z).catch(() => {});
      return { ok: false, zustand: z, fehler: `${t.slice(0, 300)} — die Pause bleibt.` };
    };
    // Gegenprüfung 29.09.: Mit ungültigem Token aktivierte die Probe („unklar"), die nächste Sendung pausierte
    // sofort wieder — mit einer neuen Aufgabe je Durchgang. Lehnt Meta den Token ab, bleibt jede Pause.
    if (g.zugangFehler) {
      return bleibt("Meta lehnt den Zugang weiter ab (#190): Der Token in Render (META_SYSTEM_TOKEN) ist noch nicht erneuert, oder der Dienst ist noch nicht neu gestartet");
    }
    if (vorher.art === "zugang" && !g.antwort) {
      return bleibt("Meta hat auf die Probe nicht geantwortet — ob der neue Token gilt, ist offen. In einer Minute noch einmal versuchen");
    }
    if (g.kann === "BLOCKED") {
      return bleibt(g.text ? `Meta meldet: ${g.text}` : "Meta meldet: Senden gesperrt (can_send_message = BLOCKED).");
    }
    if (g.kann === "LIMITED") hinweis = `Aktiviert — Meta meldet das Konto aber als eingeschränkt (LIMITED)${g.text ? `: ${g.text.slice(0, 200)}` : ""}. Kommt wieder ein Kontofehler, pausiert es von selbst erneut.`;
    else if (!g.kann) hinweis = "Probe unklar (Metas Kontostand nicht lesbar) — trotzdem aktiviert. Kommt wieder ein Kontofehler, pausiert es von selbst erneut.";
  }
  const jetzt = new Date().toISOString();
  const z: WaPauseZustand = {
    ...vorher, an: false, aufgehobenAm: jetzt, aufgehobenVon: von,
    verlauf: [{ am: jetzt, was: "aktiviert" as const, von, grund: vorher.grund }, ...vorher.verlauf].slice(0, 20),
  };
  lokalePause = null; lokalNurHier = false; nachtragOffen = false;
  await speichern(z);
  console.log(`[WA-BREMSE] AKTIVIERT von ${von} (Pause seit ${vorher.seit ?? "—"}).`);
  // Nichts eigens nachholen: gescheiterte Vorlagen zählen in der Zentrale nicht als Kontakt, die Menschen kommen
  // von selbst wieder dran; offene Gespräche nimmt der Takt mara_wa_nachholen (jede Minute). Nach einer Kontosperre
  // oder einem abgelaufenen Zugang (Mara hat gar nicht gedacht): erst die Sammelaufgabe für Nachrichten aus der
  // Sperrzeit, die älter als 12 Stunden sind (auch über 23,5 h — die sieht der Nachhol-Takt nicht mehr;
  // Gegenprüfung 29.09.), dann den Nachhol-Lauf anstoßen. Der Takt wiederholt die Sammlung 24 h lang.
  if (waAllesZu(vorher.art)) {
    void import("./fiaon-whatsapp-mara")
      .then(async (m) => { await m.zuAltFuerMara(vorher.seit, "wa").catch((e) => console.error("[WA-BREMSE] Sammelaufgabe:", e)); await m.nachholLauf(); })
      .catch((e) => console.error("[WA-BREMSE] Nachholen:", e));
  }
  void metaStandAuffrischen("aktivieren").catch(() => {});
  return { ok: true, zustand: z, hinweis };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER META-STAND (fiaon_settings.wa_meta_stand) — Qualität, Stufe, Kontostand
// ═══════════════════════════════════════════════════════════════════════════
export interface WaMetaStand {
  qualitaet: string | null;
  stufe: string | null;
  name: string | null;
  gesundheit: WaGesundheit | null;
  am: string | null;
  quelle: string | null;
  /** Wechsel der Qualität — neueste zuerst, höchstens 20. */
  verlauf: { am: string; von: string | null; zu: string | null }[];
  /** Nur in diesem Prozess gelesen (kein Produktionsdienst) — nie gespeichert. */
  nurLokal?: boolean;
}
const STAND_LEER: WaMetaStand = { qualitaet: null, stufe: null, name: null, gesundheit: null, am: null, quelle: null, verlauf: [] };

let standZwischen: { wert: WaMetaStand; bis: number } | null = null;
let standLokal: WaMetaStand | null = null;
let frischFlug: Promise<{ stand: WaMetaStand; geaendert: boolean }> | null = null;
/** Wann Meta zuletzt nichts lieferte — dann höchstens alle 2 Minuten ein neuer Versuch beim Lesen (sonst wartete jede Vorlage). */
let letzterFehlversuch = 0;

function standLesen(roh: unknown): WaMetaStand {
  if (!roh) return { ...STAND_LEER, verlauf: [] };
  try {
    const j = typeof roh === "string" ? JSON.parse(roh) : roh;
    return { ...STAND_LEER, ...j, verlauf: Array.isArray(j?.verlauf) ? j.verlauf.slice(0, 20) : [] };
  } catch { return { ...STAND_LEER, verlauf: [] }; }
}

async function standAusDb(): Promise<WaMetaStand> {
  if (standZwischen && standZwischen.bis > Date.now()) return standZwischen.wert;
  try {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${WA_META_STAND_SCHLUESSEL} LIMIT 1`) as any[];
    const wert = standLesen(r?.value);
    standZwischen = { wert, bis: Date.now() + 10_000 };
    return wert;
  } catch (e) {
    console.error("[WA-BREMSE] Meta-Stand nicht lesbar:", String(e).slice(0, 160));
    const wert = standZwischen?.wert ?? { ...STAND_LEER, verlauf: [] };
    standZwischen = { wert, bis: Date.now() + 10_000 };
    return wert;
  }
}

const neuer = (a: WaMetaStand, b: WaMetaStand | null) => (b?.am && (!a.am || b.am > a.am) ? b : a);

/**
 * Der gespeicherte Stand — für alle Instanzen derselbe (10 s zwischengespeichert).
 * Älter als 15 Minuten (oder nie gelesen) → einmal frisch bei Meta (8 s Zeitgrenze);
 * scheitert das, gilt der letzte Stand. Unbekannt → keine Bremse.
 */
export async function metaStandLesen(opts: { frisch?: boolean } = {}): Promise<WaMetaStand> {
  const wert = neuer(await standAusDb(), standLokal);
  const alt = !wert.am || Date.now() - Date.parse(wert.am) > WA_STAND_ALT_MIN * 60_000;
  if (!opts.frisch && !alt) return wert;
  // Meta eben nicht erreichbar: nicht bei jeder Vorlage neu fragen — der letzte Stand gilt (unbekannt → keine Bremse).
  if (!opts.frisch && Date.now() - letzterFehlversuch < 2 * 60_000) return wert;
  // Höchstens 8 Sekunden warten (graph wiederholt bei Netzfehlern) — danach gilt der letzte Stand, das Lesen läuft weiter.
  const flug = metaStandAuffrischen(opts.frisch ? "von_hand" : "lesen").then((r) => r.stand).catch(() => wert);
  let uhr: ReturnType<typeof setTimeout> | undefined;
  const grenze = new Promise<WaMetaStand>((res) => { uhr = setTimeout(() => res(wert), 8_000); });
  try { return await Promise.race([flug, grenze]); } finally { if (uhr) clearTimeout(uhr); }
}

/**
 * Qualität, Stufe und Kontostand frisch bei Meta lesen (nur GET) und ablegen.
 * Im Produktionsdienst in fiaon_settings, sonst nur im Speicher dieses Prozesses.
 * Wechsel der Qualität → Verlaufseintrag; Wechsel auf ROT → eine Aufgabe an Justin.
 * `geaendert` = die Qualität hat sich geändert (für die Historie des Takts).
 */
export async function metaStandAuffrischen(quelle = "takt"): Promise<{ stand: WaMetaStand; geaendert: boolean }> {
  if (frischFlug) return frischFlug;
  frischFlug = (async () => {
    const vorher = neuer(await standAusDb(), standLokal);
    const { waKonfig } = await import("./fiaon-whatsapp");
    const { graph } = await import("./fiaon-meta");
    const k = waKonfig();
    let stufe: string | null = null, qualitaet: string | null = null, name: string | null = null;
    if (k.nummerId) {
      try {
        const j = await graph(k.nummerId, { params: { fields: "messaging_limit_tier,quality_rating,verified_name" }, zeitMs: 8000 });
        stufe = j?.messaging_limit_tier ? String(j.messaging_limit_tier) : null;
        qualitaet = j?.quality_rating ? String(j.quality_rating) : null;
        name = j?.verified_name ? String(j.verified_name) : null;
      } catch (e) {
        console.warn("[WA-BREMSE] Meta-Stand nicht lesbar:", String((e as Error)?.message || e).slice(0, 160));
      }
    }
    // E-250: Die Stufe steht heute am WhatsApp-Konto, nicht mehr an der Nummer.
    if (!stufe && k.wabaId) {
      try {
        const j = await graph(k.wabaId, { params: { fields: "whatsapp_business_manager_messaging_limit" }, zeitMs: 8000 });
        stufe = j?.whatsapp_business_manager_messaging_limit ? String(j.whatsapp_business_manager_messaging_limit) : null;
      } catch (e) {
        console.warn("[WA-BREMSE] Meta-Stufe am Konto nicht lesbar:", String((e as Error)?.message || e).slice(0, 160));
      }
    }
    let gesundheit: WaGesundheit | null = null;
    if (k.wabaId) {
      try {
        const j = await graph(k.wabaId, { params: { fields: "health_status" }, zeitMs: 8000 });
        if (j?.health_status) gesundheit = gesundheitAus(j.health_status);
      } catch { /* health_status ist Zusatz — ohne ihn bleibt die Bremse bei Qualität und Kontofehlern */ }
    }
    // Nichts lesbar (Netz, Zugang): der letzte Stand bleibt stehen, nichts wird überschrieben.
    if (!qualitaet && !stufe && !gesundheit) { letzterFehlversuch = Date.now(); return { stand: vorher, geaendert: false }; }
    letzterFehlversuch = 0;
    const jetzt = new Date().toISOString();
    const geaendert = !!qualitaet && qualitaet !== vorher.qualitaet;
    const stand: WaMetaStand = {
      qualitaet: qualitaet ?? vorher.qualitaet, stufe: stufe ?? vorher.stufe, name: name ?? vorher.name,
      gesundheit: gesundheit ?? vorher.gesundheit, am: jetzt, quelle,
      verlauf: geaendert ? [{ am: jetzt, von: vorher.qualitaet, zu: qualitaet }, ...vorher.verlauf].slice(0, 20) : vorher.verlauf,
    };
    if (!produktion()) {
      standLokal = { ...stand, nurLokal: true };
      return { stand: standLokal, geaendert };
    }
    const v = JSON.stringify(stand);
    try {
      await sqlPool`
        INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${WA_META_STAND_SCHLUESSEL}, ${v}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${v}, updated_at = NOW()`;
      standZwischen = { wert: stand, bis: Date.now() + 10_000 };
    } catch (e) {
      console.error("[WA-BREMSE] Meta-Stand nicht gespeichert:", String(e).slice(0, 160));
      standLokal = stand;
    }
    if (geaendert) {
      console.log(`[WA-BREMSE] Meta-Qualität ${vorher.qualitaet ?? "unbekannt"} → ${qualitaet} (${quelle}).`);
      if (qualitaet === "RED") await rotAlarm(stand, vorher.qualitaet).catch((e) => console.error("[WA-BREMSE] ROT-Alarm:", e));
    }
    return { stand, geaendert };
  })().finally(() => { frischFlug = null; });
  return frischFlug;
}

async function rotAlarm(stand: WaMetaStand, vorher: string | null): Promise<void> {
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const tag = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  await auftragFuerKunden({
    personId: null, ref: null, anBetreiber: true, dringend: true,
    titel: "WhatsApp: Meta bewertet die Nummer mit ROT — Werbe-Vorlagen gestoppt",
    text: [
      `Meta-Qualität ${vorher ?? "unbekannt"} → ROT (${zeitBerlin(stand.am)}).`,
      "Was jetzt gilt: Keine Werbe-Vorlage an bestehende Kontakte — auf keinem Weg (Zentrale, Automatik, Lead-Kette, Verkaufstakt, Telefonkartei, Akte, Raum, Mara-Auftrag). Die Zentrale schickt nur noch die Monatsrate (auch keine Termin-Einladung an Lead-Gruppen); die Begrüßung frischer Leads (Formular ≤ 24 h), einzelne Termin-Nachrichten aus Akte und Raum und Antworten im offenen Fenster laufen weiter.",
      "Sobald Meta wieder GELB oder GRÜN meldet, läuft die Werbung von selbst wieder an (GELB halbiert). Im Business-Manager → WhatsApp-Manager → Kontoqualität steht, welche Vorlagen Meta abwertet.",
    ].join("\n"),
    quelle: "wa-pause", bereich: "technik", link: WA_PAUSE_KLICKWEG,
    schluessel: `wa-rot-${tag}`, autorName: "System",
  } as any);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE REGEL
// ═══════════════════════════════════════════════════════════════════════════
/** Werbung? Unsere Regel ODER Metas Kategorie MARKETING (Textfassung oder Bildfassung). */
export async function vorlageIstWerbung(name: string): Promise<boolean> {
  const n = String(name || "").trim();
  const { waVorlageWerblich } = await import("./fiaon-mail-frequenz");
  if (waVorlageWerblich(n)) return true;
  try {
    const { vorlagenKategorien } = await import("./fiaon-whatsapp");
    const k = await vorlagenKategorien();
    const bild = n.replace(/^fiaon_kk_/, "fiaon_kkb_");
    const text = n.replace(/^fiaon_kkb_/, "fiaon_kk_");
    return [n, bild, text].some((x) => String(k.get(x) ?? "").toUpperCase() === "MARKETING");
  } catch {
    return false; // Metas Kategorie nicht lesbar: unsere Regel gilt
  }
}

/** Der Satz bei ROT — Aufrufer und Anzeige erkennen ihn am Anfang „Meta-Qualität ROT". */
export const WA_ROT_SATZ = "Meta-Qualität ROT — Werbe-Vorlagen gehen gerade nicht raus. Monatsrate, einzelne Termin-Nachrichten (Akte, Raum), die Begrüßung frischer Leads und Antworten im offenen Fenster laufen weiter.";

export interface WaBremseErgebnis {
  erlaubt: boolean;
  /** Beginnt mit „WhatsApp pausiert" oder „Meta-Qualität ROT" — null, wenn erlaubt. */
  grund: string | null;
  /** 1 = voll, 0,5 = GELB (für Automatik, Lead-Kette, Verkaufstakt, Hand-Lauf). */
  faktor: number;
  /** true = die Notbremse (nicht die Qualität) hält an. */
  pause: boolean;
  art: WaPauseArt | null;
  qualitaet: string | null;
  werbung: boolean;
}

/**
 * Darf das raus? `vorlage` = Name der Vorlage; `text` = freier Text im offenen
 * Fenster; `werbung` = „irgendeine Werbe-Vorlage" (Lead-Kette, Verkaufstakt,
 * Tagesplatz ohne Namen). Ohne Angabe gilt es als Werbe-Vorlage (die strengste Lesart).
 * `weg` steht nur im Log. Liest vor einer Pause-Entscheidung NIE bei Meta.
 */
export async function waBremse(ein: { vorlage?: string | null; text?: boolean; werbung?: boolean; weg?: string | null; frischerLead?: boolean } = {}): Promise<WaBremseErgebnis> {
  const istText = ein.text === true && !ein.vorlage;
  const p = await waPauseLesen();
  if (p.an) {
    const art = p.art ?? "hand";
    if (waAllesZu(art) || !istText) {
      return { erlaubt: false, grund: waPauseMeldung(p), faktor: 0, pause: true, art, qualitaet: null, werbung: !istText };
    }
    return { erlaubt: true, grund: null, faktor: 1, pause: true, art, qualitaet: null, werbung: false };
  }
  if (istText) return { erlaubt: true, grund: null, faktor: 1, pause: false, art: null, qualitaet: null, werbung: false };
  const werbung = ein.werbung === true || !ein.vorlage ? true : await vorlageIstWerbung(String(ein.vorlage));
  const stand = await metaStandLesen().catch(() => ({ ...STAND_LEER }));
  const q = stand.qualitaet ? String(stand.qualitaet).toUpperCase() : null;
  // Justin (29.09.2026): Die Begrüßung eines FRISCHEN Leads (Formular ≤ 24 h) läuft auch bei ROT — er hat eben
  // selbst um Kontakt gebeten, antwortet am häufigsten und senkt die Qualität nicht; gestoppt wird die Werbung an
  // alte Kontakte (Zentrale, Kette, Verkaufstakt …). Die Pause (oben) hält auch die Begrüßung an.
  if (q === "RED" && werbung && !ein.frischerLead) {
    return { erlaubt: false, grund: WA_ROT_SATZ, faktor: 0, pause: false, art: null, qualitaet: q, werbung };
  }
  return { erlaubt: true, grund: null, faktor: q === "YELLOW" && werbung ? WA_FAKTOR_GELB : 1, pause: false, art: null, qualitaet: q, werbung };
}

/** Ein Wert × Faktor, aufgerundet (GELB: 25 → 13) — nie unter 0. */
export function mitFaktor(wert: number, faktor: number): number {
  return Math.max(0, Math.ceil(Math.max(0, Number(wert) || 0) * Math.max(0, Math.min(1, faktor))));
}

/** Die Lage in Worten — für Steuerpult, Zentrale und den Hinweis im WhatsApp-Raum. */
export async function waBremseLage(): Promise<{
  pause: WaPauseZustand; stand: WaMetaStand; qualitaet: string | null; faktor: number;
  werbungGestoppt: boolean; allesGestoppt: boolean; satz: string | null;
}> {
  const [pause, stand] = await Promise.all([waPauseLesen(), metaStandLesen().catch(() => ({ ...STAND_LEER }))]);
  const q = stand.qualitaet ? String(stand.qualitaet).toUpperCase() : null;
  const allesGestoppt = pause.an && waAllesZu(pause.art);
  const werbungGestoppt = pause.an || q === "RED";
  const faktor = pause.an ? 0 : q === "YELLOW" ? WA_FAKTOR_GELB : 1;
  const satz = pause.an ? waPauseMeldung(pause)
    : q === "RED" ? "Meta-Qualität ROT: Werbe-Vorlagen gestoppt — die Zentrale schickt nur noch die Monatsrate; die Begrüßung frischer Leads, einzelne Termin-Nachrichten (Akte, Raum) und Antworten im offenen Fenster laufen weiter."
      : q === "YELLOW" ? "Meta-Qualität GELB: Automatik, Lead-Kette, Verkaufstakt und Hand-Lauf halbiert."
        : null;
  return { pause, stand, qualitaet: q, faktor, werbungGestoppt, allesGestoppt, satz };
}

/** Nur für Prüfstände: Zwischenspeicher und Speicherstände vergessen. */
export function waBremseZwischenspeicherLeeren(): void {
  zwischen = null;
  lokalePause = null;
  lokalNurHier = false;
  nachtragOffen = false;
  pausierFlug = null;
  pruefHaken = null;
  standZwischen = null;
  standLokal = null;
  letzterFehlversuch = 0;
  lokaleFehler.length = 0;
}
