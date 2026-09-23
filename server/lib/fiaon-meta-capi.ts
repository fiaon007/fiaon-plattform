// ═══════════════════════════════════════════════════════════════════════════
// DIE MESSUNG ZURÜCK AN META (22.09.2026, E-210)
//
// Justin: „Pixel maximal setzen … sodass wir später auf EVENTS Werbung machen
// können, also dass wir wirklich nur für fertig bezahlte Kunden bezahlen."
//
// ── WARUM ZWEIMAL MESSEN ──────────────────────────────────────────────────
// Der Pixel im Browser wird von Werbeblockern, iPhone-Einstellungen und
// Cookie-Ablehnung weggeschnitten. Deshalb schickt der Server dieselben
// Ereignisse noch einmal (Conversions API). Beide tragen dieselbe
// `event_id` — Meta zählt sie als EIN Ereignis, nicht als zwei.
//
// ── VIER EREIGNISSE, DIE ZÄHLEN ───────────────────────────────────────────
//   InitiateCheckout      Antrag begonnen
//   CompleteRegistration  Antrag abgeschickt
//   Purchase              Zahlung gebucht (mit Betrag)
//   Schedule              Startgespräch gebucht
//
// ── UND DIE STUFEN DES LEADS (das Geld-Signal) ────────────────────────────
// Für Leads aus Lead-Anzeigen meldet die Plattform zusätzlich die Stufe an
// Meta: `qualified_lead` (Antrag fertig) und `converted_lead` (bezahlt), mit
// der Meta-Lead-ID. Damit kann die Kampagne auf „Conversion-Leads" optimieren
// — Meta lernt, welche Menschen wirklich zahlen, statt nur Formulare zu zählen.
//
// ── WAS WIR NIE SENDEN ────────────────────────────────────────────────────
// · Klartext: E-Mail, Telefon und Namen gehen nur als SHA-256.
// · Ohne Marketing-Einwilligung kein Web-Ereignis (§ 25 TDDDG) — die
//   Stufenmeldung des Leads hängt an der Einwilligung aus dem Formular.
// · Keine besonderen Daten (Bonität, Beträge einzelner Auskünfte, Schulden).
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { graph, metaKonfig, MetaFehler } from "./fiaon-meta";
import { META_EREIGNIS, CRM_EREIGNIS, EREIGNIS_TEXT, metaEreignisId, type MetaEreignis } from "../../shared/fiaon-meta-ereignisse";
import { telefonE164 } from "../../shared/fiaon-dach-telefon";

type Lauf = typeof sqlPool;

export const DATENSATZ_SCHLUESSEL = "meta_dataset_id";
export const WEB_SCHALTER = "meta_messung_web_an";
export const CRM_SCHALTER = "meta_messung_crm_an";

// Die Ereignisnamen stehen in shared/fiaon-meta-ereignisse.ts — eine Quelle für
// Browser und Server, damit die Doppel-Erkennung nie auseinanderläuft.
export { META_EREIGNIS, CRM_EREIGNIS, EREIGNIS_TEXT };
export type { MetaEreignis };

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

/** Meta will alles klein, ohne Leerraum — Telefon nur Ziffern mit Landesvorwahl. */
export function hashFeld(art: "em" | "ph" | "fn" | "ln" | "ct" | "zp" | "country", wert: unknown): string | null {
  const roh = String(wert ?? "").trim();
  if (!roh) return null;
  if (art === "ph") {
    const ziffern = roh.replace(/[^\d]/g, "").replace(/^0+/, "");
    return ziffern.length >= 8 ? sha(ziffern) : null;
  }
  const klein = roh.toLowerCase().replace(/\s+/g, art === "fn" || art === "ln" || art === "ct" ? " " : "").trim();
  return klein ? sha(klein) : null;
}

