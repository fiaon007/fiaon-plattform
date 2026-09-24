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
// · Keine besonderen Daten (Bonität, Score, Schulden, Inhalte einer Auskunft).
//   Gemeldet wird nur, WAS gekauft wurde (Produktart) und der gezahlte Betrag.
//
// ── NACHGESCHÄRFT (24.09.2026, E-239) ─────────────────────────────────────
// Justin: „Prüfe die Events, sodass wir wirklich auf Verkäufe arbeiten können
// — und denke an die SCHUFA." Gefunden und behoben:
// · Lead-ID als JS-Zahl: 17-stellige IDs verlieren die letzte Ziffer
//   (28570028345986229 → …228) — Meta lehnte ab („Invalid parameter"). Die ID
//   reist jetzt als Text und wird erst im fertigen JSON zur Ziffernfolge.
// · Ein kaputtes Ereignis riss den ganzen Stapel (bis 50) mit: Meta lehnt eine
//   Anfrage als Ganzes ab. Jetzt wird bei Inhaltsfehlern halbiert, bis das eine
//   schlechte Ereignis allein steht („abgelehnt"); der Rest geht raus.
// · Älter als 7 Tage nimmt Meta nicht an — solche Ereignisse heißen „zu_alt"
//   statt sechsmal vergeblich wiederholt zu werden.
// · Telefon: „+49" + „0151…" wurde zu 490151… gehasht (Null nach der Vorwahl) —
//   jetzt über telefonE164. Namen/Ort nur Buchstaben („Neutraubling " traf nie).
// · Kauf: Wert = die tatsächlich gebuchte erste Zahlung, Zeitpunkt = Buchung,
//   dazu die Produktart (Karte, Auskunft, Firmenkunde). Auskünfte aus dem
//   Kundenbereich haben keinen eigenen Messsatz — sie erben den des Menschen.
// · Wert nur noch am Kauf: „amount_due" an Antrag begonnen/abgeschickt war
//   Altlast (E-181) und verfälschte den Wert je Ergebnis.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { graph, metaKonfig, MetaFehler } from "./fiaon-meta";
import { META_EREIGNIS, CRM_EREIGNIS, EREIGNIS_TEXT, META_PRODUKT, metaEreignisId, type MetaEreignis, type MetaProdukt } from "../../shared/fiaon-meta-ereignisse";
import { telefonE164 } from "../../shared/fiaon-dach-telefon";
import { istGlobalPaket } from "../../shared/fiaon-pakete";

type Lauf = typeof sqlPool;

export const DATENSATZ_SCHLUESSEL = "meta_dataset_id";
export const WEB_SCHALTER = "meta_messung_web_an";
export const CRM_SCHALTER = "meta_messung_crm_an";

// Die Ereignisnamen stehen in shared/fiaon-meta-ereignisse.ts — eine Quelle für
// Browser und Server, damit die Doppel-Erkennung nie auseinanderläuft.
export { META_EREIGNIS, CRM_EREIGNIS, EREIGNIS_TEXT, META_PRODUKT };
export type { MetaEreignis, MetaProdukt };

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

/**
 * Meta will jedes Feld vor dem Hashen gleich geschrieben haben: klein, ohne
 * Leerraum. Namen und Ort nur Buchstaben (Umlaute bleiben, UTF-8), PLZ ohne
 * Leerzeichen/Strich, Telefon nur Ziffern MIT Landesvorwahl (die Nummer muss
 * vorher über telefonE164 laufen — hier wird nur noch gesäubert).
 */
const NICHT_BUCHSTABE = new RegExp("[^\\p{L}]", "gu");

export function hashFeld(art: "em" | "ph" | "fn" | "ln" | "ct" | "zp" | "country", wert: unknown): string | null {
  const roh = String(wert ?? "").trim();
  if (!roh) return null;
  if (art === "ph") {
    const ziffern = roh.replace(/[^\d]/g, "").replace(/^0+/, "");
    return ziffern.length >= 8 ? sha(ziffern) : null;
  }
  const klein = roh.normalize("NFC").toLowerCase();
  if (art === "fn" || art === "ln" || art === "ct") {
    // Über den Konstruktor: Das u-Flag im Literal lehnt tsc beim Ziel des Projekts ab (TS1501).
    const buchstaben = klein.replace(NICHT_BUCHSTABE, "");
    return buchstaben ? sha(buchstaben) : null;
  }
  const ohneLeer = klein.replace(art === "zp" ? /[\s-]+/g : /\s+/g, "");
  return ohneLeer ? sha(ohneLeer) : null;
}

