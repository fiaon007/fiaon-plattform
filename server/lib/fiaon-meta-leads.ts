// ═══════════════════════════════════════════════════════════════════════════
// DER LEAD-EINGANG DIREKT VON META (22.09.2026, E-210)
//
// ── WARUM ─────────────────────────────────────────────────────────────────
// Bis 21.09. liefen die Facebook-Leads über Make: Formular → Make → (Gmail,
// Google-Tabelle, 4 Minuten Pause, SuperChat) → erst DANN unsere Plattform.
// Seit SuperChat gelöscht ist, bricht jeder Lauf vor der Übergabe ab. Gemessen:
// 20.09. 52 Leads, 21.09. 8, 22.09. einer.
//
// ── ZWEI WEGE, EINE SPERRE ────────────────────────────────────────────────
//   1. Webhook: Meta meldet den Lead in Sekunden an /api/meta/webhook. Die
//      Meldung wird ERST gespeichert (fiaon_meta_ereignisse), dann bestätigt —
//      eine 200 ohne gespeicherte Meldung wäre ein verlorener Lead, denn Meta
//      schickt nach einer 200 nie wieder.
//   2. Nachhol-Lauf: alle 5 Minuten fragt die Plattform jedes Formular nach
//      neuen Leads. Fällt der Webhook aus (Abo weg, Server im Neustart), fängt
//      dieser Weg jeden Lead auf. Meta hält Leads 90 Tage abrufbar.
// Beide laufen gegen fiaon_meta_leads (Meta-Lead-ID → unser Lead): Ein Lead,
// der auf beiden Wegen kommt, wird einmal angelegt.
//
// ── DER WÄCHTER ───────────────────────────────────────────────────────────
// Stille ist das gefährlichste Signal: Als Make stand, merkte es zwei Tage
// niemand. Der Wächter prüft Token, Abo und Eingang und legt bei Störung eine
// Aufgabe im Chefbüro an (/admin/todo) — mit dem Satz, was zu tun ist.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  graph, graphAlle, metaKonfig, seitenToken, pruefToken, MetaFehler, PFLICHT_RECHTE, RECHT_ZWECK,
} from "./fiaon-meta";
import { absoluteUrl } from "../fiaon-base-url";

type Lauf = typeof sqlPool;

/** Die Felder, die wir von jedem Lead abrufen. */
export const LEAD_FELDER = "id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data,custom_disclaimer_responses,is_organic,platform";

