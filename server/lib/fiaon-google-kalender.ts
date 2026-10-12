// ═══════════════════════════════════════════════════════════════════════════
// TERMINE DIREKT IN DEN GOOGLE-KALENDER (E-342, 12.10.2026)
//
// Justin: „die Termine müssen sich immer in meinen Kalender synchronisieren,
//          wenn der Termin bei mir gebucht wird."
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Das Kalender-Abo (E-263) ist ein Spiegel, den die Kalender-App ABHOLT. Apple
// holte Justins Abo am 12.10. zuletzt um 15:20 — ein Termin von 16 Uhr stand
// bis zum Abend nicht im Kalender. Der Abruftakt gehört der App, nicht uns.
//
// ── DER WEG ────────────────────────────────────────────────────────────────
// Die Plattform SCHREIBT den Termin in den Google-Kalender des Mitarbeiters
// (Workspace-Konto @fiaon.com) — über dasselbe Dienstkonto wie Gmail
// (GOOGLE_SA_KEY, domainweite Delegierung), Scope calendar.events.
//   · Ein Minutentakt gleicht ab: jeder Termin, dessen kal_sequenz (der
//     Trigger aus Migration 085 zählt JEDE Änderung an Zeit, Dauer, Status,
//     Mitarbeiter, Absage) neuer ist als der eingetragene Stand, wird
//     geschrieben; abgesagte und weggegebene werden gelöscht.
//   · Nach einer Buchung stößt terminBuchen den Abgleich sofort an (Sekunden).
//   · Die Ereignis-ID ist fest: „fiaontermin<id>" (base32hex). Zwei Instanzen
//     können denselben Termin nicht doppelt anlegen — die zweite bekommt 409.
//   · Inhalt (Titel, Beschreibung, Akte-Link, Erinnerung 10 Min.) kommt aus
//     terminEreignis — dieselbe Quelle wie das Abo.
//   · Was in Google steht, lässt das EIGENE Abo dieses Mitarbeiters weg —
//     sonst stünde jeder Termin zweimal im Kalender. Scheitert Google, bleibt
//     der Termin im Abo (Rückfall, nie ein Loch).
//
// ── WER ────────────────────────────────────────────────────────────────────
// fiaon_settings.google_kalender_agent_ids (Kommaliste); leer = das Konto aus
// gruender_termin_agent_id, sonst 928 (Justin, dieselbe Vorgabe wie /justin). Schalter: google_kalender_an (Vorgabe an).
//
// ── DIE FREIGABE (einmal, nur Justin) ──────────────────────────────────────
// admin.google.com → Sicherheit → Zugriffs- und Datenverwaltung → API-Steuerung
// → Domainweite Delegierung → Dienstkonto bearbeiten → Bereiche:
//   https://www.googleapis.com/auth/gmail.modify,https://www.googleapis.com/auth/calendar.events
// (gmail.modify MUSS stehen bleiben, sonst steht der Postmeister.) Bis dahin
// meldet Google „unauthorized_client" — der Stand zeigt „Freigabe fehlt".
// ═══════════════════════════════════════════════════════════════════════════

import { createSign } from "crypto";
import { sqlPool } from "./db-pool";
import { termineFuerGoogle, type GoogleTermin } from "./fiaon-kalender-abo";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SETTING_AGENTEN = "google_kalender_agent_ids";
const SETTING_AN = "google_kalender_an";
const SETTING_STAND = "google_kalender_stand";
/** Dieselbe Vorgabe wie VORGABE.agentId in server/routes/fiaon-gruender-termin.ts — Justins Konto. */
const GRUENDER_VORGABE = 928;
/** Höchstens so viele Schreibvorgänge je Lauf — Google erlaubt deutlich mehr, aber ein Fehler soll klein bleiben. */
const JE_LAUF = 40;

export type GoogleFreigabe = "ok" | "fehlt" | "fehler" | "aus" | "kein_konto";