/** Was ein Auftrag verkauft — für `content_category` am Kauf. */
export function produktFuer(ref: string, packKey: unknown, typ?: unknown): MetaProdukt {
  if (/^FIAON-SCHUFA-/i.test(String(ref || "")) || String(typ ?? "").toLowerCase() === "schufa") return META_PRODUKT.auskunft;
  if (istGlobalPaket(packKey)) return META_PRODUKT.global;
  return META_PRODUKT.karte;
}

/**
 * Der Zeitpunkt eines Ereignisses in Sekunden. Meta nimmt nichts an, was älter
 * als 7 Tage oder in der Zukunft ist — dann gilt „jetzt" (die Buchung).
 */
function ereignisZeit(zeit?: Date | string | null): number {
  const jetzt = Math.floor(Date.now() / 1000);
  if (!zeit) return jetzt;
  const t = Math.floor(new Date(zeit).getTime() / 1000);
  return Number.isFinite(t) && t <= jetzt && jetzt - t < 6 * 86_400 ? t : jetzt;
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
  // ── EINWILLIGUNG, DIE META NENNT (24.09.2026, E-239) ─────────────────────
  // Bis heute nannte der Einwilligungs-Hinweis Meta nicht (Fassung 1). Eine
  // Einwilligung, die den Empfänger nicht nennt, ist nicht informiert — der
  // Server meldet deshalb nur noch für Messsätze mit Fassung ≥ 2. Die alten
  // Sätze bleiben stehen (Nachweis), lösen aber nichts mehr aus.
  await lauf`ALTER TABLE fiaon_meta_messung ADD COLUMN IF NOT EXISTS fassung INTEGER`;
  // Kampagnen-Kennung des Klicks (utm_campaign/utm_id aus der Anzeige) — damit
  // der Kostenbericht einen Website-Kauf seiner Kampagne zuordnen kann.
  await lauf`ALTER TABLE fiaon_meta_messung ADD COLUMN IF NOT EXISTS kampagne JSONB`;
  await lauf`CREATE INDEX IF NOT EXISTS fiaon_meta_messung_fbp ON fiaon_meta_messung (fbp) WHERE fbp IS NOT NULL`;
  // IP und Browser nur MIT Einwilligung (vorher auch ohne: 20 von 20 Sätzen).
  await lauf`UPDATE fiaon_meta_messung SET ip = NULL, ua = NULL WHERE NOT einwilligung AND (ip IS NOT NULL OR ua IS NOT NULL)`
    .catch((e) => console.error("[META-MESSUNG] Bereinigung ohne Einwilligung:", e));
  // E-239: Stufenmeldungen, deren Lead-ID als Zahl gespeichert wurde, auf den
  // exakten Text aus `meta_lead_id` umstellen. Hat die Zahl schon beim Speichern
  // Ziffern verloren, geht die Meldung neu raus (noch nicht angekommen oder mit
  // falscher ID angekommen). Wiederholbar: danach ist die ID ein Text.
  await lauf`
    UPDATE fiaon_meta_capi
       SET nutzlast = jsonb_set(nutzlast, '{user_data,lead_id}', to_jsonb(meta_lead_id)),
           status = CASE WHEN status = 'gesendet' AND nutzlast->'user_data'->>'lead_id' = meta_lead_id THEN status ELSE 'offen' END,
           versuche = CASE WHEN status = 'gesendet' AND nutzlast->'user_data'->>'lead_id' = meta_lead_id THEN versuche ELSE 0 END,
           fehler = CASE WHEN status = 'gesendet' AND nutzlast->'user_data'->>'lead_id' = meta_lead_id THEN fehler ELSE NULL END
     WHERE quelle = 'crm' AND meta_lead_id IS NOT NULL
       AND jsonb_typeof(nutzlast->'user_data'->'lead_id') = 'number'`.catch((e) => console.error("[META-MESSUNG] Lead-ID-Reparatur:", e));
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
  /** Fassung des Einwilligungs-Hinweises (client/src/lib/werbung.ts, FASSUNG). Ab 2 nennt er Meta. */
  fassung?: number | null;
  /** utm_*-Felder des Anzeigenklicks (nur mit Einwilligung). */
  kampagne?: Record<string, unknown> | null;
}

