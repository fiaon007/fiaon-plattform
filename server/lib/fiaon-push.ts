// ═══════════════════════════════════════════════════════════════════════════
// PUSH-MITTEILUNGEN FÜR /APP (Scheibe 6, Modul B, 06.09.2026)
//
// Der Kunde bekommt jede Nachricht per E-Mail (Mailwerk E-070). Push ist die
// ZUSÄTZLICHE Stimme auf dem Handy — nur für Zustandswechsel mit Beleg, nie
// für Werbung. Bauvorlage 3.12/3.14:
//
//   · keine Sendung zwischen 21 und 8 Uhr Berliner Zeit — NICHT nachholen,
//     sondern still verwerfen (fiaon_push_log: 'nachtruhe')
//   · höchstens EINE Mitteilung je Tag und Person (fiaon_push_log)
//   · jeder Satz geht durch wandPruefen (shared/fiaon-wortverbote.ts)
//   · Abo mit 404/410 vom Push-Dienst → geloescht_am, kein zweiter Versuch;
//     andere Fehler zählen (fehler_folge) — nach FEHLER_BIS_STILL in Folge
//     wird das Abo ebenfalls stillgelegt
//   · Endpunkte nur bei den echten Push-Diensten (ENDPUNKT_HOSTS) — der
//     Server schickt sonst signierte POSTs an jede Adresse, die ein Kunde
//     ihm nennt (blinde SSRF, Prüfung 06.09.2026); höchstens ABOS_JE_PERSON
//     aktive Abos je Mensch, ältere werden stillgelegt
//   · Schlüssel NUR aus process.env (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//     VAPID_SUBJECT). Fehlen sie, ist Push „nicht verfügbar“: Endpunkte
//     antworten ehrlich, gesendet wird nichts. Erzeugen: scripts/vapid-
//     schluessel-erzeugen.ts, eintragen bei Render (TFO).
//
// Zwei Eingänge: `pushSenden()` mit fertigem Text und `pushBeiEreignis()` mit
// den fertigen Sätzen je Anlass — die Hauptsitzung hängt letzteres an die
// Stellen in fiaon-app-antraege.ts und den Fristenwächter. Beide werfen nie:
// Ein Push, der scheitert, darf den Vorgang dahinter nicht anhalten.
//
// Tabellen: db/migrations/082_app_bericht_push_login.sql, Abschnitt B —
// dieselbe DDL unten in ensurePushTabellen (idempotent).
// ═══════════════════════════════════════════════════════════════════════════
import webpush from "web-push";
import { sqlPool } from "./db-pool";
import { wandPruefen } from "@shared/fiaon-wortverbote";

// ── Anlässe (nur Zustandswechsel mit Beleg) ─────────────────────────────────
export const PUSH_ANLAESSE = [
  "zahlung_eingegangen", "unterschrift_wartet", "vorgang_versandt", "antwort_da", "vorgang_bewilligt",
  "frist_ueberfaellig", "rate_faellig_3_tage", "bericht_da", "antwort_anliegen", "kontoanbindung_laeuft_ab",
] as const;
export type PushAnlass = (typeof PUSH_ANLAESSE)[number];
const ANLASS_MENGE = new Set<string>(PUSH_ANLAESSE);

export type PushErgebnis = "gesendet" | "nachtruhe" | "tagesbremse" | "kein_abo" | "nicht_verfuegbar" | "wand" | "fehler" | "uebersprungen";

export interface PushInhalt { titel: string; text: string; url: string }
export interface PushResultat { ergebnis: PushErgebnis; gesendet: number; abos: number }

// ── Schlüssel (nur Umgebung) ────────────────────────────────────────────────
export function pushSchluessel(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.VAPID_SUBJECT || "mailto:support@fiaon.com").trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}
export function pushVerfuegbar(): boolean { return pushSchluessel() !== null; }