export interface GoogleKalenderStand {
  freigabe: GoogleFreigabe;
  /** Für die Freigabe in der Admin-Konsole: die Client-ID des Dienstkontos (kein Geheimnis). */
  clientId: string | null;
  bereiche: string;
  konten: { id: number; name: string; email: string }[];
  /** Termine, die gerade in Google stehen (ab heute). */
  eingetragen: number;
  zuletztOk: string | null;
  fehler: string | null;
  an: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// Zugang
// ───────────────────────────────────────────────────────────────────────────

interface Dienstkonto { client_email: string; private_key: string; token_uri: string; client_id?: string }
function dienstkonto(): Dienstkonto | null {
  try { return process.env.GOOGLE_SA_KEY ? JSON.parse(process.env.GOOGLE_SA_KEY) : null; } catch { return null; }
}
const b64url = (s: Buffer | string) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export class GoogleFreigabeFehlt extends Error {}

const tokens = new Map<string, { token: string; bis: number }>();
async function zugriff(email: string): Promise<string> {
  const im = tokens.get(email);
  if (im && im.bis > Date.now() + 5 * 60_000) return im.token;
  const sa = dienstkonto();
  if (!sa) throw new GoogleFreigabeFehlt("GOOGLE_SA_KEY fehlt");
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const rumpf = b64url(JSON.stringify({ iss: sa.client_email, sub: email, scope: SCOPE, aud: sa.token_uri, iat: jetzt, exp: jetzt + 3600 }));
  const sig = b64url(createSign("RSA-SHA256").update(`${kopf}.${rumpf}`).sign(sa.private_key));
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${kopf}.${rumpf}.${sig}`,
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) {
    if (j?.error === "unauthorized_client" || j?.error === "access_denied") throw new GoogleFreigabeFehlt(String(j.error));
    throw new Error(`Google-Token ${email}: HTTP ${res.status} ${String(j?.error ?? "")}`.trim());
  }
  tokens.set(email, { token: j.access_token, bis: Date.now() + Number(j.expires_in || 3600) * 1000 });
  return j.access_token;
}

async function google(email: string, methode: string, pfad: string, body?: unknown): Promise<{ status: number; j: any }> {
  const token = await zugriff(email);
  const res = await fetch(`${API}${pfad}`, {
    method: methode,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j: any = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, j };
}

// ───────────────────────────────────────────────────────────────────────────
// Ein Termin als Google-Ereignis
// ───────────────────────────────────────────────────────────────────────────

/** Feste Ereignis-ID: base32hex (0–9, a–v), 5–1024 Zeichen. */
export function ereignisId(terminId: number): string {
  return `fiaontermin${Math.max(0, Math.round(terminId))}`;
}

export function googleEreignis(t: GoogleTermin): Record<string, unknown> {
  const e = t.ereignis;
  return {
    id: ereignisId(t.id),
    summary: e.titel,
    description: e.beschreibung ?? "",
    location: e.ort ?? undefined,
    start: { dateTime: new Date(e.beginn).toISOString(), timeZone: "Europe/Berlin" },
    end: { dateTime: new Date(e.ende).toISOString(), timeZone: "Europe/Berlin" },
    ...(e.url && /^https?:\/\//.test(e.url) ? { source: { title: "FIAON-Akte", url: e.url } } : {}),
    reminders: { useDefault: false, overrides: (e.alarme ?? []).map((a) => ({ method: "popup", minutes: Math.max(0, Math.round(a.minutenVorher)) })) },
    extendedProperties: { private: { fiaonTermin: String(t.id) } },
    status: "confirmed",
  };
}

async function eintragen(email: string, t: GoogleTermin): Promise<void> {
  const body = googleEreignis(t);
  const pfad = `/${ereignisId(t.id)}?sendUpdates=none`;
  let r = await google(email, "PUT", pfad, body);
  if (r.status === 404) {
    r = await google(email, "POST", `?sendUpdates=none`, body);
    // 409: eine zweite Instanz war schneller — dann ist es ein Update.
    if (r.status === 409) r = await google(email, "PUT", pfad, body);
  }
  if (r.status >= 300) throw new Error(`Google ${r.status}: ${String(r.j?.error?.message ?? "").slice(0, 160)}`);
}

async function austragen(email: string, terminId: number): Promise<void> {
  const r = await google(email, "DELETE", `/${ereignisId(terminId)}?sendUpdates=none`);
  if (r.status >= 300 && r.status !== 404 && r.status !== 410) throw new Error(`Google ${r.status}: ${String(r.j?.error?.message ?? "").slice(0, 160)}`);
}

// ───────────────────────────────────────────────────────────────────────────
// Tabelle, Einstellungen, Stand
// ───────────────────────────────────────────────────────────────────────────

let tabelleDa = false;
export async function ensureGoogleKalender(): Promise<void> {
  if (tabelleDa) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_google_kalender (
      termin_id    INTEGER PRIMARY KEY,
      agent_id     INTEGER NOT NULL,
      email        TEXT NOT NULL,
      sequenz      INTEGER NOT NULL DEFAULT 0,
      stand        TIMESTAMPTZ,
      eingetragen_am TIMESTAMPTZ,
      geloescht_am TIMESTAMPTZ,
      fehler       TEXT,
      versuche     INTEGER NOT NULL DEFAULT 0,
      geaendert_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  tabelleDa = true;
}

async function settingLesen(key: string): Promise<string | null> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key} LIMIT 1`.catch(() => [])) as any[];
  return r?.value == null ? null : String(r.value);
}
async function settingSchreiben(key: string, value: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

/** Die Konten, deren Termine direkt in Google stehen sollen — nur aktive, nicht gesperrte @fiaon.com-Adressen. */
export async function googleKonten(): Promise<{ id: number; name: string; email: string }[]> {
  const liste = await settingLesen(SETTING_AGENTEN);
  let ids = (liste ?? "").split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) {
    // Wie die Gründer-Seite /justin (fiaon-gruender-termin.ts): Einstellung, sonst Konto 928 (js@fiaon.com).
    const g = Number(await settingLesen("gruender_termin_agent_id"));
    ids = [Number.isInteger(g) && g > 0 ? g : GRUENDER_VORGABE];
  }
  if (!ids.length) return [];
  const zeilen = (await sqlPool`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS name, LOWER(TRIM(email)) AS email
      FROM fiaon_agents
     WHERE id = ANY(${ids}) AND active AND zugang_gesperrt_am IS NULL
       AND LOWER(TRIM(email)) LIKE '%@fiaon.com'`) as any[];
  return zeilen.map((z) => ({ id: Number(z.id), name: String(z.name ?? ""), email: String(z.email) }));
}

