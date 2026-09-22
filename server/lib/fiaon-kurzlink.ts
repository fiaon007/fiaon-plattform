// ═══════════════════════════════════════════════════════════════════════════
// DER PERSÖNLICHE LINK /a/<code> (22.09.2026, E-210)
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Die Lead-Strecke verlinkte `/antrag?lead=<id>`. Der Antrag las `lead` gar
// nicht: kein Vorausfüllen, keine Zuordnung, keine Klickmessung — der Mensch
// tippte Name, Mail und Telefon ein zweites Mal ein, obwohl er sie uns eine
// Minute vorher im Formular gegeben hatte. Und eine fortlaufende Nummer im
// Link wäre zum Vorausfüllen unbrauchbar gewesen: Wer die Zahl ändert, sähe
// fremde Namen.
//
// ── DIE LÖSUNG ─────────────────────────────────────────────────────────────
// Je Lead EIN zufälliger Code (10 Zeichen aus 56, ≈ 3·10^17 Möglichkeiten),
// der in Mail, WhatsApp und SMS derselbe ist. Der Kanal hängt als Pfadteil
// dahinter (/a/<code>/m, /w, /s) — so zählt jede Nachricht ihre Klicks, und
// die WhatsApp-Vorlage braucht nur EINE Variable im Knopf.
//
// ── WOHIN DER KLICK FÜHRT ──────────────────────────────────────────────────
//   · Antrag schon bezahlt          → /login (Kundenbereich)
//   · Antrag da, noch nicht bezahlt → Wiedereinstieg (weiterLink, E-023) —
//     genau dort weiter, wo der Mensch aufgehört hat; bei fertigem Antrag
//     führt der Wiedereinstieg selbst zur Zahlungsseite
//   · sonst                         → /antrag?l=<code>, Name/Mail/Telefon
//     schon eingetragen
//
// ── WAS DER CODE PREISGIBT ─────────────────────────────────────────────────
// Nur Vorname, Nachname, E-Mail und Telefon — das, was der Mensch uns selbst
// ins Formular geschrieben hat, und nur an den, der seinen Link hat. Gültig
// 90 Tage ab der letzten Nachricht, die ihn trug.
// ═══════════════════════════════════════════════════════════════════════════
import { randomBytes } from "node:crypto";
import { sqlPool } from "./db-pool";
import { SEO_BASIS } from "../../shared/fiaon-seo-seiten";

type Lauf = typeof sqlPool;

/** Ohne 0/O, 1/l/I — ein Code, den man aus einer SMS abtippen kann. */
const ZEICHEN = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LAENGE = 10;
export const GUELTIG_TAGE = 90;

/** Kanäle, die ein Klick tragen kann. `a` = Agent/Hand, `x` = unbekannt. */
export type Kanal = "m" | "w" | "s" | "a" | "x";
export const KANAL_TEXT: Record<Kanal, string> = { m: "E-Mail", w: "WhatsApp", s: "SMS", a: "Mitarbeiter", x: "ohne Kennung" };

export function kanalAus(roh: unknown): Kanal {
  const k = String(roh ?? "").trim().toLowerCase();
  return k === "m" || k === "w" || k === "s" || k === "a" ? k : "x";
}

/** Ein neuer Zufallscode. Gleichverteilt: Bytes über 223 werden verworfen (4 × 56 = 224). */
export function neuerCode(): string {
  let code = "";
  while (code.length < CODE_LAENGE) {
    for (const b of Array.from(randomBytes(16))) {
      if (b >= 224) continue;
      code += ZEICHEN[b % ZEICHEN.length];
      if (code.length === CODE_LAENGE) break;
    }
  }
  return code;
}

/** Hat der Code die richtige Form? Schützt die Abfrage vor Unsinn aus der Adresszeile. */
export function codeGueltigeForm(code: unknown): code is string {
  const c = String(code ?? "");
  return c.length === CODE_LAENGE && Array.from(c).every((z) => ZEICHEN.includes(z));
}

/** Die öffentliche Adresse. Immer die Hauptdomain — die WhatsApp-Vorlage kennt nur sie. */
export function kurzlinkUrl(code: string, kanal?: Kanal): string {
  return `${SEO_BASIS}/a/${code}${kanal && kanal !== "x" ? `/${kanal}` : ""}`;
}