// ── Tabellen ────────────────────────────────────────────────────────────────
let tabellenBereit: Promise<void> | null = null;
export function ensurePushTabellen(): Promise<void> {
  if (!tabellenBereit) {
    tabellenBereit = (async () => {
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_push_abos (
        id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT,
        erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(), letzter_erfolg_am TIMESTAMPTZ, letzter_fehler TEXT,
        fehler_folge INTEGER NOT NULL DEFAULT 0, geloescht_am TIMESTAMPTZ)`;
      // Eigene Tabelle (082): die Spalte kam am 06.09.2026 nach der ersten Fassung dazu.
      await sqlPool`ALTER TABLE fiaon_push_abos ADD COLUMN IF NOT EXISTS fehler_folge INTEGER NOT NULL DEFAULT 0`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_push_abos_person_idx ON fiaon_push_abos (person_id) WHERE geloescht_am IS NULL`;
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_push_log (
        id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, anlass TEXT NOT NULL, titel TEXT NOT NULL,
        am TIMESTAMPTZ NOT NULL DEFAULT NOW(), ergebnis TEXT NOT NULL)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_push_log_person_idx ON fiaon_push_log (person_id, am DESC)`;
    })().catch((e) => { tabellenBereit = null; throw e; });
  }
  return tabellenBereit;
}

// ── Zeit (Berlin, nur formatToParts — Zeit-Falle 01.09.2026) ───────────────
/** Minuten seit Mitternacht in Berlin. „24“ als Stunde (ältere ICU) zählt als 0. */
export function berlinMinuten(d: Date = new Date()): number {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const w = (art: string) => Number(teile.find((p) => p.type === art)?.value ?? "0");
  const h = w("hour") === 24 ? 0 : w("hour");
  return h * 60 + w("minute");
}
/** Nachtruhe: ab 21:00 und vor 08:00 Berliner Zeit geht nichts hinaus. */
export function istNachtruhe(d: Date = new Date()): boolean {
  const min = berlinMinuten(d);
  return min >= 21 * 60 || min < 8 * 60;
}

const eur = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
const kurz = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

async function protokoll(personId: number, anlass: string, titel: string, ergebnis: PushErgebnis): Promise<void> {
  try {
    await sqlPool`INSERT INTO fiaon_push_log (person_id, anlass, titel, ergebnis) VALUES (${personId}, ${anlass}, ${kurz(titel, 120)}, ${ergebnis})`;
  } catch (e: any) { console.error("[PUSH] Protokoll:", e?.message || e); }
}

/**
 * Eine Mitteilung an alle aktiven Abos einer Person. Reihenfolge der Wände:
 * Schlüssel → Anlass → Wortwand → Abos → Nachtruhe → Tagesbremse → Versand.
 * Wirft nie; das Ergebnis sagt, was geschah.
 */
export async function pushSenden(personId: number, anlass: PushAnlass | string, inhalt: PushInhalt): Promise<PushResultat> {
  const keiner: PushResultat = { ergebnis: "nicht_verfuegbar", gesendet: 0, abos: 0 };
  try {
    const schluessel = pushSchluessel();
    if (!schluessel) return keiner;
    if (!ANLASS_MENGE.has(String(anlass))) { console.error(`[PUSH] Unbekannter Anlass „${anlass}“ — nicht gesendet.`); return { ergebnis: "uebersprungen", gesendet: 0, abos: 0 }; }
    const titel = String(inhalt.titel || "").trim();
    const text = String(inhalt.text || "").trim();
    const url = String(inhalt.url || "/app").trim();
    if (!titel || !text) return { ergebnis: "uebersprungen", gesendet: 0, abos: 0 };
    if (!url.startsWith("/app")) { console.error(`[PUSH] Ziel „${url}“ liegt nicht in /app — nicht gesendet.`); return { ergebnis: "uebersprungen", gesendet: 0, abos: 0 }; }
    await ensurePushTabellen();

    // Wortwand: Was nicht in eine Kundenmail darf, darf auch nicht auf den Sperrbildschirm.
    const funde = wandPruefen(`${titel}\n${text}`);
    if (funde.length) {
      console.error(`[PUSH] Wortwand (${anlass}): ${funde.map((f) => `${f.art}: „${f.treffer}“`).join("; ")}`);
      await protokoll(personId, anlass, titel, "wand");
      return { ergebnis: "wand", gesendet: 0, abos: 0 };
    }

    const abos = (await sqlPool`SELECT id, endpoint, p256dh, auth FROM fiaon_push_abos WHERE person_id = ${personId} AND geloescht_am IS NULL ORDER BY erstellt_am DESC LIMIT 10`) as any[];
    if (!abos.length) return { ergebnis: "kein_abo", gesendet: 0, abos: 0 };

    if (istNachtruhe()) {
      // Bewusst kein Nachholen: Am Morgen ist die E-Mail längst da, und ein
      // Stapel verspäteter Mitteilungen wäre genau das Gegenteil von Ruhe.
      await protokoll(personId, anlass, titel, "nachtruhe");
      return { ergebnis: "nachtruhe", gesendet: 0, abos: abos.length };
    }

    // Tagesbremse: eine Mitteilung je Berliner Tag und Person — nur echte Sendungen zählen.
    const [heute] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_push_log
       WHERE person_id = ${personId} AND ergebnis = 'gesendet'
         AND (am AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
    if (Number(heute?.n || 0) >= 1) {
      await protokoll(personId, anlass, titel, "tagesbremse");
      return { ergebnis: "tagesbremse", gesendet: 0, abos: abos.length };
    }

    const nutzlast = JSON.stringify({ title: titel, body: text, url, anlass });
    let gesendet = 0;
    for (let i = 0; i < abos.length; i++) {
      const a = abos[i];
      try {
        await webpush.sendNotification(
          { endpoint: String(a.endpoint), keys: { p256dh: String(a.p256dh), auth: String(a.auth) } },
          nutzlast,
          { vapidDetails: { subject: schluessel.subject, publicKey: schluessel.publicKey, privateKey: schluessel.privateKey }, TTL: 6 * 60 * 60, urgency: "normal" },
        );
        gesendet++;
        await sqlPool`UPDATE fiaon_push_abos SET letzter_erfolg_am = NOW(), letzter_fehler = NULL, fehler_folge = 0 WHERE id = ${a.id}`;
      } catch (e: any) {
        const status = Number(e?.statusCode || 0);
        const grund = kurz(`${status || "?"}: ${e?.body || e?.message || e}`, 300);
        if (status === 404 || status === 410) {
          // Der Push-Dienst kennt das Abo nicht mehr (Browser gewechselt, Erlaubnis entzogen).
          await sqlPool`UPDATE fiaon_push_abos SET geloescht_am = NOW(), letzter_fehler = ${grund} WHERE id = ${a.id}`;
        } else {
          // Anderer Fehler: zählen — nach FEHLER_BIS_STILL in Folge ist das Abo tot
          // (oder war nie ein Push-Dienst). Ein Erfolg setzt den Zähler zurück.
          await sqlPool`
            UPDATE fiaon_push_abos
               SET letzter_fehler = ${grund}, fehler_folge = fehler_folge + 1,
                   geloescht_am = CASE WHEN fehler_folge + 1 >= ${FEHLER_BIS_STILL} THEN NOW() ELSE geloescht_am END
             WHERE id = ${a.id}`;
          console.error(`[PUSH] Sendung an Abo #${a.id} scheiterte: ${grund}`);
        }
      }
    }
    const ergebnis: PushErgebnis = gesendet > 0 ? "gesendet" : "fehler";
    await protokoll(personId, anlass, titel, ergebnis);
    return { ergebnis, gesendet, abos: abos.length };
  } catch (e: any) {
    console.error("[PUSH] pushSenden:", e?.message || e);
    return { ergebnis: "fehler", gesendet: 0, abos: 0 };
  }
}