let bereit = false;
export async function capiTabellen(lauf: Lauf = sqlPool): Promise<void> {
  if (bereit) return;
  await lauf`
    CREATE TABLE IF NOT EXISTS fiaon_meta_messung (
      ref TEXT PRIMARY KEY,
      person_id INTEGER,
      lead_id INTEGER,
      fbp TEXT,
      fbc TEXT,
      einwilligung BOOLEAN NOT NULL DEFAULT FALSE,
      ip TEXT,
      ua TEXT,
      seite TEXT,
      erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await lauf`
    CREATE TABLE IF NOT EXISTS fiaon_meta_capi (
      id BIGSERIAL PRIMARY KEY,
      ereignis_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      quelle TEXT NOT NULL,
      ref TEXT,
      person_id INTEGER,
      meta_lead_id TEXT,
      wert_cents INTEGER,
      nutzlast JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'offen',
      versuche INTEGER NOT NULL DEFAULT 0,
      fehler TEXT,
      gesendet_am TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await lauf`CREATE INDEX IF NOT EXISTS fiaon_meta_capi_status ON fiaon_meta_capi (status, created_at)`;
  bereit = true;
}

async function einstellung(key: string, lauf: Lauf): Promise<string | null> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${key} LIMIT 1`.catch(() => [])) as any[];
  const v = String(r?.value ?? "").trim();
  return v || null;
}

/** Der Datensatz (Pixel), an den gemeldet wird. Kommt aus der Einrichtung, sonst aus der Umgebung. */
export async function datensatzId(lauf: Lauf = sqlPool): Promise<string | null> {
  const gesetzt = String(process.env.META_DATASET_ID ?? "").trim();
  if (gesetzt) return gesetzt;
  return einstellung(DATENSATZ_SCHLUESSEL, lauf);
}

async function anAus(key: string, standard: boolean, lauf: Lauf): Promise<boolean> {
  const v = await einstellung(key, lauf);
  return v === null ? standard : v === "1";
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS DER BROWSER MITGIBT
// ═══════════════════════════════════════════════════════════════════════════
export interface MessungVomBrowser {
  fbp?: string | null;
  fbc?: string | null;
  einwilligung?: boolean;
  seite?: string | null;
}

/** Die Werbe-Kennungen eines Antrags merken — einmal je Antrag, später ergänzt. */
export async function messungMerken(
  ref: string,
  m: MessungVomBrowser,
  zusatz: { personId?: number | null; ip?: string | null; ua?: string | null } = {},
  lauf: Lauf = sqlPool,
): Promise<void> {
  if (!ref) return;
  await capiTabellen(lauf);
  const fbp = String(m?.fbp ?? "").slice(0, 200) || null;
  const fbc = String(m?.fbc ?? "").slice(0, 300) || null;
  await lauf`
    INSERT INTO fiaon_meta_messung (ref, person_id, fbp, fbc, einwilligung, ip, ua, seite)
    VALUES (${ref}, ${zusatz.personId ?? null}, ${fbp}, ${fbc}, ${m?.einwilligung === true},
            ${zusatz.ip ?? null}, ${String(zusatz.ua ?? "").slice(0, 500) || null}, ${String(m?.seite ?? "").slice(0, 300) || null})
    ON CONFLICT (ref) DO UPDATE SET
      person_id = COALESCE(EXCLUDED.person_id, fiaon_meta_messung.person_id),
      fbp = COALESCE(EXCLUDED.fbp, fiaon_meta_messung.fbp),
      fbc = COALESCE(EXCLUDED.fbc, fiaon_meta_messung.fbc),
      einwilligung = EXCLUDED.einwilligung OR fiaon_meta_messung.einwilligung,
      ip = COALESCE(EXCLUDED.ip, fiaon_meta_messung.ip),
      ua = COALESCE(EXCLUDED.ua, fiaon_meta_messung.ua),
      seite = COALESCE(EXCLUDED.seite, fiaon_meta_messung.seite),
      updated_at = NOW()`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EREIGNISSE EINREIHEN
// ═══════════════════════════════════════════════════════════════════════════

/** Die Kennung eines Ereignisses — dieselbe im Browser und auf dem Server (Doppel-Erkennung). */
export const ereignisId = metaEreignisId;

/**
 * Kontakt für ein Ereignis ohne Antragszeile (FIAON-Global-Gespräch). Gilt nur
 * als Rückfall — steht der Antrag da, zählen seine Felder.
 */
export interface WebKontakt { email?: string | null; telefon?: string | null; vorname?: string | null; nachname?: string | null }

/**
 * Ein Web-Ereignis zu einem Antrag einreihen. Ohne Marketing-Einwilligung
 * passiert nichts — leise, ohne Fehler.
 */
export async function webEreignis(
  name: MetaEreignis,
  ref: string,
  opts: { wertCents?: number | null; paket?: string | null; kontakt?: WebKontakt } = {},
  lauf: Lauf = sqlPool,
): Promise<"eingereiht" | "keine_einwilligung" | "doppelt" | "aus"> {
  if (!ref) return "aus";
  await capiTabellen(lauf);
  if (!(await anAus(WEB_SCHALTER, true, lauf))) return "aus";
  const [m] = (await lauf`
    SELECT m.fbp, m.fbc, m.einwilligung, m.ip, m.ua, m.seite, a.ref AS antrag_ref, a.email, a.phone, a.phone_country_code,
           a.contact_email, a.contact_phone,
           a.first_name, a.last_name, a.zip, a.city, a.country, a.person_id, a.pack_name, a.amount_due
      FROM fiaon_meta_messung m
      LEFT JOIN fiaon_applications a ON a.ref = m.ref
     WHERE m.ref = ${ref}`) as any[];
  if (!m) return "keine_einwilligung";
  if (!m.einwilligung) return "keine_einwilligung";
  // E-231: Firmenaufträge (FIAON Global) tragen Mail und Telefon in contact_*, nicht in email/phone —
  // ohne Rückfall ging ihr Kauf ohne Telefon an Meta. Ein Gespräch ohne Antrag bringt den Kontakt selbst mit.
  const kontakt = opts.kontakt ?? {};
  const telefon = (m.phone ? [m.phone_country_code, m.phone].filter(Boolean).join("") : "")
    || m.contact_phone || (kontakt.telefon ? telefonE164("+49", kontakt.telefon) : "");
  const nutzer: Record<string, unknown> = {};
  const setz = (k: string, v: string | null) => { if (v) nutzer[k] = [v]; };
  setz("em", hashFeld("em", m.email || m.contact_email || kontakt.email));
  setz("ph", hashFeld("ph", telefon));
  setz("fn", hashFeld("fn", m.first_name || kontakt.vorname));
  setz("ln", hashFeld("ln", m.last_name || kontakt.nachname));
  setz("zp", hashFeld("zp", m.zip));
  setz("ct", hashFeld("ct", m.city));
  // Das Land nur, wenn ein Antrag es kennt — für ein Gespräch ohne Antrag wäre „de" geraten.
  if (m.antrag_ref) setz("country", hashFeld("country", m.country === "AT" ? "at" : m.country === "CH" ? "ch" : m.country || "de"));
  if (m.fbp) nutzer.fbp = m.fbp;
  if (m.fbc) nutzer.fbc = m.fbc;
  if (m.ip) nutzer.client_ip_address = m.ip;
  if (m.ua) nutzer.client_user_agent = m.ua;

  const wert = opts.wertCents ?? (m.amount_due != null ? Math.round(Number(m.amount_due) * 100) : null);
  const nutzlast = {
    event_name: name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: ereignisId(name, ref),
    action_source: "website",
    ...(m.seite ? { event_source_url: `https://fiaon.com${m.seite}` } : {}),
    user_data: nutzer,
    custom_data: {
      currency: "EUR",
      ...(wert != null ? { value: Number((wert / 100).toFixed(2)) } : {}),
      ...(opts.paket || m.pack_name ? { content_name: String(opts.paket ?? m.pack_name).slice(0, 100) } : {}),
    },
  };
  const zeilen = (await lauf`
    INSERT INTO fiaon_meta_capi (ereignis_id, name, quelle, ref, person_id, wert_cents, nutzlast)
    VALUES (${String(nutzlast.event_id)}, ${name}, 'web', ${ref}, ${m.person_id ?? null}, ${wert}, ${lauf.json(nutzlast as any)})
    ON CONFLICT (ereignis_id) DO NOTHING RETURNING id`) as any[];
  return zeilen.length ? "eingereiht" : "doppelt";
}