let bereit = false;
export async function kurzlinkTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (bereit) return;
  await lauf`
    CREATE TABLE IF NOT EXISTS fiaon_kurzlinks (
      code TEXT PRIMARY KEY,
      lead_id INTEGER,
      person_id INTEGER,
      zweck TEXT NOT NULL DEFAULT 'antrag',
      erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      gueltig_bis TIMESTAMPTZ NOT NULL,
      klicks INTEGER NOT NULL DEFAULT 0,
      klicks_je_kanal JSONB NOT NULL DEFAULT '{}'::jsonb,
      erster_klick_am TIMESTAMPTZ,
      letzter_klick_am TIMESTAMPTZ,
      letztes_ziel TEXT
    )`;
  await lauf`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_kurzlinks_lead_zweck ON fiaon_kurzlinks (lead_id, zweck) WHERE lead_id IS NOT NULL`;
  await lauf`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS link_code TEXT`;
  await lauf`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS link_geoeffnet_am TIMESTAMPTZ`;
  await lauf`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS link_zuletzt_am TIMESTAMPTZ`;
  await lauf`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS link_klicks INTEGER NOT NULL DEFAULT 0`;
  bereit = true;
}

/**
 * Der Code eines Leads — einmal erzeugt, dann stabil. Jede Nachricht, die ihn
 * trägt, verlängert ihn um 90 Tage.
 */
export async function kurzlinkFuerLead(leadId: number, lauf: Lauf = sqlPool): Promise<string> {
  await kurzlinkTabelle(lauf);
  const [da] = (await lauf`
    UPDATE fiaon_kurzlinks SET gueltig_bis = GREATEST(gueltig_bis, NOW() + ${`${GUELTIG_TAGE} days`}::interval)
    WHERE lead_id = ${leadId} AND zweck = 'antrag'
    RETURNING code`) as any[];
  if (da?.code) return String(da.code);
  const [lead] = (await lauf`SELECT person_id FROM fiaon_leads WHERE id = ${leadId}`) as any[];
  for (let versuch = 0; versuch < 5; versuch++) {
    const code = neuerCode();
    const neu = (await lauf`
      INSERT INTO fiaon_kurzlinks (code, lead_id, person_id, zweck, gueltig_bis)
      VALUES (${code}, ${leadId}, ${lead?.person_id ?? null}, 'antrag', NOW() + ${`${GUELTIG_TAGE} days`}::interval)
      ON CONFLICT DO NOTHING
      RETURNING code`) as any[];
    if (neu[0]?.code) {
      await lauf`UPDATE fiaon_leads SET link_code = ${code} WHERE id = ${leadId}`;
      return code;
    }
    // Entweder hat ein paralleler Lauf den Lead gerade versorgt, oder der Code war
    // (astronomisch unwahrscheinlich) vergeben — dann den des Leads nehmen.
    const [inzwischen] = (await lauf`SELECT code FROM fiaon_kurzlinks WHERE lead_id = ${leadId} AND zweck = 'antrag'`) as any[];
    if (inzwischen?.code) return String(inzwischen.code);
  }
  throw new Error("Kurzlink: kein freier Code nach fünf Versuchen");
}

export interface KurzlinkLage {
  code: string;
  leadId: number;
  personId: number | null;
  vorname: string | null;
  nachname: string | null;
  email: string | null;
  telefon: string | null;
  /** Der Antrag, an dem der Mensch schon hängt — oder null. */
  antrag: { ref: string; bezahlt: boolean } | null;
}

/** Wozu gehört der Code? Null, wenn unbekannt, abgelaufen oder die Person gelöscht ist. */
export async function kurzlinkLesen(code: string, lauf: Lauf = sqlPool): Promise<KurzlinkLage | null> {
  if (!codeGueltigeForm(code)) return null;
  await kurzlinkTabelle(lauf);
  const [z] = (await lauf`
    SELECT k.code, k.lead_id, l.person_id, l.vorname, l.nachname, l.email, l.telefon, l.converted_order_id,
           (l.person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = l.person_id)) AS geloescht
      FROM fiaon_kurzlinks k
      JOIN fiaon_leads l ON l.id = k.lead_id
     WHERE k.code = ${code} AND k.gueltig_bis > NOW()`) as any[];
  if (!z || z.geloescht) return null;
  const antraege = (await lauf`
    SELECT ref, payment_status FROM fiaon_applications
     WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL AND cancelled_at IS NULL AND archived_at IS NULL
       AND (ref = ${z.converted_order_id ?? ""}
            OR (${z.person_id ?? null}::int IS NOT NULL AND person_id = ${z.person_id ?? null}
                AND created_at > NOW() - INTERVAL '60 days'))
     ORDER BY (ref = ${z.converted_order_id ?? ""}) DESC, (payment_status = 'paid') DESC, created_at DESC
     LIMIT 1`) as any[];
  const a = antraege[0];
  return {
    code: String(z.code), leadId: Number(z.lead_id), personId: z.person_id ?? null,
    vorname: z.vorname ?? null, nachname: z.nachname ?? null, email: z.email ?? null, telefon: z.telefon ?? null,
    antrag: a ? { ref: String(a.ref), bezahlt: a.payment_status === "paid" } : null,
  };
}