// ── Fertige Sätze je Anlass ─────────────────────────────────────────────────
export interface PushDaten {
  /** Vorgang: Nummer für den Link, Titel wie der Kunde ihn liest (ART_TITEL in fiaon-app-antraege.ts), Empfänger. */
  vorgangId?: number | null;
  titel?: string | null;
  empfaenger?: string | null;
  /** „19.09.2026“ — Frist (Nachfrage) oder Fälligkeit; Text nur, wenn gesetzt. */
  fristAm?: string | null;
  faelligAm?: string | null;
  /** Beträge NUR aus Datenfeldern (Cent). */
  betragCents?: number | null;
  monatlich?: boolean | null;
  rateNr?: number | null;
  /** Bericht: „2026-08“ und „August 2026“, große Zahl als Satz. */
  monat?: string | null;
  monatText?: string | null;
  grosseZahlText?: string | null;
  /** Wer geantwortet hat (Anliegen). */
  name?: string | null;
  /** Kontoanbindung: Tag, an dem die Zustimmung endet. */
  endetAm?: string | null;
  /** Ausdrückliches Ziel; sonst wird es aus dem Anlass abgeleitet (nur /app-Pfade). */
  url?: string | null;
}

/** Der Satz je Anlass — rein, ohne Datenbank, testbar. Null = zu diesem Anlass gibt es nichts zu sagen. */
export function pushSatzFuer(art: PushAnlass, daten: PushDaten = {}): PushInhalt | null {
  const vorgang = daten.vorgangId ? `/app/vorgaenge/${daten.vorgangId}` : "/app/vorgaenge";
  const titel = String(daten.titel || "").trim() || "Ihr Vorgang";
  const betrag = typeof daten.betragCents === "number" && daten.betragCents > 0 ? eur(daten.betragCents) : null;
  const ziel = (rueckfall: string) => (daten.url && daten.url.startsWith("/app") ? daten.url : rueckfall);
  switch (art) {
    case "zahlung_eingegangen":
      return { titel: "Zahlung eingegangen", text: betrag ? `${betrag} sind bei uns eingegangen${daten.rateNr ? ` – Rate ${daten.rateNr}` : ""}. Den Haken sehen Sie unter Geld.` : "Ihre Zahlung ist bei uns eingegangen. Den Haken sehen Sie unter Geld.", url: ziel("/app/geld") };
    case "unterschrift_wartet":
      return { titel: "Ein Schreiben wartet auf Ihre Unterschrift", text: `${titel} ist vorbereitet. Lesen Sie es und unterschreiben Sie mit dem Finger.`, url: ziel(vorgang) };
    case "vorgang_versandt":
      // frist_am ist die Antwortfrist — KEIN Datum einer Nachfrage (die macht ein Mensch, ohne festen Tag).
      return { titel: "Versandt", text: `${titel} ist${daten.empfaenger ? ` an ${daten.empfaenger}` : ""} unterwegs.${daten.fristAm ? ` Antwort erwartet bis ${daten.fristAm}.` : ""}`, url: ziel(vorgang) };
    case "antwort_da":
      // Entsteht, wenn der Kunde die Antwort fotografiert hat — ob und wann jemand das Ergebnis einträgt, steht in keinem Feld.
      return { titel: "Antwort eingegangen", text: `Zu ${titel} liegt eine Antwort in Ihrer Akte.`, url: ziel(vorgang) };
    case "vorgang_bewilligt":
      return { titel: "Bewilligt", text: `${titel}: bewilligt${betrag ? ` – ${betrag}${daten.monatlich ? " im Monat" : ""}` : ""}. Die Einzelheiten stehen in Ihrer Akte.`, url: ziel(vorgang) };
    case "frist_ueberfaellig":
      // Der Fristenwächter legt beim Ablauf nur den AUFTRAG zum Nachfassen an; „Wir haben nachgefragt“ schreibt erst die Nachfass-Route.
      return { titel: "Keine Antwort bis zur Frist", text: `Zu ${titel} kam bis ${daten.fristAm ?? "zur Frist"} keine Antwort. Ihre Ansprechperson hat den Auftrag, bei der Stelle nachzufragen. Sie müssen nichts tun.`, url: ziel(vorgang) };
    case "rate_faellig_3_tage":
      // Titel aus dem Datum, nicht aus „drei Tagen“ — der Tageslauf feuert nicht auf die Stunde genau.
      return { titel: daten.faelligAm ? `Rate fällig am ${daten.faelligAm}` : "Ihre nächste Rate wird fällig", text: `${daten.rateNr ? `Rate ${daten.rateNr}` : "Ihre nächste Rate"}${betrag ? ` über ${betrag}` : ""}${daten.faelligAm ? ` ist am ${daten.faelligAm} fällig` : " wird fällig"}. Verwendungszweck und Zahlungsweg stehen unter Geld.`, url: ziel("/app/geld/zahlen") };
    case "bericht_da":
      return { titel: `Ihr Bericht für ${daten.monatText || "den Vormonat"} ist da`, text: String(daten.grosseZahlText || "").trim() || "Rechnen Sie nach, was in diesem Monat für Sie entstanden ist.", url: ziel(daten.monat ? `/app/geld/bericht/${daten.monat}` : "/app/geld") };
    case "antwort_anliegen":
      return { titel: "Antwort auf Ihr Anliegen", text: `${String(daten.name || "").trim() || "Ihr Ansprechpartner"} hat auf Ihre Nachricht geantwortet. Die Antwort steht in Ihrer Akte.`, url: ziel(daten.vorgangId ? vorgang : "/app/mehr/hilfe") };
    case "kontoanbindung_laeuft_ab":
      // Ohne Datum kein Satz („bald“ wäre eine Zeitzusage ohne Feld). Der Bildschirm Konto hängt unter /unterlagen/konto (Bereich.tsx).
      if (!daten.endetAm) return null;
      return { titel: "Kontoanbindung läuft ab", text: `Ihre Zustimmung zur Kontoanbindung endet am ${daten.endetAm}. Ob Sie sie erneuern, entscheiden Sie unter Unterlagen → Konto.`, url: ziel("/app/unterlagen/konto") };
    default:
      return null;
  }
}