/**
 * Die Stufe eines Leads an Meta melden — das Signal, auf das die Kampagne
 * optimieren kann („dieser Lead hat wirklich bezahlt").
 */
export async function crmEreignis(
  stufe: "qualified_lead" | "converted_lead",
  opts: { ref?: string | null; personId?: number | null; metaLeadId?: string | null; wertCents?: number | null },
  lauf: Lauf = sqlPool,
): Promise<"eingereiht" | "kein_lead" | "doppelt" | "aus"> {
  await capiTabellen(lauf);
  if (!(await anAus(CRM_SCHALTER, true, lauf))) return "aus";
  let metaLeadId = opts.metaLeadId ?? null;
  if (!metaLeadId) {
    const [l] = (await lauf`
      SELECT meta_lead_id FROM fiaon_leads
       WHERE meta_lead_id IS NOT NULL
         AND ((${opts.ref ?? null}::text IS NOT NULL AND converted_order_id = ${opts.ref ?? null})
           OR (${opts.personId ?? null}::int IS NOT NULL AND person_id = ${opts.personId ?? null}))
       ORDER BY erstellt_am DESC LIMIT 1`) as any[];
    metaLeadId = l?.meta_lead_id ?? null;
  }
  // Zweiter Anlauf über den Menschen: Der Antrag kann an einem Lead hängen, der
  // nur über die Person verbunden ist (Abgleich über Mail/Telefon statt Link).
  if (!metaLeadId && opts.ref) {
    const [l] = (await lauf`
      SELECT le.meta_lead_id FROM fiaon_leads le
        JOIN fiaon_applications a ON a.person_id = le.person_id
       WHERE a.ref = ${opts.ref} AND le.meta_lead_id IS NOT NULL
       ORDER BY le.erstellt_am DESC LIMIT 1`) as any[];
    metaLeadId = l?.meta_lead_id ?? null;
  }
  if (!metaLeadId) return "kein_lead";
  const nutzlast = {
    event_name: stufe,
    event_time: Math.floor(Date.now() / 1000),
    event_id: `${stufe}.${metaLeadId}`,
    action_source: "system_generated",
    user_data: { lead_id: Number(metaLeadId) },
    custom_data: {
      lead_event_source: "FIAON Plattform",
      event_source: "crm",
      ...(opts.wertCents != null ? { currency: "EUR", value: Number((opts.wertCents / 100).toFixed(2)) } : {}),
    },
  };
  const zeilen = (await lauf`
    INSERT INTO fiaon_meta_capi (ereignis_id, name, quelle, ref, person_id, meta_lead_id, wert_cents, nutzlast)
    VALUES (${nutzlast.event_id}, ${stufe}, 'crm', ${opts.ref ?? null}, ${opts.personId ?? null}, ${metaLeadId}, ${opts.wertCents ?? null}, ${lauf.json(nutzlast as any)})
    ON CONFLICT (ereignis_id) DO NOTHING RETURNING id`) as any[];
  return zeilen.length ? "eingereiht" : "doppelt";
}