interface GespeicherterStand { freigabe: GoogleFreigabe; fehler: string | null; zuletztOk: string | null }
let letzterStand: GespeicherterStand | null = null;
async function standMerken(s: GespeicherterStand): Promise<void> {
  const gleich = letzterStand && letzterStand.freigabe === s.freigabe && letzterStand.fehler === s.fehler;
  // zuletztOk höchstens alle 10 Minuten schreiben — der Minutentakt soll keine Schreiblast erzeugen.
  const alt = letzterStand?.zuletztOk ? Date.parse(letzterStand.zuletztOk) : 0;
  if (gleich && (!s.zuletztOk || Date.now() - alt < 10 * 60_000)) return;
  letzterStand = s;
  await settingSchreiben(SETTING_STAND, JSON.stringify(s)).catch(() => {});
}

export async function googleKalenderStand(): Promise<GoogleKalenderStand> {
  const an = (await settingLesen(SETTING_AN)) !== "0";
  const konten = await googleKonten().catch(() => []);
  let gespeichert: GespeicherterStand | null = null;
  try { gespeichert = JSON.parse((await settingLesen(SETTING_STAND)) ?? "null"); } catch { gespeichert = null; }
  let eingetragen = 0;
  try {
    await ensureGoogleKalender();
    const [r] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_google_kalender g JOIN fiaon_termine t ON t.id = g.termin_id
       WHERE g.geloescht_am IS NULL AND g.fehler IS NULL AND t.beginn >= date_trunc('day', NOW())`) as any[];
    eingetragen = Number(r?.n ?? 0);
  } catch { /* Tabelle fehlt lokal — dann 0 */ }
  const freigabe: GoogleFreigabe = !an ? "aus" : !konten.length ? "kein_konto" : gespeichert?.freigabe ?? "fehlt";
  return {
    freigabe, an, konten, eingetragen,
    clientId: dienstkonto()?.client_id ?? null,
    bereiche: `https://www.googleapis.com/auth/gmail.modify,${SCOPE}`,
    zuletztOk: gespeichert?.zuletztOk ?? null,
    fehler: gespeichert?.fehler ?? null,
  };
}