/** Aktiver oder gerade eingerichteter Bankeinzug — dann keine Ratenerinnerung (dieselbe Regel wie GET /app/zahlung). */
async function bankeinzugAktiv(personId: number): Promise<boolean> {
  try {
    const [p] = (await sqlPool`SELECT gc_mandate_ref, gc_mandate_status FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
    return !!p?.gc_mandate_ref && ["active", "submitted", "created"].indexOf(String(p.gc_mandate_status || "")) !== -1;
  } catch { return false; }
}

/**
 * Push bei einem Ereignis — die Stelle, die die Hauptsitzung an Versand, Ergebnis,
 * Nachfrage, Unterschrift, Zahlungseingang, Bericht und Fristenwächter hängt.
 * Ruft den Satz je Anlass, prüft die Sonderregel (Rate nur ohne Bankeinzug) und
 * sendet. Wirft nie.
 */
export async function pushBeiEreignis(personId: number, art: PushAnlass, daten: PushDaten = {}): Promise<PushResultat> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) return { ergebnis: "uebersprungen", gesendet: 0, abos: 0 };
    if (!pushVerfuegbar()) return { ergebnis: "nicht_verfuegbar", gesendet: 0, abos: 0 };
    if (art === "rate_faellig_3_tage" && (await bankeinzugAktiv(personId))) return { ergebnis: "uebersprungen", gesendet: 0, abos: 0 };
    const inhalt = pushSatzFuer(art, daten);
    if (!inhalt) return { ergebnis: "uebersprungen", gesendet: 0, abos: 0 };
    return await pushSenden(personId, art, inhalt);
  } catch (e: any) {
    console.error("[PUSH] pushBeiEreignis:", e?.message || e);
    return { ergebnis: "fehler", gesendet: 0, abos: 0 };
  }
}

// ── Abos (für den Router) ───────────────────────────────────────────────────
export interface PushAboEingabe { endpoint: string; p256dh: string; auth: string; userAgent?: string | null }

/**
 * Die echten Push-Dienste — nur an sie schickt der Server signierte POSTs.
 * Ein Endpunkt ist eine URL, die der KUNDE liefert; ohne diese Liste ließe
 * sich der Frankfurt-Dienst auf jede HTTPS-Adresse schicken (interne Namen,
 * fremde Dienste). Genaue Hosts oder Endungen mit führendem Punkt.
 */
export const ENDPUNKT_HOSTS: readonly string[] = [
  "fcm.googleapis.com", "android.googleapis.com",          // Chrome, Edge, Android
  ".push.services.mozilla.com", "updates.push.services.mozilla.com", // Firefox
  ".push.apple.com",                                       // Safari / iOS
  ".notify.windows.com",                                   // Edge (WNS)
];
/** Aktive Abos je Mensch — mehr Geräte hat niemand; darüber wird das älteste stillgelegt. */
export const ABOS_JE_PERSON = 10;
/** Fehler in Folge (nicht 404/410), nach denen ein Abo stillgelegt wird. */
export const FEHLER_BIS_STILL = 5;

/** Gehört der Host zu einem echten Push-Dienst? Keine rohen IPs, kein localhost, keine Ports. */
export function endpunktErlaubt(endpoint: string): boolean {
  let u: URL;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== "https:" || u.port || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":") || host.endsWith(".local")) return false;
  return ENDPUNKT_HOSTS.some((h) => (h.startsWith(".") ? host.endsWith(h) : host === h));
}

/** Prüft ein Browser-Abo auf Form: https-Endpunkt eines echten Push-Dienstes, beide Schlüssel, nichts Überlanges. */
export function aboPruefen(roh: any): PushAboEingabe | null {
  const endpoint = String(roh?.endpoint || "").trim();
  const p256dh = String(roh?.keys?.p256dh || "").trim();
  const auth = String(roh?.keys?.auth || "").trim();
  if (!/^https:\/\/[^\s]{8,}$/i.test(endpoint) || endpoint.length > 2000) return null;
  if (!endpunktErlaubt(endpoint)) return null;
  if (!p256dh || p256dh.length > 300 || !auth || auth.length > 100) return null;
  if (!/^[A-Za-z0-9_\-=]+$/.test(p256dh) || !/^[A-Za-z0-9_\-=]+$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

/**
 * Abo speichern — UPSERT über den Endpunkt; ein gelöschtes Abo lebt damit
 * wieder auf. Danach den Deckel halten: mehr als ABOS_JE_PERSON aktive Abos
 * je Mensch gibt es nicht — die ältesten werden stillgelegt (geloescht_am).
 */
export async function aboSpeichern(personId: number, abo: PushAboEingabe): Promise<void> {
  await ensurePushTabellen();
  await sqlPool`
    INSERT INTO fiaon_push_abos (person_id, endpoint, p256dh, auth, user_agent)
    VALUES (${personId}, ${abo.endpoint}, ${abo.p256dh}, ${abo.auth}, ${abo.userAgent ? kurz(abo.userAgent, 300) : null})
    ON CONFLICT (endpoint) DO UPDATE SET
      person_id = EXCLUDED.person_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent,
      geloescht_am = NULL, letzter_fehler = NULL, fehler_folge = 0`;
  await sqlPool`
    UPDATE fiaon_push_abos SET geloescht_am = NOW(), letzter_fehler = 'Deckel: zu viele Abos je Person'
     WHERE id IN (
       SELECT id FROM fiaon_push_abos
        WHERE person_id = ${personId} AND geloescht_am IS NULL
        ORDER BY erstellt_am DESC, id DESC
       OFFSET ${ABOS_JE_PERSON})`;
}

/** Abo abmelden — nur das eigene (person_id), nur geloescht_am setzen. Liefert, ob eine Zeile getroffen wurde. */
export async function aboLoeschen(personId: number, endpoint: string): Promise<boolean> {
  await ensurePushTabellen();
  const zeilen = (await sqlPool`UPDATE fiaon_push_abos SET geloescht_am = NOW() WHERE person_id = ${personId} AND endpoint = ${endpoint} AND geloescht_am IS NULL RETURNING id`) as any[];
  return zeilen.length > 0;
}

/** Hat die Person ein aktives Abo — optional: genau dieses Gerät (Endpunkt)? */
export async function aboVorhanden(personId: number, endpoint?: string | null): Promise<boolean> {
  await ensurePushTabellen();
  const zeilen = endpoint
    ? ((await sqlPool`SELECT 1 FROM fiaon_push_abos WHERE person_id = ${personId} AND endpoint = ${endpoint} AND geloescht_am IS NULL LIMIT 1`) as any[])
    : ((await sqlPool`SELECT 1 FROM fiaon_push_abos WHERE person_id = ${personId} AND geloescht_am IS NULL LIMIT 1`) as any[]);
  return zeilen.length > 0;
}

// ── Tageslauf: Rate in drei Tagen fällig (nur ohne aktiven Bankeinzug) ───────
/**
 * Läuft täglich; findet offene Raten mit Fälligkeit in genau drei Tagen bei Personen ohne
 * aktives Lastschriftmandat und schickt „Ihre nächste Rate wird fällig“. Beträge stehen
 * nicht im Text (TFO-Vorgabe). Idempotent über die Tagesbremse in fiaon_push_log.
 */
export async function pushRatenLauf(): Promise<{ geprueft: number; gesendet: number }> {
  if (!pushVerfuegbar()) return { geprueft: 0, gesendet: 0 };
  await ensurePushTabellen();
  const rows = (await sqlPool`
    SELECT r.rate_nr, r.faellig_am, r.betrag_cents, a.person_id
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE r.status = 'offen' AND r.faellig_am = (CURRENT_DATE + INTERVAL '3 days')::date
       AND a.person_id IS NOT NULL AND a.merged_into IS NULL
       AND NOT (p.gc_mandate_ref IS NOT NULL AND p.gc_mandate_status IN ('active','submitted','created'))
       AND EXISTS (SELECT 1 FROM fiaon_push_abos ab WHERE ab.person_id = a.person_id AND ab.geloescht_am IS NULL)
     LIMIT 500`.catch(() => [])) as any[];
  let gesendet = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const faellig = r.faellig_am ? new Date(r.faellig_am).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : null;
    try {
      const erg = await pushBeiEreignis(Number(r.person_id), "rate_faellig_3_tage", { rateNr: Number(r.rate_nr), faelligAm: faellig, url: "/app/geld/zahlen" });
      if (erg.ergebnis === "gesendet") gesendet++;
    } catch (e: any) { console.error("[PUSH] Ratenlauf:", e?.message || e); }
  }
  return { geprueft: rows.length, gesendet };
}