/** Ab dieser Fassung nennt der Einwilligungs-Hinweis Meta (E-239). */
export const META_FASSUNG_AB = 2;

function kampagneSaeubern(k: unknown): Record<string, string> | null {
  if (!k || typeof k !== "object") return null;
  const aus: Record<string, string> = {};
  for (const f of ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_content", "utm_term", "landing"]) {
    const v = (k as Record<string, unknown>)[f];
    if (typeof v === "string" && v.trim()) aus[f] = v.trim().slice(0, 200);
  }
  return Object.keys(aus).length ? aus : null;
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
  // E-239: Ohne Einwilligung wird nichts gespeichert, was Meta dienen könnte —
  // keine Kennungen, keine IP, kein Browser. Und die LETZTE Entscheidung des
  // Browsers gilt (vorher „einmal ja, immer ja": ein Widerruf erreichte den
  // Server nie — Art. 7 Abs. 3 DSGVO verlangt, dass er so einfach wirkt wie die Zustimmung).
  const ja = m?.einwilligung === true;
  const fbp = ja ? String(m?.fbp ?? "").slice(0, 200) || null : null;
  const fbc = ja ? String(m?.fbc ?? "").slice(0, 300) || null : null;
  const fassung = Number.isFinite(Number(m?.fassung)) ? Math.trunc(Number(m?.fassung)) : null;
  const kampagne = ja ? kampagneSaeubern(m?.kampagne) : null;
  await lauf`
    INSERT INTO fiaon_meta_messung (ref, person_id, fbp, fbc, einwilligung, ip, ua, seite, fassung, kampagne)
    VALUES (${ref}, ${zusatz.personId ?? null}, ${fbp}, ${fbc}, ${ja},
            ${ja ? zusatz.ip ?? null : null}, ${ja ? String(zusatz.ua ?? "").slice(0, 500) || null : null},
            ${String(m?.seite ?? "").slice(0, 300) || null}, ${fassung}, ${kampagne ? lauf.json(kampagne as any) : null})
    ON CONFLICT (ref) DO UPDATE SET
      person_id = COALESCE(EXCLUDED.person_id, fiaon_meta_messung.person_id),
      fbp = CASE WHEN EXCLUDED.einwilligung THEN COALESCE(EXCLUDED.fbp, fiaon_meta_messung.fbp) ELSE NULL END,
      fbc = CASE WHEN EXCLUDED.einwilligung THEN COALESCE(EXCLUDED.fbc, fiaon_meta_messung.fbc) ELSE NULL END,
      einwilligung = EXCLUDED.einwilligung,
      ip = CASE WHEN EXCLUDED.einwilligung THEN COALESCE(EXCLUDED.ip, fiaon_meta_messung.ip) ELSE NULL END,
      ua = CASE WHEN EXCLUDED.einwilligung THEN COALESCE(EXCLUDED.ua, fiaon_meta_messung.ua) ELSE NULL END,
      seite = COALESCE(EXCLUDED.seite, fiaon_meta_messung.seite),
      fassung = COALESCE(EXCLUDED.fassung, fiaon_meta_messung.fassung),
      kampagne = COALESCE(EXCLUDED.kampagne, fiaon_meta_messung.kampagne),
      updated_at = NOW()`;
}

/**
 * Widerruf aus dem Browser (E-239): Wer im Einwilligungs-Hinweis „Marketing"
 * abwählt, schickt seine Pixel-Kennung (_fbp) mit — jeder Messsatz dieses
 * Browsers verliert die Einwilligung, bei angemeldeten Kunden jeder Satz der
 * Person. Ab dann meldet der Server nichts mehr (auch keine spätere Zahlung).
 */