// ═══════════════════════════════════════════════════════════════════════════
// SENDEN
// ═══════════════════════════════════════════════════════════════════════════
let laeuft = false;

/** Offene Ereignisse an Meta schicken. Läuft im Takt und direkt nach dem Einreihen. */
export async function capiLauf(hoechstens = 50, lauf: Lauf = sqlPool): Promise<{ gesendet: number; fehler: number; offen: number }> {
  if (laeuft) return { gesendet: 0, fehler: 0, offen: 0 };
  laeuft = true;
  try {
    await capiTabellen(lauf);
    if (!metaKonfig().bereit) return { gesendet: 0, fehler: 0, offen: 0 };
    const datensatz = await datensatzId(lauf);
    if (!datensatz) return { gesendet: 0, fehler: 0, offen: 0 };
    const offen = (await lauf`
      SELECT id, nutzlast FROM fiaon_meta_capi
       WHERE status IN ('offen', 'fehler') AND versuche < 6
       ORDER BY created_at ASC LIMIT ${hoechstens}`) as any[];
    if (!offen.length) return { gesendet: 0, fehler: 0, offen: 0 };
    const daten = offen.map((z) => (typeof z.nutzlast === "string" ? JSON.parse(z.nutzlast) : z.nutzlast));
    const ids = offen.map((z) => Number(z.id));
    try {
      const antwort = await graph(`${datensatz}/events`, {
        methode: "POST",
        params: { data: JSON.stringify(daten) },
      });
      await lauf`
        UPDATE fiaon_meta_capi SET status = 'gesendet', gesendet_am = NOW(), versuche = versuche + 1, fehler = NULL
         WHERE id = ANY(${ids})`;
      console.log(`[META-MESSUNG] ${daten.length} Ereignis(se) gemeldet (${antwort?.events_received ?? "?"} angenommen)`);
      return { gesendet: daten.length, fehler: 0, offen: 0 };
    } catch (err) {
      const text = err instanceof MetaFehler ? err.klartext : err instanceof Error ? err.message : String(err);
      await lauf`
        UPDATE fiaon_meta_capi SET status = 'fehler', versuche = versuche + 1, fehler = ${text.slice(0, 400)}
         WHERE id = ANY(${ids})`;
      console.error("[META-MESSUNG] Senden fehlgeschlagen:", text.slice(0, 200));
      return { gesendet: 0, fehler: daten.length, offen: daten.length };
    }
  } finally {
    laeuft = false;
  }
}

