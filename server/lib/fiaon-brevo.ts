// ═══════════════════════════════════════════════════════════════════════════
// BREVO — die einzige Stelle, an der wir Zustellung ERFAHREN können
//
// WARUM DAS NÖTIG IST
// Bisher endete unser Wissen bei „Make hat die Anfrage angenommen". Das ist
// keine Zustellung. Zwischen Make und dem Postfach des Kunden liegen zwei
// Stationen, an denen alles scheitern kann: der Zweig im Make-Szenario (fehlt
// er, verpufft die Anfrage lautlos mit HTTP 200) und die Vorlage in Brevo
// (ist sie inaktiv, wird nichts gerendert). Beide Fehler sehen von unserer
// Seite identisch aus — und genau deshalb darf man sie nicht raten.
//
// Brevo weiß es. Die Transactional-Events-API sagt für jede Adresse, ob eine
// Mail angenommen, zugestellt, geöffnet, gebounct oder blockiert wurde. Diese
// Datei holt diese Wahrheit ab.
//
// OHNE SCHLÜSSEL KEIN CRASH
// `BREVO_API_KEY` ist heute nirgends gesetzt. Jede Funktion hier gibt dann
// einen sauberen Zustand zurück, den die Oberfläche anzeigen kann — kein
// Fehler, kein leerer Bildschirm.
// ═══════════════════════════════════════════════════════════════════════════

import { brevoKlartext, brevoNichtEingerichtet, type BrevoKlartext } from "./fiaon-brevo-fehler";
import { markeMailImg } from "@shared/fiaon-marke";

const BASIS = "https://api.brevo.com/v3";

export function brevoKonfiguriert(): boolean {
  return !!process.env.BREVO_API_KEY;
}

/** Der Hinweis, den die Oberfläche zeigt, solange der Schlüssel fehlt. */
export const OHNE_SCHLUESSEL =
  "Zustellprüfung braucht den Brevo-API-Schlüssel. Lege ihn als BREVO_API_KEY in den "
  + "Umgebungsvariablen ab (Brevo → SMTP & API → API Keys), dann kann die Plattform bei "
  + "Brevo nachsehen, ob eine Mail wirklich angekommen ist.";

/**
 * DIE EINE STELLE, durch die jeder Brevo-Aufruf geht.
 *
 * Sie liefert neben `grund` (ein Satz für Protokolle) jetzt auch `klartext` —
 * Titel, Anleitung und die rohe Antwort. Der Vorgesetzte sah bis zum 11.08.2026
 * in der Mail-Zentrale die nackte API-Antwort („Unrecognised IP address …
 * unauthorized"). Das ist kein Programmfehler, sondern eine EINSTELLUNG mit
 * bekannter Lösung — also gehört die Lösung in die Meldung.
 */
async function brevo<T>(pfad: string, init: RequestInit = {}): Promise<
  { ok: true; daten: T } | { ok: false; grund: string; klartext: BrevoKlartext }
> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    const k = brevoNichtEingerichtet();
    return { ok: false, grund: OHNE_SCHLUESSEL, klartext: k };
  }
  try {
    const res = await fetch(`${BASIS}${pfad}`, {
      ...init,
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json", ...(init.headers || {}) },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const k = brevoKlartext(res.status, text);
      return {
        ok: false,
        // Der Titel ist der Satz, der überall angezeigt werden kann.
        grund: k.titel,
        klartext: k,
      };
    }
    return { ok: true, daten: (await res.json()) as T };
  } catch (err) {
    const k = brevoKlartext(0, err instanceof Error ? err.message : String(err));
    return { ok: false, grund: k.titel, klartext: k };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Vorlagen
// ───────────────────────────────────────────────────────────────────────────

export interface BrevoVorlage {
  id: number;
  name: string;
  betreff: string;
  aktiv: boolean;
}

/**
 * Hebt die Versandsperre einer Adresse bei Brevo auf (18.09.2026, Team-Feedback
 * Priorität 4: „Die KI darf nicht über dem Menschen stehen").
 *
 * Nach einem Rückläufer oder einer Spam-Meldung setzt Brevo die Adresse auf die
 * Sperrliste für Transaktionsmails — jede weitere Mail wird still verworfen.
 * Schickt ein Mitarbeiter von Hand, hat er meist gerade mit dem Kunden
 * gesprochen („ich habe nichts bekommen"). Dann muss die Mail ankommen können.
 * 204 = aufgehoben, 404 = war nicht gesperrt — beides ist Erfolg.
 * true nur bei „aufgehoben" (brevoSperreAufhebenBefund, unten) — für den Handversand reicht das.
 */
export async function brevoSperreAufheben(email: string): Promise<boolean> {
  return (await brevoSperreAufhebenBefund(email)).ergebnis === "aufgehoben";
}

/**
 * DREI ANTWORTEN STATT ZWEI (08.10.2026, Zahlungspost-Freigabe, zweite Prüfung). Vorher hieß jede Störung „false" —
 * auch eine Zeitüberschreitung oder ein Netzfehler NACH dem Absenden. Hatte Brevo den DELETE doch ausgeführt, nahm
 * die Freigabe die Werbesperre zurück, und die Adresse stand offen: ohne Werbesperre, ohne Vermerk.
 *   · aufgehoben — 2xx oder 404 (war nicht gesperrt);
 *   · abgelehnt  — Brevo hat EINDEUTIG nicht aufgehoben: 4xx mit Status (400, 401, 403, 429 …), oder es ging gar
 *                  nichts raus (kein Schlüssel, keine Adresse: status null);
 *   · unklar     — Zeitüberschreitung, Netzfehler, 5xx: Ob Brevo es getan hat, weiß niemand.
 * Wirft nie.
 */
export type BrevoAufhebenBefund =
  | { ergebnis: "aufgehoben"; status: number }
  | { ergebnis: "abgelehnt"; status: number | null; grund: string }
  | { ergebnis: "unklar"; grund: string };

export async function brevoSperreAufhebenBefund(email: string): Promise<BrevoAufhebenBefund> {
  const key = process.env.BREVO_API_KEY;
  const adresse = String(email || "").trim();
  if (!key) return { ergebnis: "abgelehnt", status: null, grund: "kein Brevo-Schlüssel — nichts gesendet" };
  if (!adresse) return { ergebnis: "abgelehnt", status: null, grund: "keine Adresse — nichts gesendet" };
  let res: Response;
  try {
    res = await fetch(`${BASIS}/smtp/blockedContacts/${encodeURIComponent(adresse)}`, {
      method: "DELETE",
      headers: { "api-key": key, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    // Die Anfrage kann Brevo erreicht haben — die Antwort fehlt. Nie die Adresse im Text (Fehlertexte landen im Protokoll).
    const t = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return { ergebnis: "unklar", grund: t.replace(/[^\s@]+@[^\s@]+/g, "…").slice(0, 160) };
  }
  if (res.ok || res.status === 404) return { ergebnis: "aufgehoben", status: res.status };
  if (res.status >= 400 && res.status < 500) return { ergebnis: "abgelehnt", status: res.status, grund: `Brevo lehnte ab (HTTP ${res.status})` };
  return { ergebnis: "unklar", grund: `Brevo antwortete HTTP ${res.status} — ob aufgehoben, ist offen` };
}

/**
 * WARUM steht eine Adresse auf Brevos Sperrliste für Transaktionsmails? (08.10.2026, Zahlungspost-Freigabe,
 * server/lib/fiaon-zahlungspost-freigabe.ts)
 *
 * Brevo nennt je Eintrag einen Grund: unsubscribedViaEmail/-ViaMA/-ViaApi (abgemeldet), hardBounce,
 * contactFlaggedAsSpam, adminBlocked. Die Liste hat keinen Adressfilter — sie wird seitenweise (100 je Seite)
 * gelesen und 30 Minuten gemerkt; nach einem Fehler 5 Minuten lang nicht erneut gefragt (Brevo bremst mit 429).
 * Eine Adresse kann mehrfach stehen (je Absender) — dann zählen ALLE Gründe. `codes` leer = nicht auf der Liste.
 *
 * NIE STILL ABGESCHNITTEN (zweite Prüfung, 08.10.2026): Gelesen werden höchstens SPERRLISTE_HOECHSTENS Einträge. Endet
 * das Lesen ohne kurze (letzte) Seite oder nennt Brevo mehr Einträge (`count`), als gelesen wurden (etwa wenn Brevo die
 * Seitengröße kürzt), gilt die Liste als NICHT lesbar — sonst hieße eine Adresse jenseits der Grenze „nicht (mehr)
 * gesperrt", und ein Grund wie hardBounce ginge verloren. Dann bleibt jede Adresse gesperrt; neuer Versuch nach 30 Minuten
 * (sofort wieder 50 Seiten zu lesen hülfe nicht und bremst nur Brevo).
 */
export const SPERRLISTE_HOECHSTENS = 5000;
let sperrliste: { bis: number; gruende: Map<string, string[]> | null; fehler?: string } | null = null;

export async function brevoSperrGruende(email: string): Promise<{ ok: boolean; codes: string[]; grund?: string }> {
  const adresse = String(email || "").trim().toLowerCase();
  if (!sperrliste || Date.now() >= sperrliste.bis) {
    const gruende = new Map<string, string[]>();
    let fehler: string | undefined;
    let gelesen = 0, gesamt: number | null = null, ende = false;
    for (let offset = 0; offset < SPERRLISTE_HOECHSTENS; offset += 100) {
      const r = await brevo<{ contacts?: any[]; count?: unknown }>(`/smtp/blockedContacts?limit=100&offset=${offset}`);
      if (!r.ok) { fehler = r.grund; break; }
      const seite = Array.isArray(r.daten.contacts) ? r.daten.contacts : [];
      if (r.daten.count != null && Number.isFinite(Number(r.daten.count))) gesamt = Number(r.daten.count);
      gelesen += seite.length;
      for (const c of seite) {
        const e = String(c?.email ?? "").trim().toLowerCase();
        if (e) gruende.set(e, [...(gruende.get(e) ?? []), String(c?.reason?.code ?? "") || "unbekannt"]);
      }
      if (seite.length < 100) { ende = true; break; }
    }
    const unvollstaendig = !fehler && (!ende || (gesamt != null && gesamt > gelesen));
    if (unvollstaendig) {
      fehler = `Sperrliste unvollständig gelesen (${gelesen} von ${gesamt ?? `mehr als ${SPERRLISTE_HOECHSTENS}`} Einträgen)`;
      console.error(`[BREVO] ${fehler} — keine Adresse wird freigegeben, bis sie ganz lesbar ist.`);
    }
    sperrliste = fehler
      ? { bis: Date.now() + (unvollstaendig ? 30 : 5) * 60_000, gruende: null, fehler }
      : { bis: Date.now() + 30 * 60_000, gruende };
  }
  if (!sperrliste.gruende) return { ok: false, codes: [], grund: sperrliste.fehler };
  return { ok: true, codes: sperrliste.gruende.get(adresse) ?? [] };
}

/** Für Prüfstände: die gemerkte Sperrliste vergessen. */
export function brevoSperrlisteVergessen(): void { sperrliste = null; }

// ═══════════════════════════════════════════════════════════════════════════
// WARUM IST EINE ADRESSE GESPERRT? — NUR LESEN, NIE AUFHEBEN (E-IT-B, 08.10.2026)
//
// 43 Kunden bekamen die Konto-&-Karte-Einladung nie, weil ihre Adresse bei
// Brevo schon vorher gesperrt war — im Protokoll steht dann nur „blockiert“,
// ohne Grund (zustellung_grund leer). Den Grund kennt nur Brevos Sperrliste
// (GET /smtp/blockedContacts, reason.code: unsubscribedViaEmail, hardBounce,
// contactFlaggedAsSpam, adminBlocked …). Justin, 08.10.: Eine Sperre wird NICHT
// automatisch aufgehoben — der Grund steht in der Akte, der Mitarbeiter prüft
// die Adresse mit dem Kunden.
//
// Die Schnittstelle filtert nicht nach Adresse; die Liste (rund 600) wird
// deshalb seitenweise geholt und eine Stunde im Speicher gehalten — höchstens
// sieben Abrufe je Stunde, nur wenn eine Akte einen gesperrten Fall zeigt.
// Ohne Schlüssel oder bei einer Störung: null (die Akte sagt dann „Grund
// unbekannt“), nie ein Fehler.
// ═══════════════════════════════════════════════════════════════════════════
let sperrListe: { am: number; je: Map<string, { code: string; text: string | null; am: string | null }>; echt?: boolean } | null = null;
let sperrListeLaedt: Promise<void> | null = null;
const SPERRLISTE_GUELTIG_MS = 60 * 60_000;

async function sperrListeLaden(): Promise<void> {
  const je = new Map<string, { code: string; text: string | null; am: string | null }>();
  // „echt“ heißt: die Liste ist VOLLSTÄNDIG gelesen. Nur dann darf „nicht auf der Liste“ als „nicht gesperrt“ gelten
  // (brevoGesperrt) — eine abgebrochene oder abgeschnittene Liste sagt darüber nichts (Nachbesserung 08.10.2026).
  let vollstaendig = false;
  for (let seite = 0; seite < 20; seite++) {
    const r = await brevo<{ contacts?: any[]; count?: number }>(`/smtp/blockedContacts?limit=100&offset=${seite * 100}&sort=desc`);
    if (!r.ok) {
      if (seite === 0) throw new Error(r.grund);
      break;
    }
    const kontakte = r.daten.contacts || [];
    for (const k of kontakte) {
      const mail = String(k?.email ?? "").trim().toLowerCase();
      if (!mail || je.has(mail)) continue;
      je.set(mail, {
        code: String(k?.reason?.code ?? "unbekannt"),
        text: k?.reason?.message ? String(k.reason.message) : null,
        am: k?.blockedAt ? String(k.blockedAt) : null,
      });
    }
    if (kontakte.length < 100) { vollstaendig = true; break; }
  }
  sperrListe = { am: Date.now(), je, echt: vollstaendig };
}

/** Brevos Sperrgrund für eine Adresse — null, wenn sie nicht gesperrt ist oder der Grund nicht lesbar ist. */
export async function brevoSperrGrund(email: string): Promise<{ code: string; text: string | null; am: string | null } | null> {
  const a = String(email || "").trim().toLowerCase();
  if (!a || !brevoKonfiguriert()) return null;
  if (!sperrListe || Date.now() - sperrListe.am > SPERRLISTE_GUELTIG_MS) {
    sperrListeLaedt ??= sperrListeLaden().finally(() => { sperrListeLaedt = null; });
    try { await sperrListeLaedt; } catch {
      // Gestört (429, Schlüssel, Netz): zehn Minuten Ruhe statt bei jeder Akte ein neuer Versuch.
      sperrListe = { am: Date.now() - SPERRLISTE_GUELTIG_MS + 10 * 60_000, je: new Map(), echt: false };
      return null;
    }
  }
  return sperrListe?.je.get(a) ?? null;
}

/**
 * Steht die Adresse auf Brevos Sperrliste? true/false — null, wenn es nicht
 * sicher lesbar ist (kein Schlüssel, Störung). Gegenprüfung 08.10.2026: Ein
 * weicher Rückläufer gibt den erneuten Versand nur frei, wenn Brevo die Adresse
 * NACHWEISLICH nicht sperrt — sonst höbe die Mail-Tür beim Handversand eine
 * Sperre auf, und das geschieht nie automatisch (Justin, 08.10.).
 */
export async function brevoGesperrt(email: string): Promise<boolean | null> {
  const g = await brevoSperrGrund(email);
  if (g) return true;
  return sperrListe?.echt === true ? false : null;
}

export async function vorlagen(): Promise<{ ok: boolean; liste: BrevoVorlage[]; grund?: string }> {
  const r = await brevo<{ templates?: any[] }>("/smtp/templates?limit=200&sort=asc");
  if (!r.ok) return { ok: false, liste: [], grund: r.grund };
  return {
    ok: true,
    liste: (r.daten.templates || []).map((t) => ({
      id: Number(t.id),
      name: String(t.name ?? `Vorlage ${t.id}`),
      betreff: String(t.subject ?? ""),
      // `isActive` ist der Grund, warum eine Mail bei korrektem Make-Zweig
      // trotzdem nie ankommt. Deshalb steht das Feld hier und in der Auswahl.
      aktiv: t.isActive !== false,
    })),
  };
}

/** Das HTML einer Vorlage — für die Live-Vorschau. */
export async function vorlagenHtml(id: number): Promise<{ ok: boolean; html: string; betreff: string; grund?: string }> {
  const r = await brevo<any>(`/smtp/templates/${id}`);
  if (!r.ok) return { ok: false, html: "", betreff: "", grund: r.grund };
  return { ok: true, html: String(r.daten.htmlContent ?? ""), betreff: String(r.daten.subject ?? "") };
}

// ───────────────────────────────────────────────────────────────────────────
// Zustell-Ereignisse
// ───────────────────────────────────────────────────────────────────────────

/**
 * Brevos Ereignisnamen auf unser Vokabular.
 *
 * Die Reihenfolge im Wert ist die Rangfolge: Ein „geöffnet" überschreibt ein
 * „zugestellt", nicht umgekehrt. Sonst hinge der Status davon ab, in welcher
 * Reihenfolge die API antwortet.
 */
const RANG: Record<string, { name: string; rang: number }> = {
  requests: { name: "angenommen", rang: 1 },
  delivered: { name: "zugestellt", rang: 2 },
  opened: { name: "geoeffnet", rang: 3 },
  uniqueOpened: { name: "geoeffnet", rang: 3 },
  clicks: { name: "geklickt", rang: 4 },
  softBounces: { name: "gebounct", rang: 5 },
  hardBounces: { name: "gebounct", rang: 6 },
  blocked: { name: "blockiert", rang: 6 },
  spam: { name: "spam", rang: 6 },
  invalid: { name: "gebounct", rang: 6 },
  deferred: { name: "angenommen", rang: 1 },
  error: { name: "fehler", rang: 6 },
};

export interface ZustellEreignis {
  email: string;
  ereignis: string;
  am: string;
  betreff: string | null;
  grund: string | null;
  messageId: string | null;
}

/**
 * Zustell-Ereignisse für eine Adresse in einem Zeitfenster.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * DER 400-FEHLER, DER 35 ZWEIGE ZU UNRECHT BESCHULDIGTE (21.08.2026)
 *
 * Hier stand:
 *
 *     const bis = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
 *     …&startDate=${von}&endDate=${bis}&limit=100&sort=desc
 *
 * `endDate` lag also einen Tag in der ZUKUNFT — „damit heute sicher mitgezählt
 * wird". Brevo lehnt das mit HTTP 400 ab.
 *
 * Die Folge: Der Betreiber setzte BREVO_API_KEY, und die Prüfung scheiterte bei
 * ALLEN 35 Ereignissen identisch — während seine Testmails ankamen. Die Kachel
 * meldete „35 ohne Zweig". Eine falsche Anschuldigung; der Versand war gesund,
 * nur die Nachschau war kaputt.
 *
 * ── DIE KORREKTUR: `days` STATT DATUMSBEREICH ─────────────────────────────
 * Brevo bietet genau dafür einen Parameter (API-Referenz zu
 * GET /smtp/statistics/events): „days — Number of days in the past INCLUDING
 * TODAY (positive integer, maximum 90). Not compatible with startDate and
 * endDate."
 *
 * `days` kann per Bauart kein Zukunftsdatum enthalten und schließt heute ein —
 * genau das, was der Datumsbereich erreichen wollte. Und es ist EIN Parameter
 * statt zweier, die zueinander passen müssen.
 *
 * Wichtig: `days` NICHT mit startDate/endDate zusammen senden — laut Referenz
 * unzulässig, und unzulässige Kombinationen sind der zweite häufige 400-Grund.
 *
 * ── UND `limit` ───────────────────────────────────────────────────────────
 * Der Vorgabewert ist 2500. Bei einem Sammellauf über 35 Ereignisse sind 100 zu
 * wenig — dann fehlen Treffer, und das sähe wieder aus wie „Zweig fehlt".
 * ══════════════════════════════════════════════════════════════════════════
 *
 * @param seit  frühester Zeitpunkt (wird in ganze Tage umgerechnet)
 */
export async function ereignisseFuer(
  email: string, seit: Date, grenze = 500,
  /**
   * Auch Plus-Adressen desselben Postfachs mitholen.
   *
   * ── WARUM DIESE OPTION NÖTIG WURDE (27.08.2026) ─────────────────────────
   * Die Zweig-Prüfung schickt seit heute an `dev+welcome@…`,
   * `dev+payment_details@…` usw. — eine eigene Adresse je Ereignis, damit die
   * Zuordnung eine Gleichheit ist und keine Vermutung über den Betreff.
   *
   * Brevos `?email=`-Filter vergleicht aber EXAKT. Eine Suche nach
   * `dev@fiaon.com` findet die Plus-Adressen NICHT — die Ampel wäre danach
   * dauerhaft rot, und der Grund („wir haben nach der falschen Adresse
   * gefragt") stünde nirgends.
   *
   * Mit `plusAuch` entfällt der Adressfilter: Brevo liefert alle Ereignisse des
   * Kontos im Zeitfenster, und wir filtern auf das Postfach VOR dem Plus. Das
   * ist eine Abfrage statt 35 — bei 35 einzelnen Abfragen käme die Bremse
   * (HTTP 429), und der Lauf dauerte Minuten.
   */
  plusAuch = false,
): Promise<{ ok: boolean; ereignisse: ZustellEreignis[]; grund?: string; klartext?: BrevoKlartext }> {
  // Ganze Tage zurück, mindestens 1 (= heute), höchstens 90 (Brevos Grenze).
  const tage = Math.min(90, Math.max(1,
    Math.ceil((Date.now() - seit.getTime()) / 86_400_000) + 1));
  // Das Postfach vor dem Plus — danach wird lokal gefiltert.
  const postfach = String(email).trim().toLowerCase();
  const [lokal = "", domain = ""] = postfach.split("@");
  const basis = `${lokal.split("+")[0]}@${domain}`;
  // ── DIE URL EINMAL BAUEN UND AUCH IM FEHLERFALL MELDEN ─────────────────
  // Der Fehlerzweig unten hatte seinen eigenen, hartkodierten Pfad. Nach dem
  // Umbau auf Plus-Adressen stimmte er nicht mehr: Das Log zeigte
  // „?email=dev@fiaon.com", während die Abfrage längst ohne Adressfilter lief.
  // Eine Diagnose, die eine andere URL nennt als die gestellte, schickt den
  // nächsten Leser in die falsche Richtung.
  const pfad = "/smtp/statistics/events?"
    + (plusAuch ? "" : `email=${encodeURIComponent(email)}&`)
    // Ohne Adressfilter kommen alle Ereignisse des Kontos — die Grenze muss
    // dann höher liegen, sonst fehlen die älteren im Fenster.
    + `days=${tage}&limit=${Math.min(2500, plusAuch ? Math.max(grenze, 2000) : grenze)}&sort=desc`;
  const r = await brevo<{ events?: any[] }>(pfad);
  if (!r.ok) {
    // ── DIE VOLLE ANTWORT INS LOG ───────────────────────────────────────
    // Der Auftrag verlangt sie ausdrücklich. Eine Fehlermeldung ohne die
    // Antwort des Gegenübers schickt den nächsten Leser auf dieselbe Suche.
    console.error("[BREVO-NACHSCHAU] Abfrage gescheitert:",
      JSON.stringify({
        pfad, gesuchtesPostfach: basis, plusAdressenMit: plusAuch,
        titel: r.grund, wer: r.klartext.wer, antwort: r.klartext.roh,
      }));
    return { ok: false, ereignisse: [], grund: r.grund, klartext: r.klartext };
  }
  return {
    ok: true,
    ereignisse: (r.daten.events || [])
      // Ohne Adressfilter: nur die Ereignisse dieses Postfachs behalten —
      // `dev@…` und alle `dev+irgendwas@…`.
      .filter((e: any) => {
        if (!plusAuch) return true;
        const a2 = String(e.email ?? "").trim().toLowerCase();
        const [l2 = "", d2 = ""] = a2.split("@");
        return `${l2.split("+")[0]}@${d2}` === basis;
      })
      .map((e: any) => ({
      email: String(e.email ?? email),
      ereignis: RANG[String(e.event)]?.name ?? String(e.event),
      am: String(e.date ?? ""),
      betreff: e.subject ? String(e.subject) : null,
      grund: e.reason ? String(e.reason) : null,
      // Brevo liefert `messageId` (Referenz), ältere Antworten „message-id".
      // Beide lesen — sonst bleibt die Verknüpfung leer und ein Treffer wird
      // nicht erkannt.
      messageId: e.messageId ? String(e.messageId)
        : e["message-id"] ? String(e["message-id"]) : null,
    })),
  };
}

/**
 * EINE Nachschau für VIELE Ereignisse — der schnelle Prüflauf.
 *
 * ── WARUM (21.08.2026) ────────────────────────────────────────────────────
 * Der Prüflauf ging 35-mal durch (senden → warten → fragen). Das dauerte
 * Minuten und sah aus, als hinge er.
 *
 * Brevo liefert alle Ereignisse einer Adresse in EINER Antwort. Also: alle 35
 * Mails abschicken, kurz warten, EINMAL fragen, dann zuordnen. Ein Abruf statt
 * 35 — und keine 35 Wartezeiten.
 *
 * Die Zuordnung läuft über den Betreff: Jede Probemail trägt ihren
 * Ereignisnamen darin. Über die messageId wäre es genauer, aber Make gibt sie
 * uns nicht zurück — der Betreff ist das, was wir haben.
 */
export async function nachschauSammel(
  email: string, seit: Date,
): Promise<{
  ok: boolean;
  ereignisse: ZustellEreignis[];
  grund?: string;
  klartext?: BrevoKlartext;
}> {
  // Höheres Limit: 35 Mails erzeugen je mehrere Ereignisse (requests,
  // delivered, opened). Mit 100 wären es zu wenige, und fehlende Treffer sähen
  // wieder aus wie „Zweig fehlt".
  // ── PLUS-ADRESSEN MITHOLEN ────────────────────────────────────────────
  // Die Zweig-Prüfung schickt an `dev+welcome@…` usw. Ohne diese Angabe würde
  // Brevos exakter Adressfilter keine einzige davon finden.
  return ereignisseFuer(email, seit, 1000, true);
}

/** Aus mehreren Ereignissen den aussagekräftigsten Zustand wählen. */
export function besterZustand(ereignisse: ZustellEreignis[]): { zustand: string; am: string | null; grund: string | null } | null {
  if (ereignisse.length === 0) return null;
  let beste = ereignisse[0];
  let besterRang = 0;
  for (const e of ereignisse) {
    const rang = Object.values(RANG).find((r) => r.name === e.ereignis)?.rang ?? 0;
    if (rang >= besterRang) { besterRang = rang; beste = e; }
  }
  return { zustand: beste.ereignis, am: beste.am || null, grund: beste.grund };
}

// ───────────────────────────────────────────────────────────────────────────
// Eigener Versand (Freitext aus der Mail-Zentrale)
// ───────────────────────────────────────────────────────────────────────────

export interface EigeneMail {
  an: string;
  name?: string | null;
  betreff: string;
  /** Reiner Text. Der CI-Rahmen kommt aus `rahmen()`. */
  text: string;
  /** Ging diese Mail an mehrere? Dann trägt sie einen Abmelde-Hinweis. */
  gruppe?: boolean;
  /**
   * Knöpfe unter dem Text (29.09.2026, E-263 — „In Apple-/Outlook-Kalender",
   * „In Google Kalender", „Alle meine Termine …"). `leise` = gerahmt statt
   * blau gefüllt. Ohne Angabe bleibt jede Mail Byte für Byte, wie sie war.
   */
  knoepfe?: { text: string; url: string; leise?: boolean }[];
  /** Kleiner Satz direkt ÜBER den Knöpfen (z. B. „Dein Kalender-Abo ist aktiv …"). */
  hinweis?: string;
  /** Kleiner Satz UNTER den Knöpfen (z. B. „Google: bitte nur einmal klicken …"). */
  knopfFuss?: string;
}

/**
 * Freitext-Mails gehen DIREKT über Brevo, nicht über Make.
 *
 * Make ist ein Verteiler für vorlagengebundene Ereignisse — jede Freitextmail
 * bräuchte dort einen eigenen Zweig, und den gibt es nie. Der direkte Weg
 * liefert außerdem sofort eine `messageId`, mit der der stündliche Abgleich
 * die Zustellung genau dieser Mail nachverfolgen kann.
 */
export async function eigeneMailSenden(
  mail: EigeneMail,
): Promise<{ ok: boolean; messageId: string | null; grund?: string }> {
  const r = await brevo<{ messageId?: string }>("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      // Absendername ist die MARKE, nicht die Domain — im Posteingang steht
      // dann „FIAON" und nicht „welcome@fiaon.com".
      sender: { name: "FIAON", email: "welcome@fiaon.com" },
      replyTo: { name: "FIAON", email: "welcome@fiaon.com" },
      to: [{ email: mail.an, ...(mail.name ? { name: mail.name } : {}) }],
      subject: mail.betreff,
      htmlContent: rahmen(mail.betreff, mail.text, mail.gruppe === true, mail),
      // Mehrteilig: Wer HTML abgeschaltet hat, sähe sonst eine leere Mail —
      // und jeder Spamfilter bewertet eine Mail ohne Textteil schlechter.
      textContent: rahmenText(mail.text, mail.gruppe === true, mail),
    }),
  });
  if (!r.ok) return { ok: false, messageId: null, grund: r.grund };
  return { ok: true, messageId: r.daten.messageId ?? null };
}

/**
 * Der FIAON-Rahmen um einen Freitext.
 *
 * Bewusst schmal und ohne Bilder: Eine Mail aus der Zentrale ist eine
 * persönliche Nachricht und kein Newsletter. Was sie braucht, ist eine
 * erkennbare Absenderidentität und einen Fuß, der die Pflichtangaben trägt.
 */
/**
 * Der FIAON-Rahmen um einen Freitext.
 *
 * ── ENTITÄTEN-TRENNUNG IST GESCHÄFTSREGEL (11.08.2026) ─────────────────────
 * In der Fußzeile stand „FIAON — Schwarzott Global". In der Kommunikation
 * mit Kunden existiert AUSSCHLIESSLICH FIAON. Wer eine zweite Firma in der
 * Fußzeile liest, fragt sich, mit wem er eigentlich einen Vertrag hat — und
 * genau diese Frage soll nie entstehen.
 *
 * `gruppe` setzt den Abmelde-Hinweis. Bei einer persönlichen Nachricht an
 * eine Person wäre er falsch: Man meldet sich nicht von einem Gespräch ab.
 */
/**
 * Die reine Textfassung derselben Mail.
 *
 * Mehrteilig zu senden ist kein Luxus: Manche Postfächer (und jeder
 * Spamfilter) bewerten eine Mail ohne Textteil schlechter, und wer HTML
 * abgeschaltet hat, sähe sonst eine leere Nachricht.
 */
export function rahmenText(text: string, gruppe = false, zusatz: Pick<EigeneMail, "knoepfe" | "hinweis" | "knopfFuss"> = {}): string {
  // E-263: Knöpfe als „Text: URL" — wer nur den Textteil liest, hat dieselben Wege.
  const knoepfe = (zusatz.knoepfe ?? []).filter((k) => k.url);
  return [
    text.trim(),
    ...(knoepfe.length || zusatz.hinweis
      ? ["", ...(zusatz.hinweis ? [zusatz.hinweis] : []), ...knoepfe.map((k) => `${k.text}: ${k.url}`), ...(knoepfe.length && zusatz.knopfFuss ? [zusatz.knopfFuss] : [])]
      : []),
    "",
    "—",
    "FIAON",
    "Impressum: https://www.fiaon.com/impressum",
    "Datenschutz: https://www.fiaon.com/datenschutz",
    ...(gruppe
      ? ["", "Diese Mail ging an mehrere Empfänger. Wenn du keine solchen",
         "Nachrichten mehr möchtest, antworte kurz mit „keine Mails“."]
      : []),
  ].join("\n");
}

export function rahmen(betreff: string, text: string, gruppe = false, zusatz: Pick<EigeneMail, "knoepfe" | "hinweis" | "knopfFuss"> = {}): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = esc(text)
    .split(/\n{2,}/)
    .map((absatz) => `<p style="margin:0 0 16px;line-height:1.65;">${absatz.replace(/\n/g, "<br>")}</p>`)
    .join("")
    + knopfZeile(zusatz, esc);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${betreff.replace(/</g, "&lt;")}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;
                box-shadow:0 1px 3px rgba(15,23,42,.06);font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="padding:28px 32px 0;">
      <div style="line-height:0;">${markeMailImg("navy", 20)}</div>
      <div style="height:1px;background:linear-gradient(90deg,rgba(29,78,216,.28),rgba(15,23,42,.06) 40%,transparent);margin:18px 0 24px;"></div>
    </td></tr>
    <tr><td style="padding:0 32px 28px;font-size:15px;color:#0f172a;">${html}</td></tr>
    <tr><td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;font-size:11.5px;color:#64748b;line-height:1.6;">
      <strong style="color:#475569;">FIAON</strong><br>
      Diese Nachricht wurde persönlich an dich geschickt.<br>
      <a href="https://www.fiaon.com/impressum" style="color:#64748b;">Impressum</a> ·
      <a href="https://www.fiaon.com/datenschutz" style="color:#64748b;">Datenschutz</a>${
        gruppe ? `<br><span style="color:#94a3b8;">Diese Mail ging an mehrere Empfänger. `
          + `Wenn du keine solchen Nachrichten mehr möchtest, antworte kurz mit „keine Mails“.</span>` : ""}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/**
 * Die Knopf-Zeile unter dem Text (E-263). Tabellen statt Flexbox (Outlook),
 * alles inline (Gmail), Adressen HTML-maskiert. Leer ohne Knöpfe und ohne
 * Hinweis — dann ändert sich an der Mail kein Byte. Ein Hinweis steht auch
 * allein („Dein Kalender-Abo ist aktiv …"), der Fußsatz nur mit Knöpfen.
 */
function knopfZeile(z: Pick<EigeneMail, "knoepfe" | "hinweis" | "knopfFuss">, esc: (s: string) => string): string {
  const knoepfe = (z.knoepfe ?? []).filter((k) => k.url);
  if (!knoepfe.length && !z.hinweis) return "";
  const attr = (s: string) => esc(s).replace(/"/g, "&quot;");
  const knopf = (k: { text: string; url: string; leise?: boolean }) => k.leise
    ? `<td style="padding:0 8px 8px 0;"><a href="${attr(k.url)}" style="display:inline-block;padding:11px 16px;border:1px solid #1d4ed8;border-radius:10px;color:#1d4ed8;font-size:14px;font-weight:600;text-decoration:none;">${esc(k.text)}</a></td>`
    : `<td style="padding:0 8px 8px 0;"><a href="${attr(k.url)}" style="display:inline-block;padding:12px 16px;background:#1d4ed8;border-radius:10px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${esc(k.text)}</a></td>`;
  return `<div style="margin:4px 0 12px;">`
    + (z.hinweis ? `<p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#334155;">${esc(z.hinweis)}</p>` : "")
    + knoepfe.map((k) => `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;"><tr>${knopf(k)}</tr></table>`).join("")
    + (knoepfe.length && z.knopfFuss ? `<p style="margin:4px 0 0;font-size:12px;line-height:1.55;color:#64748b;">${esc(z.knopfFuss)}</p>` : "")
    + `</div>`;
}