export async function einwilligungWiderrufen(opts: { fbp?: string | null; personId?: number | null }, lauf: Lauf = sqlPool): Promise<number> {
  await capiTabellen(lauf);
  const fbp = String(opts.fbp ?? "").trim().slice(0, 200) || null;
  if (!fbp && opts.personId == null) return 0;
  const zeilen = (await lauf`
    UPDATE fiaon_meta_messung
       SET einwilligung = FALSE, fbp = NULL, fbc = NULL, ip = NULL, ua = NULL, kampagne = NULL, updated_at = NOW()
     WHERE einwilligung
       AND ((${fbp}::text IS NOT NULL AND fbp = ${fbp})
         OR (${opts.personId ?? null}::int IS NOT NULL AND (person_id = ${opts.personId ?? null}
              OR ref IN (SELECT ref FROM fiaon_applications WHERE person_id = ${opts.personId ?? null}))))
    RETURNING ref`) as any[];
  // Noch nicht gesendete Web-Ereignisse dieser Sätze gehen nicht mehr raus.
  const refs = zeilen.map((z) => String(z.ref));
  if (refs.length) {
    await lauf`
      UPDATE fiaon_meta_capi SET status = 'widerrufen', fehler = 'Einwilligung widerrufen — nicht gesendet.'
       WHERE quelle = 'web' AND status IN ('offen', 'fehler') AND ref = ANY(${refs})`;
  }
  return refs.length;
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
  opts: {
    wertCents?: number | null; paket?: string | null; kontakt?: WebKontakt;
    /** Nur am Kauf: was gekauft wurde (content_category). */
    produkt?: MetaProdukt | null;
    /** Wann es geschah (Buchung) — älter als 6 Tage oder fehlend: jetzt. */
    zeit?: Date | string | null;
  } = {},
  lauf: Lauf = sqlPool,
): Promise<"eingereiht" | "keine_einwilligung" | "doppelt" | "aus"> {
  if (!ref) return "aus";
  await capiTabellen(lauf);
  if (!(await anAus(WEB_SCHALTER, true, lauf))) return "aus";
  const [a] = (await lauf`
    SELECT ref AS antrag_ref, email, phone, phone_country_code, contact_email, contact_phone,
           first_name, last_name, zip, city, country, person_id, pack_key, pack_name, amount_due, type
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  let [mess] = (await lauf`
    SELECT fbp, fbc, (einwilligung AND COALESCE(fassung, 1) >= ${META_FASSUNG_AB}) AS einwilligung, ip, ua, seite
      FROM fiaon_meta_messung WHERE ref = ${ref}`) as any[];
  // E-239: Eine Auskunft aus dem Kundenbereich (FIAON-SCHUFA-…) oder eine
  // Bestellung, die der Betreuer angelegt hat, hat keinen eigenen Messsatz — der
  // Mensch hat aber beim Antrag eingewilligt. Dann gilt sein jüngster Messsatz
  // MIT Einwilligung. Ohne einen solchen: nichts (wie bisher).
  if (!mess?.einwilligung && a?.person_id) {
    [mess] = (await lauf`
      SELECT m.fbp, m.fbc, m.einwilligung, m.ip, m.ua, m.seite FROM fiaon_meta_messung m
       WHERE m.einwilligung AND COALESCE(m.fassung, 1) >= ${META_FASSUNG_AB}
         AND (m.person_id = ${a.person_id} OR m.ref IN (SELECT ref FROM fiaon_applications WHERE person_id = ${a.person_id}))
       ORDER BY m.updated_at DESC LIMIT 1`) as any[];
  }
  if (!mess?.einwilligung) return "keine_einwilligung";
  const m = { ...(a ?? {}), ...mess };
  // E-231: Firmenaufträge (FIAON Global) tragen Mail und Telefon in contact_*, nicht in email/phone —
  // ohne Rückfall ging ihr Kauf ohne Telefon an Meta. Ein Gespräch ohne Antrag bringt den Kontakt selbst mit.
  // E-239: Vorwahl + Nummer über telefonE164 — „+49" + „0151…" ergab vorher 490151… (die Null blieb).
  const kontakt = opts.kontakt ?? {};
  const telefon = (m.phone ? telefonE164(m.phone_country_code || "+49", m.phone) : "")
    || (m.contact_phone ? telefonE164("+49", m.contact_phone) : "")
    || (kontakt.telefon ? telefonE164("+49", kontakt.telefon) : "");
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

  // E-239: Ein Wert nur am Kauf (oder wenn der Aufrufer ihn ausdrücklich nennt,
  // z. B. der Firmenauftrag). amount_due an „Antrag begonnen" war Altlast.
  const istKauf = name === META_EREIGNIS.zahlung;
  const wert = opts.wertCents ?? (istKauf && m.amount_due != null ? Math.round(Number(m.amount_due) * 100) : null);
  const produkt = istKauf ? (opts.produkt ?? produktFuer(ref, m.pack_key, m.type)) : null;
  const paketName = produkt === META_PRODUKT.auskunft ? "FIAON Auskunft" : (opts.paket ?? m.pack_name ?? null);
  const nutzlast = {
    event_name: name,
    event_time: ereignisZeit(opts.zeit),
    event_id: ereignisId(name, ref),
    action_source: "website",
    ...(m.seite ? { event_source_url: `https://fiaon.com${m.seite}` } : {}),
    user_data: nutzer,
    custom_data: {
      currency: "EUR",
      ...(wert != null ? { value: Number((wert / 100).toFixed(2)) } : {}),
      ...(paketName ? { content_name: String(paketName).slice(0, 100) } : {}),
      ...(produkt ? {
        content_category: produkt,
        content_type: "product",
        content_ids: [String(produkt === META_PRODUKT.auskunft ? produkt : (m.pack_key || produkt))],
        num_items: 1,
        order_id: ref,
      } : {}),
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
  opts: { ref?: string | null; personId?: number | null; metaLeadId?: string | null; wertCents?: number | null; zeit?: Date | string | null },
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
    event_time: ereignisZeit(opts.zeit),
    event_id: `${stufe}.${metaLeadId}`,
    action_source: "system_generated",
    // E-239: als TEXT — Number() macht aus 28570028345986229 …228. Erst
    // nutzlastText() schreibt die exakte Ziffernfolge ins JSON an Meta.
    user_data: { lead_id: String(metaLeadId) },
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

/**
 * Die Nutzlast als JSON für Meta. Lead-IDs reisen intern als Text (sonst
 * verliert JavaScript Ziffern) und werden hier zur nackten Ziffernfolge — so,
 * wie Meta sie verlangt.
 */
export function nutzlastText(daten: unknown[]): string {
  return JSON.stringify(daten).replace(/"lead_id":"(\d{6,25})"/g, '"lead_id":$1');
}

/** Eine gespeicherte Zeile versandfertig: die Lead-ID IMMER aus der Textspalte, nie aus dem JSON. */
function versandNutzlast(z: { nutzlast: unknown; meta_lead_id?: string | null }): any {
  const n = typeof z.nutzlast === "string" ? JSON.parse(z.nutzlast) : z.nutzlast;
  if (z.meta_lead_id && n?.user_data && "lead_id" in n.user_data) n.user_data.lead_id = String(z.meta_lead_id);
  return n;
}

/**
 * Ist ein Fehler eine Frage des INHALTS (ein Ereignis ist kaputt) — dann lohnt
 * das Halbieren. Zugang, Rechte, Bremse, Netz betreffen jeden Teil gleich.
 */
function inhaltsFehler(err: unknown): boolean {
  return err instanceof MetaFehler && err.code === 100 && err.subcode !== 33;
}

/**
 * Einen Teil senden. Lehnt Meta ihn wegen des Inhalts ab, wird halbiert, bis das
 * schuldige Ereignis allein steht — es wird „abgelehnt" (keine Wiederholung),
 * alle anderen gehen raus. Vorher riss EIN kaputtes Ereignis bis zu 49 gute mit.
 */
async function teilSenden(datensatz: string, teil: { id: number; daten: any }[], lauf: Lauf): Promise<{ gesendet: number; fehler: number }> {
  const ids = teil.map((t) => t.id);
  try {
    const antwort = await graph(`${datensatz}/events`, { methode: "POST", params: { data: nutzlastText(teil.map((t) => t.daten)) } });
    await lauf`
      UPDATE fiaon_meta_capi SET status = 'gesendet', gesendet_am = NOW(), versuche = versuche + 1, fehler = NULL
       WHERE id = ANY(${ids})`;
    console.log(`[META-MESSUNG] ${teil.length} Ereignis(se) gemeldet (${antwort?.events_received ?? "?"} angenommen)`);
    return { gesendet: teil.length, fehler: 0 };
  } catch (err) {
    const text = err instanceof MetaFehler ? err.klartext : err instanceof Error ? err.message : String(err);
    if (inhaltsFehler(err) && teil.length > 1) {
      const mitte = Math.ceil(teil.length / 2);
      const a = await teilSenden(datensatz, teil.slice(0, mitte), lauf);
      const b = await teilSenden(datensatz, teil.slice(mitte), lauf);
      return { gesendet: a.gesendet + b.gesendet, fehler: a.fehler + b.fehler };
    }
    if (inhaltsFehler(err)) {
      await lauf`
        UPDATE fiaon_meta_capi SET status = 'abgelehnt', versuche = versuche + 1, fehler = ${text.slice(0, 400)}
         WHERE id = ANY(${ids})`;
      console.error(`[META-MESSUNG] Ereignis ${ids[0]} von Meta abgelehnt:`, text.slice(0, 200));
    } else {
      await lauf`
        UPDATE fiaon_meta_capi SET status = 'fehler', versuche = versuche + 1, fehler = ${text.slice(0, 400)}
         WHERE id = ANY(${ids})`;
      console.error("[META-MESSUNG] Senden fehlgeschlagen:", text.slice(0, 200));
    }
    return { gesendet: 0, fehler: teil.length };
  }
}

/**
 * Löschfrist (E-239): Messsätze und der Nachweis gemeldeter Ereignisse bleiben
 * 13 Monate — so lange wie die Kampagnen-Zuordnung — und werden dann gelöscht.
 * Höchstens einmal am Tag.
 */
let letzteLoeschung = 0;
async function loeschfristAnwenden(lauf: Lauf): Promise<void> {
  if (Date.now() - letzteLoeschung < 86_400_000) return;
  letzteLoeschung = Date.now();
  await lauf`DELETE FROM fiaon_meta_messung WHERE updated_at < NOW() - INTERVAL '13 months'`;
  await lauf`DELETE FROM fiaon_meta_capi WHERE created_at < NOW() - INTERVAL '13 months'`;
}

/** Offene Ereignisse an Meta schicken. Läuft im Takt und direkt nach dem Einreihen. */
export async function capiLauf(hoechstens = 50, lauf: Lauf = sqlPool): Promise<{ gesendet: number; fehler: number; offen: number }> {
  if (laeuft) return { gesendet: 0, fehler: 0, offen: 0 };
  laeuft = true;
  try {
    await capiTabellen(lauf);
    await loeschfristAnwenden(lauf).catch((e) => console.error("[META-MESSUNG] Löschfrist:", e));
    if (!metaKonfig().bereit) return { gesendet: 0, fehler: 0, offen: 0 };
    const datensatz = await datensatzId(lauf);
    if (!datensatz) return { gesendet: 0, fehler: 0, offen: 0 };
    // Meta nimmt nichts an, was älter als 7 Tage ist (eine Stunde Luft für die Uhr).
    await lauf`
      UPDATE fiaon_meta_capi SET status = 'zu_alt', fehler = 'Älter als 7 Tage — Meta nimmt das Ereignis nicht mehr an.'
       WHERE status IN ('offen', 'fehler')
         AND (nutzlast->>'event_time')::bigint < EXTRACT(EPOCH FROM NOW())::bigint - (7 * 86400 - 3600)`;
    const offen = (await lauf`
      SELECT id, nutzlast, meta_lead_id FROM fiaon_meta_capi
       WHERE status IN ('offen', 'fehler') AND versuche < 6
       ORDER BY created_at ASC LIMIT ${hoechstens}`) as any[];
    if (!offen.length) return { gesendet: 0, fehler: 0, offen: 0 };
    const teil = offen.map((z) => ({ id: Number(z.id), daten: versandNutzlast(z) }));
    const erg = await teilSenden(datensatz, teil, lauf);
    return { ...erg, offen: erg.fehler };
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
           COUNT(*) FILTER (WHERE status IN ('fehler', 'abgelehnt', 'zu_alt'))::int AS fehler,
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