/**
 * Einen Klick zählen — am Code und am Lead. Der erste Klick eines Tages
 * landet im Verlauf des Leads („Link geöffnet (WhatsApp)"), jeder weitere nur
 * im Zähler: zehn Klicks in einer Minute sind kein Ereignis, sondern ein Handy.
 */
export async function klickZaehlen(lage: KurzlinkLage, kanal: Kanal, ziel: string, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`
    UPDATE fiaon_kurzlinks SET
      klicks = klicks + 1,
      klicks_je_kanal = jsonb_set(klicks_je_kanal, ARRAY[${kanal}::text],
        to_jsonb(COALESCE((klicks_je_kanal ->> ${kanal})::int, 0) + 1)),
      erster_klick_am = COALESCE(erster_klick_am, NOW()),
      letzter_klick_am = NOW(),
      letztes_ziel = ${ziel}
    WHERE code = ${lage.code}`;
  const [vorher] = (await lauf`
    UPDATE fiaon_leads l SET
      link_klicks = l.link_klicks + 1,
      link_geoeffnet_am = COALESCE(l.link_geoeffnet_am, NOW()),
      link_zuletzt_am = NOW()
    FROM (SELECT id, link_zuletzt_am AS alt FROM fiaon_leads WHERE id = ${lage.leadId}) v
    WHERE l.id = v.id
    RETURNING v.alt`) as any[];
  const altAm = vorher?.alt ? new Date(vorher.alt) : null;
  const heuteSchon = altAm && altAm.toDateString() === new Date().toDateString();
  if (!heuteSchon) {
    const { logLead } = await import("../routes/fiaon-leads");
    await logLead(lage.leadId, { id: null, name: "System" }, "system", {
      note: `Persönlichen Link geöffnet (${KANAL_TEXT[kanal]}) → ${ziel === "antrag" ? "Antrag, vorausgefüllt" : ziel === "weiter" ? "Wiedereinstieg in den begonnenen Antrag" : "Kundenbereich"}`,
    }).catch(() => {});
  }
}

/**
 * Den Antrag an den Lead des Codes hängen — einmal, beim ersten Speichern.
 *
 * Nur wenn der Lead noch an keinem Antrag hängt: Eine bestehende Zuordnung
 * (z. B. vom Mitarbeiter oder aus einem früheren Antrag) wird nie
 * überschrieben. Die Strecke stoppt mit „antrag" — ab jetzt übernimmt die
 * Kette für begonnene Anträge (E-023) und der Mitarbeiter.
 */
export async function antragAnLeadHaengen(code: string, ref: string, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!codeGueltigeForm(code) || !ref) return false;
  await kurzlinkTabelle(lauf);
  const [lead] = (await lauf`
    SELECT l.id, l.converted_order_id FROM fiaon_kurzlinks k JOIN fiaon_leads l ON l.id = k.lead_id
     WHERE k.code = ${code}
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.ref = ${ref} AND a.merged_into IS NULL)`) as any[];
  if (!lead) return false;
  const leadId = Number(lead.id);
  let neu = false;
  if (!lead.converted_order_id) {
    const zeilen = (await lauf`
      UPDATE fiaon_leads SET
        status = 'konvertiert', converted_order_id = ${ref}, konvertiert_am = NOW(),
        letzter_kontakt_am = NOW(), updated_at = NOW()
      WHERE id = ${leadId} AND converted_order_id IS NULL
      RETURNING id`) as any[];
    neu = zeilen.length > 0;
  }
  // Die Strecke stoppt auch dann, wenn der Abgleich über Mail/Telefon (convertLeadsForContact)
  // den Lead eben schon an DIESEN Antrag gehängt hat — gemessen auf dem Prüfstand: sonst blieb
  // strecke_stopp leer, obwohl der Lead längst Antragsteller war.
  const [jetzt] = (await lauf`SELECT converted_order_id FROM fiaon_leads WHERE id = ${leadId}`) as any[];
  if (jetzt?.converted_order_id !== ref) return false;
  const { streckeStoppen } = await import("./fiaon-lead-strecke");
  const { gestoppt } = await streckeStoppen(leadId, "antrag", lauf).catch(() => ({ gestoppt: false }));
  if (neu || gestoppt) {
    const { logLead } = await import("../routes/fiaon-leads");
    await logLead(leadId, { id: null, name: "System" }, "system", {
      note: `Antrag ${ref} begonnen — über den persönlichen Link, Angaben vorausgefüllt. Raus aus der Nachfass-Strecke.`,
    }).catch(() => {});
  }
  return true;
}