export async function googleKalenderSchalten(an: boolean): Promise<void> {
  await settingSchreiben(SETTING_AN, an ? "1" : "0");
}

// ───────────────────────────────────────────────────────────────────────────
// Der Abgleich
// ───────────────────────────────────────────────────────────────────────────

let laeuft = false;
/** Seit wann Google die Freigabe verweigert — dann fragt der Takt nur alle 10 Minuten neu (0 = nicht verweigert). */
let fehltSeit = 0;

/**
 * Ein Durchgang: schreiben, was neu oder geändert ist; löschen, was nicht
 * mehr in den Kalender gehört. `true` = es wurde etwas getan (für den Takt).
 * `erzwingen` (Knopf „Jetzt abgleichen“) prüft die Freigabe sofort, auch in der 10-Minuten-Pause.
 */
export async function googleKalenderAbgleich(opts: { erzwingen?: boolean } = {}): Promise<boolean> {
  if (laeuft) return false;
  laeuft = true;
  try {
    if ((await settingLesen(SETTING_AN)) === "0") return false;
    if (!dienstkonto()) return false;
    const konten = await googleKonten();
    if (!konten.length) return false;
    if (!opts.erzwingen && fehltSeit && Date.now() - fehltSeit < 10 * 60_000) return false;
    // ── ERST DIE FREIGABE, DANN DIE ARBEIT (Befund nach dem Ausrollen, 12.10.2026) ──
    // Ohne Termine im Fenster fragte der Lauf keinen Token an und meldete „ok“, obwohl Google 401 sagte.
    // Der Token wird gemerkt (1 h) — die Probe kostet im Normalfall nichts.
    try {
      for (const k of konten) await zugriff(k.email);
      fehltSeit = 0;
    } catch (e: any) {
      if (e instanceof GoogleFreigabeFehlt) {
        fehltSeit = Date.now();
        await standMerken({ freigabe: "fehlt", fehler: null, zuletztOk: letzterStand?.zuletztOk ?? null });
      } else {
        await standMerken({ freigabe: "fehler", fehler: String(e?.message ?? e).slice(0, 200), zuletztOk: letzterStand?.zuletztOk ?? null });
      }
      return false;
    }
    await ensureGoogleKalender();
    const emailVon = new Map(konten.map((k) => [k.id, k.email]));

    const soll = await termineFuerGoogle(konten.map((k) => k.id));
    const ist = new Map(((await sqlPool`
      SELECT g.termin_id, g.agent_id, g.email, g.sequenz, g.stand, g.fehler, g.versuche, g.geaendert_am
        FROM fiaon_google_kalender g
        LEFT JOIN fiaon_termine t ON t.id = g.termin_id
       WHERE g.geloescht_am IS NULL AND (t.id IS NULL OR t.beginn >= NOW() - INTERVAL '1 day')`) as any[])
      .map((r) => [Number(r.termin_id), r]));

    let getan = 0, fehler: string | null = null, freigabeFehlt = false;
    const sollIds = new Set<number>();

    for (const t of soll) {
      sollIds.add(t.id);
      const email = emailVon.get(t.agent_id);
      if (!email) continue;
      const r = ist.get(t.id);
      const aktuell = r && r.email === email && Number(r.sequenz) === t.kal_sequenz && !r.fehler
        && r.stand && new Date(r.stand).getTime() >= t.stand.getTime();
      if (aktuell) continue;
      // Ein Fehler wird nicht im Minutentakt wiederholt: ab dem 3. Versuch nur noch alle 30 Minuten.
      if (r?.fehler && Number(r.versuche) >= 3 && Date.now() - new Date(r.geaendert_am).getTime() < 30 * 60_000) continue;
      if (getan >= JE_LAUF) break;
      try {
        if (r && r.email !== email) await austragen(String(r.email), t.id);
        await eintragen(email, t);
        await sqlPool`
          INSERT INTO fiaon_google_kalender (termin_id, agent_id, email, sequenz, stand, eingetragen_am, geloescht_am, fehler, versuche, geaendert_am)
          VALUES (${t.id}, ${t.agent_id}, ${email}, ${t.kal_sequenz}, ${t.stand}, NOW(), NULL, NULL, 0, NOW())
          ON CONFLICT (termin_id) DO UPDATE SET agent_id = EXCLUDED.agent_id, email = EXCLUDED.email, sequenz = EXCLUDED.sequenz,
            stand = EXCLUDED.stand, eingetragen_am = NOW(), geloescht_am = NULL, fehler = NULL, versuche = 0, geaendert_am = NOW()`;
        getan++;
      } catch (e: any) {
        if (e instanceof GoogleFreigabeFehlt) { freigabeFehlt = true; break; }
        fehler = String(e?.message ?? e).slice(0, 200);
        await sqlPool`
          INSERT INTO fiaon_google_kalender (termin_id, agent_id, email, sequenz, stand, fehler, versuche, geaendert_am)
          VALUES (${t.id}, ${t.agent_id}, ${email}, -1, NULL, ${fehler}, 1, NOW())
          ON CONFLICT (termin_id) DO UPDATE SET fehler = EXCLUDED.fehler, versuche = fiaon_google_kalender.versuche + 1, geaendert_am = NOW()`.catch(() => {});
        getan++;
      }
    }

    if (!freigabeFehlt) {
      for (const [id, r] of Array.from(ist)) {
        if (sollIds.has(id) || getan >= JE_LAUF) continue;
        try {
          await austragen(String(r.email), id);
          await sqlPool`UPDATE fiaon_google_kalender SET geloescht_am = NOW(), fehler = NULL, geaendert_am = NOW() WHERE termin_id = ${id}`;
          getan++;
        } catch (e: any) {
          if (e instanceof GoogleFreigabeFehlt) { freigabeFehlt = true; break; }
          fehler = String(e?.message ?? e).slice(0, 200);
          getan++;
        }
      }
    }

    if (freigabeFehlt) {
      fehltSeit = Date.now();
      await standMerken({ freigabe: "fehlt", fehler: null, zuletztOk: letzterStand?.zuletztOk ?? null });
      return false;
    }
    await standMerken({ freigabe: fehler ? "fehler" : "ok", fehler, zuletztOk: fehler ? (letzterStand?.zuletztOk ?? null) : new Date().toISOString() });
    if (getan) console.log(`[GOOGLE-KALENDER] ${getan} Änderung(en) übertragen${fehler ? ` — Fehler: ${fehler}` : ""}`);
    return getan > 0;
  } finally {
    laeuft = false;
  }
}

/** Nach einer Buchung: in wenigen Sekunden abgleichen (die Buchung ist dann sicher geschrieben). */
let angestossen: ReturnType<typeof setTimeout> | null = null;
export function googleKalenderAnstossen(): void {
  if (angestossen || !dienstkonto()) return;
  angestossen = setTimeout(() => {
    angestossen = null;
    void googleKalenderAbgleich().catch((e) => console.warn("[GOOGLE-KALENDER] Anstoß:", String(e?.message ?? e).slice(0, 160)));
  }, 4000);
}