/** Einreihen und gleich senden — für die Stellen, an denen es schnell gehen soll. */
export function meldenUndSenden(fn: () => Promise<unknown>): void {
  void fn()
    .then(() => capiLauf(20))
    .catch((e) => console.error("[META-MESSUNG]", e));
}

// ═══════════════════════════════════════════════════════════════════════════
// EREIGNISSE AUSSERHALB DES ANTRAGS — FIAON GLOBAL (23.09.2026, E-231)
//
// FIAON Global hat zwei Wege, die nicht über das Antragsformular laufen: das
// Gespräch (Kalender oder Rückruf-Anfrage) und den Auftrag auf /business/start.
// Beide meldeten Meta nie etwas: Das Gespräch läuft nicht über
// `buchungAnwenden` (dort sitzt die Schedule-Meldung der Privatkunden), und der
// Auftrag legt seinen Antrag serverseitig an, ohne die Kennungen des Browsers.
// Ohne Messsatz blieb deshalb auch der spätere Kauf (Purchase in
// onCustomerPaid) für jeden Global-Auftrag still.
//
// Hier merkt sich der Server fbp/fbc, Adresse und Browser unter der Referenz,
// die auch der Pixel benutzt (Gespräch: `messRef` aus der Antwort, Auftrag: die
// Auftragsreferenz), und reiht das Ereignis ein — eine Kennung, ein Ereignis.
// Ohne Marketing-Einwilligung wird NICHTS gespeichert, auch keine Adresse.
// ═══════════════════════════════════════════════════════════════════════════
export function ereignisMitMessung(
  name: MetaEreignis,
  ref: string,
  messung: unknown,
  zusatz: { ip?: string | null; ua?: string | null; wertCents?: number | null; paket?: string | null; kontakt?: WebKontakt } = {},
): void {
  const m = messung && typeof messung === "object" ? (messung as MessungVomBrowser) : null;
  if (!ref || !m || m.einwilligung !== true) return;
  meldenUndSenden(async () => {
    await messungMerken(ref, m, { ip: zusatz.ip ?? null, ua: zusatz.ua ?? null });
    await webEreignis(name, ref, { wertCents: zusatz.wertCents ?? null, paket: zusatz.paket ?? null, kontakt: zusatz.kontakt });
  });
}