let bereit = false;
export async function metaTabellen(lauf: Lauf = sqlPool): Promise<void> {
  if (bereit) return;
  await lauf`
    CREATE TABLE IF NOT EXISTS fiaon_meta_ereignisse (
      id BIGSERIAL PRIMARY KEY,
      empfangen_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      objekt TEXT NOT NULL,
      feld TEXT NOT NULL,
      schluessel TEXT,
      seite_id TEXT,
      nutzlast JSONB,
      status TEXT NOT NULL DEFAULT 'neu',
      versuche INTEGER NOT NULL DEFAULT 0,
      naechster_versuch_am TIMESTAMPTZ,
      fehler TEXT,
      verarbeitet_am TIMESTAMPTZ,
      lead_id INTEGER
    )`;
  await lauf`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_meta_ereignisse_schluessel ON fiaon_meta_ereignisse (objekt, feld, schluessel) WHERE schluessel IS NOT NULL`;
  await lauf`CREATE INDEX IF NOT EXISTS fiaon_meta_ereignisse_status ON fiaon_meta_ereignisse (status, empfangen_am)`;
  await lauf`
    CREATE TABLE IF NOT EXISTS fiaon_meta_leads (
      meta_lead_id TEXT PRIMARY KEY,
      lead_id INTEGER,
      formular_id TEXT,
      erstellt_am TIMESTAMPTZ,
      weg TEXT NOT NULL,
      gesehen_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await lauf`CREATE INDEX IF NOT EXISTS fiaon_meta_leads_gesehen ON fiaon_meta_leads (gesehen_am)`;
  await lauf`
    CREATE TABLE IF NOT EXISTS fiaon_meta_formulare (
      id TEXT PRIMARY KEY,
      seite_id TEXT,
      name TEXT,
      status TEXT,
      sprache TEXT,
      fragen JSONB,
      kaestchen JSONB,
      einwilligung_schluessel TEXT,
      einwilligung_von TEXT,
      erstellt_am TIMESTAMPTZ,
      geladen_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await lauf`
    CREATE TABLE IF NOT EXISTS fiaon_meta_alarme (
      id SERIAL PRIMARY KEY,
      art TEXT NOT NULL UNIQUE,
      text TEXT NOT NULL,
      erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      zuletzt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      zaehler INTEGER NOT NULL DEFAULT 1,
      erledigt_am TIMESTAMPTZ
    )`;
  bereit = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// EINSTELLUNGEN (fiaon_settings) — was die Einrichtung findet
// ═══════════════════════════════════════════════════════════════════════════
async function einstellung(key: string, lauf: Lauf = sqlPool): Promise<string | null> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${key} LIMIT 1`.catch(() => [])) as any[];
  const v = String(r?.value ?? "").trim();
  return v || null;
}
async function einstellungSetzen(key: string, wert: string, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}
export const META_SEITEN = "meta_seite_ids";
export const META_NACHHOL_BIS = "meta_nachhol_bis";
export const META_PRUEFLISTE = "meta_pruefliste";

export async function seitenIds(lauf: Lauf = sqlPool): Promise<string[]> {
  return String((await einstellung(META_SEITEN, lauf)) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════
// ABBILDUNG: EIN META-LEAD → UNSERE FELDER (rein, ohne Datenbank — Prüfstand)
// ═══════════════════════════════════════════════════════════════════════════
export interface MetaRohLead {
  id: string;
  created_time?: string;
  ad_id?: string; ad_name?: string; adset_id?: string; adset_name?: string; campaign_id?: string; campaign_name?: string;
  form_id?: string;
  field_data?: { name: string; values?: string[] }[];
  custom_disclaimer_responses?: { checkbox_key?: string; is_checked?: string | boolean | number }[];
  is_organic?: boolean;
  platform?: string;
}

export interface MetaLeadFelder {
  vorname: string | null; nachname: string | null; vollname: string | null;
  email: string | null; telefon: string | null; land: string | null;
  fragen: Record<string, string>;
  einwilligung: { schluessel: string; ja: boolean }[];
  whatsappErlaubt: boolean | null;
  plattform: "facebook" | "instagram" | "messenger" | "audience_network" | null;
}

const FELD = {
  vorname: ["first_name", "vorname"],
  nachname: ["last_name", "nachname", "familienname"],
  voll: ["full_name", "name", "vollständiger_name", "vollstaendiger_name", "vor-_und_nachname", "vor_und_nachname"],
  email: ["email", "e-mail", "e_mail", "email_adresse", "e-mail-adresse"],
  telefon: ["phone_number", "phone", "telefon", "telefonnummer", "handynummer", "mobilnummer", "mobile"],
  land: ["country", "land"],
};

function ja(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "ja";
}

/**
 * Einen Meta-Lead in unsere Felder abbilden.
 *
 * `einwilligungSchluessel` ist der Schlüssel des Kästchens im Formular, das
 * WhatsApp erlaubt (im Steuerpult zugeordnet oder aus dem Kästchentext
 * erkannt). Ohne ihn: Ein Kästchen, dessen Schlüssel „whatsapp" enthält, gilt;
 * sonst ist WhatsApp NICHT erlaubt (null = unbekannt, zählt wie nein).
 */
export function leadAusMeta(roh: MetaRohLead, einwilligungSchluessel?: string | null): MetaLeadFelder {
  const werte = new Map<string, string>();
  for (const f of roh.field_data ?? []) {
    const k = String(f?.name ?? "").trim().toLowerCase();
    const v = String(f?.values?.[0] ?? "").trim();
    if (k && v) werte.set(k, v);
  }
  const nimm = (liste: string[]) => { for (const k of liste) { const v = werte.get(k); if (v) return v; } return null; };
  const bekannt = new Set(Object.values(FELD).flat());
  const fragen: Record<string, string> = {};
  werte.forEach((v, k) => { if (!bekannt.has(k)) fragen[k] = v.slice(0, 500); });

  const einwilligung = (roh.custom_disclaimer_responses ?? [])
    .filter((c) => c && c.checkbox_key)
    .map((c) => ({ schluessel: String(c.checkbox_key), ja: ja(c.is_checked) }));
  let whatsappErlaubt: boolean | null = null;
  const passend = einwilligungSchluessel
    ? einwilligung.find((c) => c.schluessel === einwilligungSchluessel)
    : einwilligung.find((c) => /whats\s*app/i.test(c.schluessel));
  if (passend) whatsappErlaubt = passend.ja;
  else if (einwilligungSchluessel) whatsappErlaubt = false;

  const p = String(roh.platform ?? "").trim().toLowerCase();
  const plattform = p === "fb" || p === "facebook" ? "facebook"
    : p === "ig" || p === "instagram" ? "instagram"
    : p === "messenger" ? "messenger" : p === "an" || p === "audience_network" ? "audience_network" : null;

  return {
    vorname: nimm(FELD.vorname), nachname: nimm(FELD.nachname), vollname: nimm(FELD.voll),
    email: nimm(FELD.email), telefon: nimm(FELD.telefon), land: nimm(FELD.land),
    fragen, einwilligung, whatsappErlaubt, plattform,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EINSPIELEN — idempotent über die Meta-Lead-ID
// ═══════════════════════════════════════════════════════════════════════════
export type EinspielErgebnis = { status: "neu" | "dublette" | "ungueltig"; leadId: number | null; grund?: string };

/** Das Formular kennen wir? Sonst jetzt laden (Name, Kästchen) — für Anzeige und Einwilligung. */
async function formularSichern(formularId: string | undefined, seiteId: string | null, lauf: Lauf): Promise<{ name: string | null; einwilligungSchluessel: string | null }> {
  if (!formularId) return { name: null, einwilligungSchluessel: null };
  const [da] = (await lauf`SELECT name, einwilligung_schluessel FROM fiaon_meta_formulare WHERE id = ${formularId}`) as any[];
  if (da) return { name: da.name ?? null, einwilligungSchluessel: da.einwilligung_schluessel ?? null };
  try {
    const token = seiteId ? await seitenToken(seiteId) : undefined;
    const f = await formularLesen(formularId, token);
    await formularSpeichern(f, seiteId, lauf);
    const [neu] = (await lauf`SELECT name, einwilligung_schluessel FROM fiaon_meta_formulare WHERE id = ${formularId}`) as any[];
    return { name: neu?.name ?? null, einwilligungSchluessel: neu?.einwilligung_schluessel ?? null };
  } catch {
    return { name: null, einwilligungSchluessel: null };
  }
}

/** Einen abgerufenen Meta-Lead in die Plattform bringen. */
export async function metaLeadEinspielen(
  roh: MetaRohLead,
  weg: "meta_webhook" | "meta_nachhol" | "meta_rueckstand",
  seiteId: string | null = null,
  lauf: Lauf = sqlPool,
): Promise<EinspielErgebnis> {
  await metaTabellen(lauf);
  if (!roh?.id) return { status: "ungueltig", leadId: null, grund: "Lead ohne ID" };
  const [schon] = (await lauf`SELECT lead_id FROM fiaon_meta_leads WHERE meta_lead_id = ${String(roh.id)}`) as any[];
  if (schon) return { status: "dublette", leadId: schon.lead_id ?? null };

  const formular = await formularSichern(roh.form_id, seiteId, lauf);
  const f = leadAusMeta(roh, formular.einwilligungSchluessel);
  const { processIntake } = await import("../routes/fiaon-leads");
  const erg = await processIntake({
    vorname: f.vorname ?? f.vollname, nachname: f.nachname,
    email: f.email, telefon: f.telefon, land: f.land,
    quelle: "facebook_lead_ads",
    meta: {
      leadId: String(roh.id),
      formularId: roh.form_id ?? null, formular: formular.name,
      anzeigeId: roh.ad_id ?? null, anzeige: roh.ad_name ?? null,
      gruppeId: roh.adset_id ?? null, gruppe: roh.adset_name ?? null,
      kampagneId: roh.campaign_id ?? null, kampagne: roh.campaign_name ?? null,
      seiteId, plattform: f.plattform, erstelltAm: roh.created_time ?? null,
      einwilligung: f.einwilligung.length ? f.einwilligung : null,
      whatsappErlaubt: f.whatsappErlaubt, fragen: f.fragen, weg,
    },
  });
  if (!erg.ok) {
    // Ohne Mail und Telefon ist ein Lead nicht erreichbar — gemerkt wird er trotzdem,
    // damit der Nachhol-Lauf ihn nicht alle fünf Minuten erneut versucht.
    await lauf`
      INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, erstellt_am, weg)
      VALUES (${String(roh.id)}, NULL, ${roh.form_id ?? null}, ${roh.created_time ?? null}, ${weg})
      ON CONFLICT (meta_lead_id) DO NOTHING`;
    return { status: "ungueltig", leadId: null, grund: erg.error };
  }
  await lauf`
    INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, erstellt_am, weg)
    VALUES (${String(roh.id)}, ${erg.id}, ${roh.form_id ?? null}, ${roh.created_time ?? null}, ${weg})
    ON CONFLICT (meta_lead_id) DO NOTHING`;
  return { status: erg.deduped ? "dublette" : "neu", leadId: erg.id };
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK-MELDUNGEN: speichern, dann verarbeiten
// ═══════════════════════════════════════════════════════════════════════════
/** Eine signierte Meldung ablegen. Gibt zurück, wie viele Lead-Meldungen darin waren. */
export async function meldungSpeichern(nutzlast: any, lauf: Lauf = sqlPool): Promise<{ leads: number; andere: number }> {
  await metaTabellen(lauf);
  let leads = 0, andere = 0;
  const objekt = String(nutzlast?.object ?? "unbekannt");
  for (const eintrag of Array.isArray(nutzlast?.entry) ? nutzlast.entry : []) {
    for (const aenderung of Array.isArray(eintrag?.changes) ? eintrag.changes : []) {
      const feld = String(aenderung?.field ?? "unbekannt");
      const wert = aenderung?.value ?? {};
      if (objekt === "page" && feld === "leadgen" && wert?.leadgen_id) {
        await lauf`
          INSERT INTO fiaon_meta_ereignisse (objekt, feld, schluessel, seite_id, nutzlast)
          VALUES (${objekt}, ${feld}, ${String(wert.leadgen_id)}, ${String(wert.page_id ?? eintrag?.id ?? "") || null}, ${lauf.json(wert)})
          ON CONFLICT (objekt, feld, schluessel) WHERE schluessel IS NOT NULL DO NOTHING`;
        leads++;
      } else {
        // WhatsApp & Co. (Phase 2) — nur der Umschlag, keine Inhalte, bis die
        // Verarbeitung dafür steht.
        await lauf`
          INSERT INTO fiaon_meta_ereignisse (objekt, feld, schluessel, seite_id, nutzlast, status)
          VALUES (${objekt}, ${feld}, NULL, ${String(eintrag?.id ?? "") || null}, ${lauf.json({ nurUmschlag: true })}, 'ignoriert')`;
        andere++;
      }
    }
  }
  return { leads, andere };
}

let verarbeitungLaeuft = false;
/** Offene Lead-Meldungen abarbeiten — sofort nach dem Empfang und alle 2 Minuten als Netz. */
export async function meldungenVerarbeiten(hoechstens = 25, lauf: Lauf = sqlPool): Promise<{ verarbeitet: number; neu: number; fehler: number }> {
  if (verarbeitungLaeuft) return { verarbeitet: 0, neu: 0, fehler: 0 };
  verarbeitungLaeuft = true;
  try {
    await metaTabellen(lauf);
    if (!metaKonfig().bereit) return { verarbeitet: 0, neu: 0, fehler: 0 };
    const offen = (await lauf`
      SELECT id, schluessel, seite_id, versuche FROM fiaon_meta_ereignisse
       WHERE objekt = 'page' AND feld = 'leadgen' AND status IN ('neu', 'fehler')
         AND versuche < 8 AND (naechster_versuch_am IS NULL OR naechster_versuch_am <= NOW())
       ORDER BY empfangen_am ASC LIMIT ${hoechstens}`) as any[];
    let neu = 0, fehler = 0;
    for (const e of offen) {
      try {
        const token = e.seite_id ? await seitenToken(String(e.seite_id)) : undefined;
        const roh = await graph(String(e.schluessel), { params: { fields: LEAD_FELDER }, app: "leads", token });
        const erg = await metaLeadEinspielen(roh, "meta_webhook", e.seite_id ?? null, lauf);
        if (erg.status === "neu") neu++;
        await lauf`
          UPDATE fiaon_meta_ereignisse SET status = ${erg.status === "ungueltig" ? "ungueltig" : "verarbeitet"},
                 lead_id = ${erg.leadId}, verarbeitet_am = NOW(), fehler = ${erg.grund ?? null}, versuche = versuche + 1
           WHERE id = ${e.id}`;
      } catch (err) {
        fehler++;
        const text = err instanceof MetaFehler ? err.klartext : err instanceof Error ? err.message : String(err);
        // Rückzug 1, 2, 4, 8 … Minuten — der Nachhol-Lauf fängt den Lead ohnehin.
        const minuten = Math.min(240, 2 ** Number(e.versuche || 0));
        await lauf`
          UPDATE fiaon_meta_ereignisse SET status = 'fehler', fehler = ${text.slice(0, 500)}, versuche = versuche + 1,
                 naechster_versuch_am = NOW() + ${`${minuten} minutes`}::interval
           WHERE id = ${e.id}`;
      }
    }
    return { verarbeitet: offen.length, neu, fehler };
  } finally {
    verarbeitungLaeuft = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMULARE
// ═══════════════════════════════════════════════════════════════════════════
export interface MetaFormular {
  id: string; name?: string; status?: string; locale?: string; created_time?: string;
  questions?: { key?: string; label?: string; type?: string }[];
  legal_content?: { custom_disclaimer?: { checkboxes?: { key?: string; text?: string; is_required?: boolean }[] } };
}

async function formularLesen(id: string, token?: string): Promise<MetaFormular> {
  try {
    return await graph(id, { params: { fields: "id,name,status,locale,created_time,questions,legal_content{custom_disclaimer}" }, app: "leads", token });
  } catch (err) {
    // Manche Formulare liefern legal_content nicht — dann ohne Kästchen.
    if (err instanceof MetaFehler && err.code === 100) return graph(id, { params: { fields: "id,name,status,locale,created_time,questions" }, app: "leads", token });
    throw err;
  }
}

/** Welches Kästchen erlaubt WhatsApp? Erkannt am Text („WhatsApp"), sonst keins. */
export function einwilligungErkennen(f: MetaFormular): string | null {
  const k = f.legal_content?.custom_disclaimer?.checkboxes ?? [];
  const treffer = k.find((c) => /whats\s*app/i.test(String(c.text ?? "")) || /whats\s*app/i.test(String(c.key ?? "")));
  return treffer?.key ? String(treffer.key) : null;
}

async function formularSpeichern(f: MetaFormular, seiteId: string | null, lauf: Lauf): Promise<void> {
  const kaestchen = f.legal_content?.custom_disclaimer?.checkboxes ?? [];
  const erkannt = einwilligungErkennen(f);
  await lauf`
    INSERT INTO fiaon_meta_formulare (id, seite_id, name, status, sprache, fragen, kaestchen, einwilligung_schluessel, einwilligung_von, erstellt_am, geladen_am)
    VALUES (${f.id}, ${seiteId}, ${f.name ?? null}, ${f.status ?? null}, ${f.locale ?? null},
            ${lauf.json((f.questions ?? []) as any)}, ${lauf.json(kaestchen as any)},
            ${erkannt}, ${erkannt ? "erkannt" : null}, ${f.created_time ?? null}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      seite_id = COALESCE(EXCLUDED.seite_id, fiaon_meta_formulare.seite_id),
      name = EXCLUDED.name, status = EXCLUDED.status, sprache = EXCLUDED.sprache,
      fragen = EXCLUDED.fragen, kaestchen = EXCLUDED.kaestchen,
      -- Eine Zuordnung von Hand (Steuerpult) bleibt; eine erkannte wird nachgezogen.
      einwilligung_schluessel = CASE WHEN fiaon_meta_formulare.einwilligung_von = 'hand'
                                     THEN fiaon_meta_formulare.einwilligung_schluessel
                                     ELSE EXCLUDED.einwilligung_schluessel END,
      einwilligung_von = CASE WHEN fiaon_meta_formulare.einwilligung_von = 'hand' THEN 'hand' ELSE EXCLUDED.einwilligung_von END,
      geladen_am = NOW()`;
}

/** Alle Formulare aller Seiten neu laden. */
export async function formulareLaden(lauf: Lauf = sqlPool): Promise<{ seiten: number; formulare: number }> {
  await metaTabellen(lauf);
  const seiten = await seitenIds(lauf);
  let n = 0;
  for (const seite of seiten) {
    const token = await seitenToken(seite);
    const liste = await graphAlle(`${seite}/leadgen_forms`, { params: { fields: "id,name,status,locale,created_time", limit: 100 }, app: "leads", token, hoechstens: 500 });
    for (const kurz of liste) {
      const f = await formularLesen(String(kurz.id), token).catch(() => kurz as MetaFormular);
      await formularSpeichern(f, seite, lauf);
      n++;
    }
  }
  return { seiten: seiten.length, formulare: n };
}

/** Die Einwilligung eines Formulars von Hand zuordnen (Steuerpult). Leer = kein Kästchen erlaubt WhatsApp. */
export async function einwilligungZuordnen(formularId: string, schluessel: string | null, lauf: Lauf = sqlPool): Promise<void> {
  await metaTabellen(lauf);
  await lauf`UPDATE fiaon_meta_formulare SET einwilligung_schluessel = ${schluessel || null}, einwilligung_von = 'hand' WHERE id = ${formularId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// NACHHOL-LAUF UND RÜCKSTAND
// ═══════════════════════════════════════════════════════════════════════════
let nachholLaeuft = false;

/**
 * Jedes Formular nach Leads seit `seit` fragen und fehlende einspielen.
 * Ohne `seit`: ab dem gemerkten Stand (minus 10 Minuten Überlappung), beim
 * allerersten Lauf die letzten 2 Tage.
 */
export async function nachholLauf(opts: { seit?: Date; weg?: "meta_nachhol" | "meta_rueckstand"; hoechstens?: number } = {}, lauf: Lauf = sqlPool): Promise<{
  formulare: number; gefunden: number; neu: number; schonDa: number; ungueltig: number; fehler: string[]; seit: string;
}> {
  const leer = { formulare: 0, gefunden: 0, neu: 0, schonDa: 0, ungueltig: 0, fehler: [] as string[], seit: "" };
  if (nachholLaeuft) return { ...leer, fehler: ["Ein Nachhol-Lauf läuft bereits."] };
  if (!metaKonfig().bereit) return { ...leer, fehler: ["Meta-Zugang fehlt noch."] };
  nachholLaeuft = true;
  try {
    await metaTabellen(lauf);
    const gemerkt = await einstellung(META_NACHHOL_BIS, lauf);
    const neunzig = new Date(Date.now() - 89 * 86_400_000);
    let seit = opts.seit ?? (gemerkt ? new Date(new Date(gemerkt).getTime() - 10 * 60_000) : new Date(Date.now() - 2 * 86_400_000));
    if (seit < neunzig) seit = neunzig;
    const ab = Math.floor(seit.getTime() / 1000);
    const formulare = (await lauf`
      SELECT id, seite_id FROM fiaon_meta_formulare
       WHERE status IS NULL OR UPPER(status) IN ('ACTIVE', 'ARCHIVED') OR ${!!opts.seit}
       ORDER BY geladen_am DESC`) as any[];
    const erg = { ...leer, formulare: formulare.length, seit: seit.toISOString() };
    let juengster = gemerkt ? new Date(gemerkt).getTime() : 0;
    const startLauf = Date.now();
    for (const f of formulare) {
      try {
        const token = f.seite_id ? await seitenToken(String(f.seite_id)) : undefined;
        const leads = await graphAlle(`${f.id}/leads`, {
          params: { fields: LEAD_FELDER, limit: 100, filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: ab }]) },
          app: "leads", token, hoechstens: opts.hoechstens ?? 2000,
        });
        erg.gefunden += leads.length;
        for (const roh of leads) {
          const e = await metaLeadEinspielen(roh, opts.weg ?? "meta_nachhol", f.seite_id ?? null, lauf);
          if (e.status === "neu") erg.neu++; else if (e.status === "dublette") erg.schonDa++; else erg.ungueltig++;
          const t = Date.parse(String(roh.created_time ?? ""));
          if (!Number.isNaN(t) && t > juengster) juengster = t;
        }
      } catch (err) {
        erg.fehler.push(`Formular ${f.id}: ${err instanceof MetaFehler ? err.klartext : err instanceof Error ? err.message : String(err)}`);
      }
    }
    // Den Stand nur weiterschieben, wenn kein Formular scheiterte — sonst fehlt
    // dessen Lücke beim nächsten Lauf.
    if (!erg.fehler.length) await einstellungSetzen(META_NACHHOL_BIS, new Date(Math.max(juengster, startLauf - 60_000)).toISOString(), lauf);
    return erg;
  } finally {
    nachholLaeuft = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EINRICHTUNG — ein Knopf im Steuerpult, eine Prüfliste als Antwort
// ═══════════════════════════════════════════════════════════════════════════
export interface Pruefpunkt { key: string; titel: string; ok: boolean | null; text: string }
export interface Pruefliste { am: string; punkte: Pruefpunkt[]; bereit: boolean }

function webhookAdresse(): string {
  // Die Hauptdomain — www leitet mit 301 um, und Meta folgt keiner Umleitung.
  return "https://fiaon.com/api/meta/webhook";
}

/**
 * Alles prüfen und — wenn `einrichten` — verbinden: Webhook bei Meta eintragen,
 * Seite abonnieren, Formulare laden. Gibt die Prüfliste zurück und merkt sie.
 */
export async function verbindungPruefen(opts: { einrichten: boolean }, lauf: Lauf = sqlPool): Promise<Pruefliste> {
  await metaTabellen(lauf);
  const punkte: Pruefpunkt[] = [];
  const punkt = (key: string, titel: string, ok: boolean | null, text: string) => punkte.push({ key, titel, ok, text });
  const k = metaKonfig();
  punkt("werte", "Zugangswerte in Render", k.bereit, k.bereit
    ? `App ${k.appId}${k.zweiApps ? " (plus eigene Leads-App)" : ""} — Geheimwert und Token sind eingetragen.`
    : `Es fehlt: ${k.fehlt.join(", ")}. Eintragen unter dashboard.render.com → fiaon-plattform → Environment.`);
  if (!k.bereit) return merken({ am: new Date().toISOString(), punkte, bereit: false }, lauf);

  // 1) Token: gültig, läuft nie ab, alle Rechte, welche Seiten/WhatsApp-Konten?
  let seiten: string[] = [];
  let wabas: string[] = [];
  try {
    const d = await graph("debug_token", { params: { input_token: process.env.META_SYSTEM_TOKEN }, appToken: true });
    const info = d?.data ?? {};
    const rechte: string[] = Array.isArray(info.scopes) ? info.scopes : [];
    const fehlen = PFLICHT_RECHTE.filter((r) => !rechte.includes(r));
    const laeuftAb = Number(info.expires_at || 0) > 0;
    punkt("token", "Token gültig", !!info.is_valid && !laeuftAb, !info.is_valid
      ? "Der Token ist ungültig — neu erzeugen (Systemnutzer → Token generieren, Ablauf: nie)."
      : laeuftAb ? `Der Token läuft am ${new Date(Number(info.expires_at) * 1000).toLocaleDateString("de-DE")} ab — bitte einen mit Ablauf „nie" erzeugen.`
        : `Gültig, läuft nie ab${info.type ? ` (${info.type})` : ""}.`);
    punkt("rechte", "Alle Rechte erteilt", fehlen.length === 0, fehlen.length
      ? `Es fehlen: ${fehlen.map((r) => `${r} (${RECHT_ZWECK[r] ?? r})`).join(", ")}. Token neu erzeugen und diese Rechte anhaken.`
      : `Alle ${PFLICHT_RECHTE.length} Rechte vorhanden.`);
    for (const g of Array.isArray(info.granular_scopes) ? info.granular_scopes : []) {
      if (g?.scope === "pages_show_list" || g?.scope === "leads_retrieval") seiten.push(...(g.target_ids ?? []).map(String));
      if (g?.scope === "whatsapp_business_management") wabas.push(...(g.target_ids ?? []).map(String));
    }
  } catch (err) {
    punkt("token", "Token gültig", false, err instanceof MetaFehler ? err.klartext : String(err));
  }

  // 2) Seiten: aus den Rechten, sonst über /me/accounts.
  try {
    if (!seiten.length) {
      const liste = await graphAlle("me/accounts", { params: { fields: "id,name", limit: 50 }, app: "leads", hoechstens: 50 });
      seiten = liste.map((s: any) => String(s.id));
    }
    seiten = Array.from(new Set(seiten));
    const namen: string[] = [];
    for (const s of seiten) {
      const info = await graph(s, { params: { fields: "id,name" }, app: "leads" }).catch(() => null);
      namen.push(info?.name ? `${info.name} (${s})` : s);
    }
    punkt("seite", "Facebook-Seite gefunden", seiten.length > 0, seiten.length
      ? namen.join(", ")
      : "Der Systemnutzer sieht keine Seite — im Business-Manager die Seite dem Systemnutzer mit voller Kontrolle zuweisen.");
    if (seiten.length) await einstellungSetzen(META_SEITEN, seiten.join(","), lauf);
  } catch (err) {
    punkt("seite", "Facebook-Seite gefunden", false, err instanceof MetaFehler ? err.klartext : String(err));
  }

  // 3) Webhook bei Meta (App-Abo „page / leadgen").
  const appId = metaKonfig().appId!;
  const leadsAppId = process.env.META_LEADS_APP_ID?.trim() || appId;
  const leadsApp = leadsAppId !== appId ? "leads" : "haupt";
  try {
    if (opts.einrichten) {
      await graph(`${leadsAppId}/subscriptions`, {
        methode: "POST", appToken: true, app: leadsApp,
        params: { object: "page", callback_url: webhookAdresse(), fields: "leadgen", verify_token: pruefToken(leadsApp) },
      });
    }
    const abos = await graph(`${leadsAppId}/subscriptions`, { appToken: true, app: leadsApp });
    const page = (abos?.data ?? []).find((a: any) => a.object === "page");
    const aktiv = !!page?.active && (page?.fields ?? []).some((f: any) => (f?.name ?? f) === "leadgen") && String(page?.callback_url ?? "") === webhookAdresse();
    punkt("webhook", "Webhook bei Meta eingetragen", aktiv, aktiv
      ? `Meta meldet jeden Lead an ${webhookAdresse()}.`
      : `Noch nicht eingetragen${page?.callback_url ? ` (eingetragen ist ${page.callback_url})` : ""} — „Verbindung einrichten" drücken.`);
  } catch (err) {
    punkt("webhook", "Webhook bei Meta eingetragen", false, err instanceof MetaFehler ? err.klartext : String(err));
  }

  // 4) Jede Seite hat unsere App für „leadgen" abonniert.
  const seitenAbo: string[] = [];
  for (const s of seiten) {
    try {
      const token = await seitenToken(s);
      if (opts.einrichten) await graph(`${s}/subscribed_apps`, { methode: "POST", token, app: "leads", params: { subscribed_fields: "leadgen" } });
      const apps = await graph(`${s}/subscribed_apps`, { token, app: "leads" });
      const unsere = (apps?.data ?? []).find((a: any) => String(a.id) === leadsAppId);
      if (unsere && (unsere.subscribed_fields ?? []).includes("leadgen")) seitenAbo.push(s);
    } catch (err) {
      punkt(`abo-${s}`, `Seite ${s} abonniert`, false, err instanceof MetaFehler ? err.klartext : String(err));
    }
  }
  if (seiten.length) {
    punkt("abo", "Seite meldet Leads an unsere App", seitenAbo.length === seiten.length, seitenAbo.length === seiten.length
      ? "Abonniert (Feld leadgen)."
      : `Nur ${seitenAbo.length} von ${seiten.length} Seiten abonniert — „Verbindung einrichten" drücken; hilft das nicht: Leadzugriff der Seite prüfen (Integrationen → Leadzugriff).`);
  }

  // 5) Formulare laden.
  try {
    const f = await formulareLaden(lauf);
    const [z] = (await lauf`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE einwilligung_schluessel IS NOT NULL)::int AS mit FROM fiaon_meta_formulare`) as any[];
    punkt("formulare", "Lead-Formulare gefunden", f.formulare > 0, f.formulare
      ? `${z?.n ?? f.formulare} Formulare, davon ${z?.mit ?? 0} mit WhatsApp-Einwilligung.${(z?.mit ?? 0) === 0 ? " Ohne Kästchen schickt die Plattform keine WhatsApp (nur E-Mail)." : ""}`
      : "Keine Formulare gefunden — hat der Token das Recht pages_manage_ads und Leadzugriff?");
  } catch (err) {
    punkt("formulare", "Lead-Formulare gefunden", false, err instanceof MetaFehler ? err.klartext : String(err));
  }

  // 6) WhatsApp-Konto (für Phase 2 — hier nur sehen, nichts einrichten).
  try {
    wabas = Array.from(new Set(wabas));
    const nummern: string[] = [];
    for (const w of wabas) {
      const liste = await graph(`${w}/phone_numbers`, { params: { fields: "id,display_phone_number,verified_name,name_status,status,quality_rating" } }).catch(() => null);
      for (const n of liste?.data ?? []) nummern.push(`${n.display_phone_number ?? n.id} — ${n.verified_name ?? "ohne Namen"} (${n.name_status ?? n.status ?? "?"})`);
    }
    // Ohne Nummer ist das kein Fehler, sondern der nächste Schritt (Phase 2) — also neutral.
    punkt("whatsapp", "WhatsApp-Konto und Nummer", wabas.length && nummern.length ? true : null, wabas.length
      ? (nummern.length ? nummern.join(" · ") : "WhatsApp-Konto gefunden, aber noch keine Nummer.")
      : "Noch kein WhatsApp-Konto sichtbar (folgt mit Phase 2).");
  } catch (err) {
    punkt("whatsapp", "WhatsApp-Konto und Nummer", null, err instanceof MetaFehler ? err.klartext : String(err));
  }

  // 7) Datensatz (Pixel) für die Messung — finden oder anlegen.
  try {
    const { datensatzId, DATENSATZ_SCHLUESSEL } = await import("./fiaon-meta-capi");
    let id = await datensatzId(lauf);
    let name = "";
    const firmen = await graph("me/businesses", { params: { fields: "id,name", limit: 10 } }).catch(() => null);
    const firma = firmen?.data?.[0];
    if (!id && firma?.id) {
      const vorhanden = await graphAlle(`${firma.id}/adspixels`, { params: { fields: "id,name", limit: 25 }, hoechstens: 25 }).catch(() => []);
      const passend = vorhanden.find((p: any) => /fiaon/i.test(String(p.name ?? ""))) ?? vorhanden[0];
      if (passend?.id) { id = String(passend.id); name = String(passend.name ?? ""); }
      else if (opts.einrichten) {
        const neuerSatz = await graph(`${firma.id}/adspixels`, { methode: "POST", params: { name: "FIAON" } }).catch(() => null);
        if (neuerSatz?.id) { id = String(neuerSatz.id); name = "FIAON"; }
      }
      if (id) await einstellungSetzen(DATENSATZ_SCHLUESSEL, id, lauf);
    }
    punkt("datensatz", "Datensatz für die Messung (Pixel)", !!id, id
      ? `${name || "Datensatz"} ${id} — Pixel und Conversions API melden Antrag, Abschluss und Zahlung.`
      : opts.einrichten ? "Konnte keinen Datensatz anlegen — im Events-Manager einen erstellen und die Kennung im Steuerpult eintragen."
        : "Noch keiner — „Verbindung einrichten“ legt einen an.");
  } catch (err) {
    punkt("datensatz", "Datensatz für die Messung (Pixel)", null, err instanceof MetaFehler ? err.klartext : String(err));
  }

  const bereitJetzt = punkte.filter((p) => ["werte", "token", "seite", "webhook", "abo", "formulare"].includes(p.key)).every((p) => p.ok === true);
  return merken({ am: new Date().toISOString(), punkte, bereit: bereitJetzt }, lauf);
}

async function merken(p: Pruefliste, lauf: Lauf): Promise<Pruefliste> {
  await einstellungSetzen(META_PRUEFLISTE, JSON.stringify(p), lauf).catch(() => {});
  return p;
}

export async function letztePruefliste(lauf: Lauf = sqlPool): Promise<Pruefliste | null> {
  const roh = await einstellung(META_PRUEFLISTE, lauf);
  if (!roh) return null;
  try { return JSON.parse(roh) as Pruefliste; } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// DER WÄCHTER
// ═══════════════════════════════════════════════════════════════════════════
async function alarm(art: string, an: boolean, text: string, lauf: Lauf): Promise<void> {
  if (an) {
    const [z] = (await lauf`
      INSERT INTO fiaon_meta_alarme (art, text) VALUES (${art}, ${text})
      ON CONFLICT (art) DO UPDATE SET text = EXCLUDED.text, zuletzt_am = NOW(),
        zaehler = CASE WHEN fiaon_meta_alarme.erledigt_am IS NULL THEN fiaon_meta_alarme.zaehler + 1 ELSE 1 END,
        erstellt_am = CASE WHEN fiaon_meta_alarme.erledigt_am IS NULL THEN fiaon_meta_alarme.erstellt_am ELSE NOW() END,
        erledigt_am = NULL
      RETURNING zaehler`) as any[];
    if (Number(z?.zaehler) === 1) {
      const { todoAnlegen } = await import("../routes/fiaon-betreiber-todo");
      await todoAnlegen(`lead-motor:${art}:${new Date().toISOString().slice(0, 10)}`, {
        titel: `Lead-Motor: ${text.split(" — ")[0]}`, text, bereich: "vertrieb", prioritaet: 1,
        link: "/chef/s/lead-motor", quelle: "lead-motor",
      }).catch((e) => console.error("[LEAD-MOTOR] Aufgabe:", e));
    }
  } else {
    await lauf`UPDATE fiaon_meta_alarme SET erledigt_am = NOW() WHERE art = ${art} AND erledigt_am IS NULL`;
  }
}

/** Berliner Stunde — über formatToParts (Zeit-Falle Berlin-Stunde). */
function berlinStunde(d = new Date()): number {
  const h = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).formatToParts(d).find((p) => p.type === "hour")?.value;
  const n = parseInt(String(h ?? ""), 10);
  return Number.isFinite(n) ? n % 24 : d.getUTCHours();
}

export async function waechterLauf(lauf: Lauf = sqlPool): Promise<{ alarme: string[] }> {
  await metaTabellen(lauf);
  const k = metaKonfig();
  const aktiv: string[] = [];
  if (!k.bereit) return { alarme: aktiv };
  const stunde = berlinStunde();

  // Stille: tagsüber 3 Stunden ohne einen einzigen Facebook-Lead, obwohl zur
  // selben Zeit gestern mindestens drei kamen.
  const [st] = (await lauf`
    SELECT
      (SELECT MAX(erstellt_am) FROM fiaon_leads WHERE quelle = 'facebook_lead_ads') AS letzter,
      (SELECT COUNT(*)::int FROM fiaon_leads WHERE quelle = 'facebook_lead_ads'
         AND erstellt_am BETWEEN NOW() - INTERVAL '27 hours' AND NOW() - INTERVAL '24 hours') AS gestern
  `) as any[];
  const still = stunde >= 9 && stunde < 22 && Number(st?.gestern || 0) >= 3
    && (!st?.letzter || Date.now() - new Date(st.letzter).getTime() > 3 * 3_600_000);
  await alarm("stille", still, "Seit drei Stunden kein Lead — Anzeigen im Werbeanzeigenmanager prüfen (pausiert? Budget? Formular?) und im Lead-Motor „Verbindung prüfen“.", lauf);
  if (still) aktiv.push("stille");

  // Webhook schweigt, Nachhol-Lauf findet: Das Abo ist weg oder gestört.
  const [w] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE weg = 'meta_webhook')::int AS webhook,
           COUNT(*) FILTER (WHERE weg = 'meta_nachhol')::int AS nachhol
      FROM fiaon_meta_leads WHERE gesehen_am > NOW() - INTERVAL '3 hours'`) as any[];
  const webhookStumm = Number(w?.nachhol || 0) >= 2 && Number(w?.webhook || 0) === 0;
  await alarm("webhook", webhookStumm, "Der Webhook meldet keine Leads — der Nachhol-Lauf fängt sie auf (bis zu 5 Minuten später). Im Lead-Motor „Verbindung einrichten“ drücken.", lauf);
  if (webhookStumm) aktiv.push("webhook");

  // Meldungen, die trotz Wiederholung nicht abrufbar sind.
  const [f] = (await lauf`
    SELECT COUNT(*)::int AS n, MAX(fehler) AS text FROM fiaon_meta_ereignisse
     WHERE status = 'fehler' AND versuche >= 3 AND empfangen_am > NOW() - INTERVAL '6 hours'`) as any[];
  const abrufFehler = Number(f?.n || 0) > 0;
  await alarm("abruf", abrufFehler, `${f?.n ?? 0} Lead-Meldung(en) lassen sich nicht abrufen — ${String(f?.text ?? "").slice(0, 200)}`, lauf);
  if (abrufFehler) aktiv.push("abruf");

  // Token und Abo — höchstens alle 6 Stunden gegen Meta prüfen.
  const letzte = await letztePruefliste(lauf);
  if (!letzte || Date.now() - new Date(letzte.am).getTime() > 6 * 3_600_000) {
    const p = await verbindungPruefen({ einrichten: false }, lauf).catch(() => null);
    const kaputt = p?.punkte.filter((x) => ["token", "rechte", "webhook", "abo"].includes(x.key) && x.ok === false) ?? [];
    await alarm("verbindung", kaputt.length > 0, `Verbindung zu Meta gestört — ${kaputt.map((x) => `${x.titel}: ${x.text}`).join(" · ")}`, lauf);
    if (kaputt.length) aktiv.push("verbindung");
  }
  return { alarme: aktiv };
}

/** Für Hinweise im Steuerpult: die öffentliche Adresse des Webhooks und der Plattform. */
export function adressen(): { webhook: string; plattform: string } {
  return { webhook: webhookAdresse(), plattform: absoluteUrl("/") };
}