/** Zahlen für das Steuerpult. */
export async function capiZahlen(lauf: Lauf = sqlPool): Promise<{
  datensatz: string | null; web: boolean; crm: boolean;
  heute: { name: string; n: number }[]; offen: number; fehler: number; letzterFehler: string | null;
}> {
  await capiTabellen(lauf);
  const heute = (await lauf`
    SELECT name, COUNT(*)::int AS n FROM fiaon_meta_capi
     WHERE created_at > date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
     GROUP BY name ORDER BY n DESC`) as any[];
  const [z] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE status IN ('offen', 'fehler'))::int AS offen,
           COUNT(*) FILTER (WHERE status = 'fehler')::int AS fehler,
           (SELECT fehler FROM fiaon_meta_capi WHERE fehler IS NOT NULL ORDER BY id DESC LIMIT 1) AS letzter
      FROM fiaon_meta_capi WHERE created_at > NOW() - INTERVAL '7 days'`) as any[];
  return {
    datensatz: await datensatzId(lauf),
    web: await anAus(WEB_SCHALTER, true, lauf),
    crm: await anAus(CRM_SCHALTER, true, lauf),
    heute: heute.map((h) => ({ name: String(h.name), n: Number(h.n) })),
    offen: Number(z?.offen || 0), fehler: Number(z?.fehler || 0), letzterFehler: z?.letzter ?? null,
  };
}

/**
 * Ein Probe-Ereignis mit dem Testcode aus dem Events-Manager. Es erscheint dort
 * unter „Testereignisse“ und zählt NICHT für die Optimierung — so sieht Justin
 * in Sekunden, ob die Leitung steht, ohne die Zahlen zu verfälschen.
 */
export async function probeSenden(testCode: string, lauf: Lauf = sqlPool): Promise<{ ok: boolean; angenommen?: number; fehler?: string }> {
  await capiTabellen(lauf);
  if (!metaKonfig().bereit) return { ok: false, fehler: "Der Meta-Zugang fehlt noch." };
  const datensatz = await datensatzId(lauf);
  if (!datensatz) return { ok: false, fehler: "Noch kein Datensatz — zuerst „Verbindung einrichten“." };
  const code = String(testCode || "").trim();
  if (!code) return { ok: false, fehler: "Der Testcode aus dem Events-Manager fehlt (TEST12345)." };
  const nutzlast = {
    event_name: META_EREIGNIS.antragBegonnen,
    event_time: Math.floor(Date.now() / 1000),
    event_id: `probe.${Date.now()}`,
    action_source: "website",
    event_source_url: "https://fiaon.com/antrag",
    user_data: { em: [sha("probe@fiaon.com")], client_user_agent: "FIAON-Pruefstand" },
    custom_data: { currency: "EUR", value: 1 },
  };
  try {
    const a = await graph(`${datensatz}/events`, {
      methode: "POST",
      params: { data: JSON.stringify([nutzlast]), test_event_code: code },
    });
    console.log(`[META-MESSUNG] Probe mit Testcode ${code} gesendet (${a?.events_received ?? "?"} angenommen)`);
    return { ok: true, angenommen: Number(a?.events_received ?? 0) };
  } catch (err) {
    return { ok: false, fehler: err instanceof MetaFehler ? err.klartext : err instanceof Error ? err.message : String(err) };
  }
}

/** Die letzten gemeldeten Ereignisse — für das Steuerpult, ohne Nutzlast. */
export async function letzteEreignisse(hoechstens = 30, lauf: Lauf = sqlPool): Promise<any[]> {
  await capiTabellen(lauf);
  return (await lauf`
    SELECT id, ereignis_id, name, quelle, ref, meta_lead_id, wert_cents, status, versuche, fehler, gesendet_am, created_at
      FROM fiaon_meta_capi ORDER BY id DESC LIMIT ${Math.min(Math.max(hoechstens, 1), 100)}`) as any[];
}

/** Den Datensatz von Hand setzen (wenn Justin die Kennung aus dem Events-Manager kopiert). */
export async function datensatzSetzen(id: string, lauf: Lauf = sqlPool): Promise<void> {
  const rein = String(id || "").replace(/[^\d]/g, "");
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${DATENSATZ_SCHLUESSEL}, ${rein}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

/** Einen der beiden Messwege an- oder ausschalten. */
export async function messungSchalten(welcher: "web" | "crm", an: boolean, lauf: Lauf = sqlPool): Promise<void> {
  const key = welcher === "web" ? WEB_SCHALTER : CRM_SCHALTER;
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${an ? "1" : "0"}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}
