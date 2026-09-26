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
  /** Immer true, außer der Mensch hat ein vorhandenes Kontakt-Kästchen NICHT angehakt. */
  whatsappErlaubt: boolean;
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

  // ── WHATSAPP IST IMMER ERLAUBT (22.09.2026, Entscheidung Justin) ────────
  // Die Erlaubnis steht im HINWEISTEXT des Formulars („Mit dem Absenden
  // erlauben Sie der FIAON LTD, Sie … per WhatsApp, SMS, E-Mail und Telefon
  // zu kontaktieren"), nicht in einem Kästchen. Wer absendet, hat sie gelesen.
  // Justin: „jeder Lead der über Facebook kommt erlaubt die Kontaktaufnahme
  // über WhatsApp."
  //
  // Die EINZIGE Ausnahme: Ein Formular hat doch ein Kontakt-Kästchen und der
  // Mensch hat es NICHT angehakt — das ist ein ausdrückliches Nein und wiegt
  // schwerer als der Hinweistext. Angehakte Kästchen werden weiter
  // mitgeschrieben, aber sie entscheiden nichts mehr.
  const einwilligung = (roh.custom_disclaimer_responses ?? [])
    .filter((c) => c && c.checkbox_key)
    .map((c) => ({ schluessel: String(c.checkbox_key), ja: ja(c.is_checked) }));
  const kontaktKaestchen = einwilligungSchluessel
    ? einwilligung.find((c) => c.schluessel === einwilligungSchluessel)
    : einwilligung.find((c) => /whats\s*app|kontakt/i.test(c.schluessel));
  const whatsappErlaubt: boolean = kontaktKaestchen ? kontaktKaestchen.ja : true;

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
export type EinspielErgebnis = { status: "neu" | "dublette" | "ungueltig" | "test"; leadId: number | null; grund?: string };

// ═══════════════════════════════════════════════════════════════════════════
// TEST-LEADS VON META (26.09.2026, E-244)
//
// Das Lead-Ads-Testing-Tool (developers.facebook.com/tools/lead-ads-testing)
// ist der einzige Weg, den Webhook ohne Werbegeld zu beweisen. Sein Lead läuft
// aber durch denselben Weg wie ein echter — ohne diese Sperre würde er zum
// Kunden: Datensatz, Person, Zuteilung an einen Betreuer, ECHTE
// Begrüßungsmail an Metas Test-Adresse, ein Stufe-C-Lead in allen Zahlen.
//
// Meta füllt jedes Feld mit „<test lead: dummy data for …>“, die Mail mit
// test@fb.com (neuer: test@meta.com). Ein solcher Lead wird nur gemerkt
// (fiaon_meta_leads, weg meta_test, ohne Lead) — die Meldung zählt als
// Beweis, dass der Webhook liefert, sonst passiert nichts.
// ═══════════════════════════════════════════════════════════════════════════
const TEST_MAILS = new Set(["test@fb.com", "test@meta.com", "test@facebook.com"]);
export function istTestLead(roh: MetaRohLead | null | undefined): boolean {
  for (const f of roh?.field_data ?? []) {
    for (const v of f?.values ?? []) {
      const s = String(v ?? "").trim().toLowerCase();
      if (!s) continue;
      if (s.startsWith("<test lead") || s.includes("dummy data for")) return true;
      if (TEST_MAILS.has(s)) return true;
    }
  }
  return false;
}

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

  if (istTestLead(roh)) {
    // Kein processIntake: kein Lead, keine Person, keine Zuteilung, keine Mail.
    await lauf`
      INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, erstellt_am, weg)
      VALUES (${String(roh.id)}, NULL, ${roh.form_id ?? null}, ${roh.created_time ?? null}, 'meta_test')
      ON CONFLICT (meta_lead_id) DO NOTHING`;
    return { status: "test", leadId: null, grund: "Test-Lead von Meta — nicht angelegt" };
  }

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
/** Die Beispielmeldung aus dem App-Dashboard: Kennungen nur aus Vieren (444444444444). */
export function istBeispielMeldung(wert: any): boolean {
  return /^4{6,}$/.test(String(wert?.leadgen_id ?? ""));
}

/** Eine signierte Meldung ablegen. Gibt zurück, wie viele Lead-Meldungen darin waren. */
export async function meldungSpeichern(nutzlast: any, lauf: Lauf = sqlPool): Promise<{ leads: number; andere: number }> {
  await metaTabellen(lauf);
  let leads = 0, andere = 0;
  const objekt = String(nutzlast?.object ?? "unbekannt");
  for (const eintrag of Array.isArray(nutzlast?.entry) ? nutzlast.entry : []) {
    for (const aenderung of Array.isArray(eintrag?.changes) ? eintrag.changes : []) {
      const feld = String(aenderung?.field ?? "unbekannt");
      const wert = aenderung?.value ?? {};
      if (objekt === "page" && feld === "leadgen" && wert?.leadgen_id && istBeispielMeldung(wert)) {
        // E-244: Der Knopf „Test“ im App-Dashboard (Webhooks → Page → leadgen)
        // schickt eine Beispielmeldung mit erfundener Kennung 444… — nicht
        // abrufbar, und sie beweist das Seiten-Abo NICHT. Gemerkt, nie verarbeitet.
        await lauf`
          INSERT INTO fiaon_meta_ereignisse (objekt, feld, schluessel, seite_id, nutzlast, status, verarbeitet_am)
          VALUES (${objekt}, ${feld}, ${String(wert.leadgen_id)}, ${String(wert.page_id ?? eintrag?.id ?? "") || null}, ${lauf.json(wert)}, 'beispiel', NOW())
          ON CONFLICT (objekt, feld, schluessel) WHERE schluessel IS NOT NULL DO NOTHING`;
        andere++;
      } else if (objekt === "page" && feld === "leadgen" && wert?.leadgen_id) {
        await lauf`
          INSERT INTO fiaon_meta_ereignisse (objekt, feld, schluessel, seite_id, nutzlast)
          VALUES (${objekt}, ${feld}, ${String(wert.leadgen_id)}, ${String(wert.page_id ?? eintrag?.id ?? "") || null}, ${lauf.json(wert)})
          ON CONFLICT (objekt, feld, schluessel) WHERE schluessel IS NOT NULL DO NOTHING`;
        leads++;
      } else if (objekt === "whatsapp_business_account" && feld === "messages") {
        // 22.09.2026 (E-210): WhatsApp ist da. Nachrichten und Zustellstände
        // gehen direkt in fiaon_whatsapp — die Kennung von WhatsApp macht das
        // idempotent, doppelte Meldungen legen nichts zweimal an.
        const { waEingang } = await import("./fiaon-whatsapp");
        const e = await waEingang(wert, lauf).catch((err) => { console.error("[WHATSAPP] Eingang:", err); return { neu: 0, status: 0 }; });
        await lauf`
          INSERT INTO fiaon_meta_ereignisse (objekt, feld, schluessel, seite_id, nutzlast, status, verarbeitet_am)
          VALUES (${objekt}, ${feld}, NULL, ${String(eintrag?.id ?? "") || null},
                  ${lauf.json({ nachrichten: e.neu, zustellstaende: e.status })}, 'verarbeitet', NOW())`;
        andere++;
      } else {
        // Alles Übrige (Vorlagen-Freigaben, Kontoänderungen): nur der Umschlag.
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
          UPDATE fiaon_meta_ereignisse SET status = ${erg.status === "ungueltig" || erg.status === "test" ? erg.status : "verarbeitet"},
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
  formulare: number; gefunden: number; neu: number; schonDa: number; ungueltig: number; test: number; fehler: string[]; seit: string;
}> {
  const leer = { formulare: 0, gefunden: 0, neu: 0, schonDa: 0, ungueltig: 0, test: 0, fehler: [] as string[], seit: "" };
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
          if (e.status === "neu") erg.neu++; else if (e.status === "dublette") erg.schonDa++; else if (e.status === "test") erg.test++; else erg.ungueltig++;
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
      // WhatsApp ist ein EIGENES Abo (Objekt whatsapp_business_account) — im
      // Assistenten von Meta ist das Feld leer, obwohl der Lead-Webhook längst
      // steht. Wir tragen es hier mit derselben Adresse und demselben
      // Prüf-Token ein, damit Justin das Formular gar nicht ausfüllen muss.
      await graph(`${leadsAppId}/subscriptions`, {
        methode: "POST", appToken: true, app: leadsApp,
        params: {
          object: "whatsapp_business_account", callback_url: webhookAdresse(),
          fields: "messages,message_template_status_update,account_update,phone_number_quality_update",
          verify_token: pruefToken(leadsApp),
        },
      }).catch((e) => console.warn("[META] WhatsApp-Abo noch nicht möglich:", e instanceof MetaFehler ? e.klartext : String(e)));
    }
    const abos = await graph(`${leadsAppId}/subscriptions`, { appToken: true, app: leadsApp });
    const page = (abos?.data ?? []).find((a: any) => a.object === "page");
    const wa = (abos?.data ?? []).find((a: any) => a.object === "whatsapp_business_account");
    const waFelder = (wa?.fields ?? []).map((f: any) => f?.name ?? f);
    punkt("whatsapp_webhook", "WhatsApp meldet Nachrichten an uns", wa?.active && waFelder.includes("messages") ? true : null,
      wa?.active && waFelder.includes("messages")
        ? `Eingetragen für ${waFelder.join(", ")} — der Assistent von Meta muss dafür nichts ausgefüllt bekommen.`
        : "Noch nicht eingetragen — „Verbindung einrichten“ drücken (das Formular im Meta-Assistenten kann leer bleiben).");
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
      ? `${z?.n ?? f.formulare} Formular(e). Jeder Lead darf per WhatsApp angeschrieben werden — die Erlaubnis steht im Hinweistext des Formulars.`
      : "Keine Formulare gefunden — hat der Token das Recht pages_manage_ads und Leadzugriff?");
  } catch (err) {
    punkt("formulare", "Lead-Formulare gefunden", false, err instanceof MetaFehler ? err.klartext : String(err));
  }

  // 6) WhatsApp: Nummer und Vorlagen — der echte Zustand, nicht mehr „folgt".
  //
  // 22.09.2026: Die Nummer steht. Der Punkt liest ab jetzt direkt am Konto aus
  // der Umgebung (WHATSAPP_WABA_ID / WHATSAPP_PHONE_ID), weil die Rechteliste
  // eines Systemnutzers das WhatsApp-Konto nicht immer mitführt.
  try {
    const { waKonfig, vorlagenStand, vorlagenEinreichen } = await import("./fiaon-whatsapp");
    const wk = waKonfig();
    // „Verbindung einrichten" reicht fehlende Vorlagen gleich bei Meta ein —
    // ihre Prüfung dauert, also je früher, desto besser.
    if (wk.bereit && opts.einrichten) {
      const e = await vorlagenEinreichen().catch(() => null);
      if (e?.eingereicht.length) console.log(`[WHATSAPP] ${e.eingereicht.length} Vorlage(n) eingereicht: ${e.eingereicht.join(", ")}`);
      if (e?.fehler.length) console.warn("[WHATSAPP] Vorlagen abgelehnt:", e.fehler.map((f) => `${f.name}: ${f.grund}`).join(" · "));
    }
    if (!wk.bereit) {
      punkt("whatsapp", "WhatsApp-Nummer", null, `Noch nicht eingetragen (${wk.fehlt.join(", ")} in Render).`);
    } else {
      const nr = await graph(wk.nummerId!, { params: { fields: "display_phone_number,verified_name,status,quality_rating,throughput" } });
      const verbunden = String(nr?.status ?? "") === "CONNECTED";
      const guete = String(nr?.quality_rating ?? "UNKNOWN");
      const gueteText = guete === "GREEN" ? "Qualität grün" : guete === "YELLOW" ? "Qualität gelb — Takt drosseln"
        : guete === "RED" ? "Qualität ROT — Meta drosselt bereits" : "Qualität noch ohne Bewertung";
      punkt("whatsapp", "WhatsApp-Nummer", verbunden,
        `${nr?.display_phone_number ?? wk.nummer ?? "?"} · ${nr?.verified_name ?? "FIAON"} — ${verbunden ? "verbunden" : String(nr?.status ?? "nicht verbunden")}, ${gueteText}.`);

      const v = await vorlagenStand().catch(() => []);
      const frei = v.filter((t) => t.status === "APPROVED" && t.name.startsWith("fiaon_")).length;
      const warten = v.filter((t) => t.status === "PENDING" && t.name.startsWith("fiaon_")).length;
      const abgelehnt = v.filter((t) => t.status === "REJECTED" && t.name.startsWith("fiaon_"));
      punkt("wa_vorlagen", "WhatsApp-Vorlagen freigegeben", frei > 0 ? true : null,
        frei === 0 && warten === 0 ? "Noch keine eingereicht — „Verbindung einrichten“ reicht sie ein."
          : `${frei} freigegeben${warten ? `, ${warten} in Prüfung` : ""}${abgelehnt.length ? `, abgelehnt: ${abgelehnt.map((t) => t.name).join(", ")}` : ""}. Ohne Vorlage darf nur antworten, wer uns in den letzten 24 Stunden geschrieben hat.`);
    }
  } catch (err) {
    punkt("whatsapp", "WhatsApp-Nummer", null, err instanceof MetaFehler ? err.klartext : String(err));
  }

  // 7) Datensatz (Pixel) für die Messung — finden oder anlegen.
  //
  // FALLE (22.09.2026, live gefunden): `me/businesses` gibt mit einem
  // SYSTEMNUTZER-Token eine LEERE Liste zurück — die Kante gilt für Menschen,
  // nicht für Systemnutzer. Die Firma steht stattdessen an der Seite
  // (`{seite}?fields=business`). Ohne diesen Weg fand die Einrichtung nie eine
  // Firma und meldete „Konnte keinen Datensatz anlegen", obwohl in Wahrheit
  // gar nicht gesucht wurde.
  try {
    const { datensatzId, DATENSATZ_SCHLUESSEL } = await import("./fiaon-meta-capi");
    let id = await datensatzId(lauf);
    let name = "";
    let hinweis = "";
    let firmaId: string | null = null;
    for (const seite of seiten) {
      const s = await graph(seite, { params: { fields: "business" } }).catch(() => null);
      if (s?.business?.id) { firmaId = String(s.business.id); break; }
    }
    if (!firmaId) {
      const firmen = await graph("me/businesses", { params: { fields: "id,name", limit: 10 } }).catch(() => null);
      firmaId = firmen?.data?.[0]?.id ? String(firmen.data[0].id) : null;
    }
    if (!id && firmaId) {
      const vorhanden = await graphAlle(`${firmaId}/adspixels`, { params: { fields: "id,name", limit: 25 }, hoechstens: 25 }).catch(() => []);
      const passend = vorhanden.find((p: any) => /fiaon/i.test(String(p.name ?? ""))) ?? vorhanden[0];
      if (passend?.id) { id = String(passend.id); name = String(passend.name ?? ""); }
      else if (opts.einrichten) {
        // Der Fehler wird NICHT geschluckt: Meta sagt hier sehr genau, was fehlt
        // (z. B. „Business has not accepted Pixel Terms of Service" — das kann
        // keine Schnittstelle abnicken, das geht nur einmal im Events-Manager).
        try {
          const neuerSatz = await graph(`${firmaId}/adspixels`, { methode: "POST", params: { name: "FIAON" } });
          if (neuerSatz?.id) { id = String(neuerSatz.id); name = "FIAON"; }
        } catch (e) {
          // fehlerKlartext übersetzt den Meta-Fehler bereits in einen Weg
          // (z. B. Pixel-Bedingungen noch nicht angenommen).
          hinweis = e instanceof MetaFehler ? e.klartext : String(e);
        }
      }
      // Ein neuer Datensatz gehört dem Werbekonto zugewiesen, sonst lässt er
      // sich in keiner Kampagne auswählen. Misslingt das, ist der Datensatz
      // trotzdem gültig — deshalb nur ein Versuch, kein Abbruch.
      if (id && opts.einrichten) {
        const konten = await graph(`${firmaId}/owned_ad_accounts`, { params: { fields: "account_id", limit: 10 } }).catch(() => null);
        const konto = konten?.data?.[0]?.account_id;
        if (konto) {
          await graph(`${id}/shared_accounts`, { methode: "POST", params: { account_id: String(konto), business: firmaId } })
            .catch((e) => console.warn("[META] Datensatz nicht ans Werbekonto gehängt:", e instanceof MetaFehler ? e.klartext : String(e)));
        }
      }
      if (id) await einstellungSetzen(DATENSATZ_SCHLUESSEL, id, lauf);
    }
    punkt("datensatz", "Datensatz für die Messung (Pixel)", !!id, id
      ? `${name || "Datensatz"} ${id} — Pixel und Conversions API melden Antrag, Abschluss und Zahlung.`
      : hinweis ? hinweis
        : !firmaId ? "Keine Firma gefunden — gehört die Seite zum Portfolio „FIAON Ltd.“?"
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
/** Wie eine Aufgabe angelegt wird — im Betrieb todoAnlegen, im Prüfstand ein Zähler. */
export type AufgabeAnlegen = (schluessel: string, t: { titel: string; text?: string; bereich?: string; prioritaet?: number; link?: string | null; quelle?: string }) => Promise<void>;

async function alarm(art: string, an: boolean, text: string, lauf: Lauf, opts: { aufgabe?: AufgabeAnlegen; jetzt?: Date } = {}): Promise<void> {
  if (an) {
    const [z] = (await lauf`
      INSERT INTO fiaon_meta_alarme (art, text) VALUES (${art}, ${text})
      ON CONFLICT (art) DO UPDATE SET text = EXCLUDED.text, zuletzt_am = NOW(),
        zaehler = CASE WHEN fiaon_meta_alarme.erledigt_am IS NULL THEN fiaon_meta_alarme.zaehler + 1 ELSE 1 END,
        erstellt_am = CASE WHEN fiaon_meta_alarme.erledigt_am IS NULL THEN fiaon_meta_alarme.erstellt_am ELSE NOW() END,
        erledigt_am = NULL
      RETURNING zaehler`) as any[];
    if (Number(z?.zaehler) === 1) {
      const anlegen: AufgabeAnlegen = opts.aufgabe ?? (await import("../routes/fiaon-betreiber-todo")).todoAnlegen;
      await anlegen(`lead-motor:${art}:${(opts.jetzt ?? new Date()).toISOString().slice(0, 10)}`, {
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

// ═══════════════════════════════════════════════════════════════════════════
// STILLE UND AUSLIEFERUNG (26.09.2026, E-244)
//
// GEMESSEN am 26.09.: Seit dem 24.09. gegen 19 Uhr lieferte Meta keine einzige
// Anzeige mehr aus — 0 € Ausgaben, 0 Impressionen, alle vier Kampagnen standen
// trotzdem auf „Aktiv". Kein Lead, zwei Tage lang. Der Wächter merkte es
// genau einen Nachmittag (25.09. 16:03–18:48) und schwieg danach: Die alte
// Stille-Regel verlangte „gestern zur selben Zeit mindestens drei Leads" —
// ab dem zweiten stillen Tag ist gestern selbst still, und die Regel wird
// blind, obwohl der Stillstand weiterläuft.
//
// ZWEI REGELN, beide als reine Rechnung (prüfbar ohne Datenbank):
//   · stilleBeurteilen: Die Erwartung kommt aus den sieben Tagen VOR dem
//     letzten Lead, nicht aus gestern. Je länger die Stille, desto sicherer
//     der Alarm — er geht erst aus, wenn wieder ein Lead kommt.
//   · auslieferungBeurteilen: gestern UND heute 0 € Ausgaben bei Meta
//     (fiaon_meta_kosten), in den sieben Tagen davor aber Geld geflossen —
//     oder gestern weniger als 30 % des Tagesschnitts der sieben Tage davor.
//     Die Ausgaben zählen nur, wenn der Kostenabruf frisch und fehlerfrei ist;
//     ein alter Stand ist KEIN Beleg für „0 €".
// Der Alarmtext nennt Prüfschritte, keine Vermutung: Ein Alarm, der auf eine
// falsche Ursache zeigt (bis heute: „App auf Live?"), ist schlimmer als keiner.
// ═══════════════════════════════════════════════════════════════════════════

/** JJJJ-MM-TT plus n Tage — reine Kalenderrechnung ohne Zeitzone. */
export function tagPlus(tag: string, n: number): string {
  const [j, m, t] = tag.split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(j, (m || 1) - 1, (t || 1) + n)).toISOString().slice(0, 10);
}
/** „2026-09-25" → „25.09." */
function tagKurz(tag: string): string {
  const [, m, t] = tag.split("-");
  return `${t}.${m}.`;
}
const euro = (cents: number) => (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/** Die Prüfschritte bei Meta — dieselben in jedem Alarm, damit niemand rät. */
export const PRUEFSCHRITTE_AUSLIEFERUNG =
  "1. Werbeanzeigenmanager (adsmanager.facebook.com) → Konto „FIAON Ltd.“ → Kampagnen: Laufen sie überhaupt noch (Enddatum erreicht, pausiert, Budget aufgebraucht)? Dann ist die Pause gewollt. "
  + "Sonst in der Spalte „Auslieferung“ die Maus auf den Status halten, dort nennt Meta den Grund. "
  + "2. Abrechnung & Zahlungen (business.facebook.com/billing_hub) → Zahlungsaktivität: offene oder abgelehnte Zahlung? Zahlungsmethode bestätigen. "
  + "3. Kontoqualität (business.facebook.com/business-support-home): Einschränkung für Werbekonto, Seite oder Profil? "
  + "4. Den Webhook unabhängig davon beweisen: developers.facebook.com/tools/lead-ads-testing → Seite FIAON → Formular → „Lead erstellen“ (einen alten Test-Lead dort vorher löschen). "
  + "Die Plattform erkennt den Test-Lead: kein Kunde, keine Zuteilung, keine Mail — hier springt nur die Kopfzeile auf „Webhook bestätigt“.";

export interface StilleDaten {
  /** Berliner Stunde 0–23. */
  stunde: number;
  jetztMs: number;
  /** Zeitpunkt des letzten Meta-Leads (ms) oder null. */
  letzterMs: number | null;
  /** Leads im Fenster 27–24 Stunden vor jetzt (die alte Regel). */
  gesternFenster: number;
  /** Leads in den sieben Tagen bis zum letzten Lead (einschließlich). */
  vorher7: number;
}
export interface StilleUrteil {
  /** Alarm jetzt an: tagsüber UND still. */
  an: boolean;
  /** Die Bedingung ohne Tageszeit — nachts entscheidet sie nur über „aus“. */
  still: boolean;
  tagsueber: boolean;
  stundenSeit: number | null; erwartet: number; text: string;
}

export function stilleBeurteilen(d: StilleDaten): StilleUrteil {
  const stundenSeit = d.letzterMs == null ? null : Math.max(0, (d.jetztMs - d.letzterMs) / 3_600_000);
  // Erwartung aus der Rate der sieben Tage VOR der Stille (168 Stunden Uhrzeit).
  const erwartet = stundenSeit == null ? 0 : (Math.max(0, d.vorher7) / 168) * stundenSeit;
  const tagsueber = d.stunde >= 9 && d.stunde < 22;
  const still = stundenSeit != null && stundenSeit >= 3
    && (d.gesternFenster >= 3 || (d.vorher7 >= 7 && erwartet >= 3));
  const seitText = d.letzterMs == null ? "" : new Date(d.letzterMs).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const text = `Kein Lead aus Meta seit ${seitText} — in dieser Zeit wären nach den sieben Tagen davor etwa ${Math.round(erwartet)} Leads zu erwarten gewesen. `
    + `Kosten des Tages im Lead-Motor ansehen (fließt noch Geld?), dann bei Meta prüfen: ${PRUEFSCHRITTE_AUSLIEFERUNG}`;
  return { an: tagsueber && still, still, tagsueber, stundenSeit, erwartet, text };
}

export interface AuslieferungDaten {
  /** Heute in Berlin, JJJJ-MM-TT. */
  heute: string;
  /** Der Kostenabruf ist fehlerfrei, jünger als 7 Stunden und reicht bis heute. */
  kostenFrisch: boolean;
  /** Ausgaben je Tag in Cent (Kampagnen-Ebene). Tage ohne Zeile = 0 €. */
  ausgabenJeTag: Record<string, number>;
  /** Meta-Leads je Berliner Tag. */
  leadsJeTag: Record<string, number>;
  /** Bis zu welchem Tag der letzte fehlerfreie Kostenabruf reicht (auch wenn er alt ist). */
  kostenBis?: string | null;
}
export interface AuslieferungUrteil {
  an: boolean;
  grund: "keine_ausgaben" | "leads_eingebrochen" | null;
  /** Belegt: frischer Kostenstand, gestern und heute 0 € — egal, was davor war. */
  ohneAusgaben: boolean;
  /** Erster Tag ohne Ausgaben (nur bei keine_ausgaben). */
  seit: string | null;
  letzteAusgabe: { tag: string; cents: number } | null;
  leadsGestern: number;
  leadsSchnitt: number;
  text: string;
}

/** Der Anfang jedes Einbruch-Textes — daran erkennt der Wächter die Art eines offenen Alarms. */
export const EINBRUCH_ANFANG = "Meta-Leads eingebrochen";

export function auslieferungBeurteilen(d: AuslieferungDaten): AuslieferungUrteil {
  const gestern = tagPlus(d.heute, -1);
  const aus = (t: string) => Math.max(0, Number(d.ausgabenJeTag[t] || 0));
  const leads = (t: string) => Math.max(0, Number(d.leadsJeTag[t] || 0));
  // Die sieben Tage VOR gestern: heute-8 … heute-2.
  const davor = Array.from({ length: 7 }, (_, i) => tagPlus(d.heute, -2 - i));
  const ausgabenDavor = davor.reduce((s, t) => s + aus(t), 0);
  const letzterTag = davor.find((t) => aus(t) > 0) ?? null;
  const ohneAusgaben = d.kostenFrisch && aus(gestern) === 0 && aus(d.heute) === 0;
  const keineAusgaben = ohneAusgaben && ausgabenDavor > 0;

  const leadsGestern = leads(gestern);
  const leadsSchnitt = davor.reduce((s, t) => s + leads(t), 0) / 7;
  const eingebrochen = leadsSchnitt >= 3 && leadsGestern < 0.3 * leadsSchnitt;

  const schnittText = leadsSchnitt.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  const leadSatz = `Gestern kamen ${leadsGestern} Leads aus Meta, in den sieben Tagen davor im Schnitt ${schnittText} am Tag.`;
  if (keineAusgaben && letzterTag) {
    const seit = tagPlus(letzterTag, 1);
    return {
      an: true, grund: "keine_ausgaben", ohneAusgaben, seit, letzteAusgabe: { tag: letzterTag, cents: aus(letzterTag) }, leadsGestern, leadsSchnitt,
      text: `Meta liefert seit ${tagKurz(seit)} nicht aus — im eigenen Werbekonto gestern und heute 0 € Ausgaben, zuletzt ${euro(aus(letzterTag))} am ${tagKurz(letzterTag)}. `
        + `Solange dort kein Geld fließt, bringen die eigenen Anzeigen keine Leads; an Webhook und Nachhol-Lauf liegt das nicht. ${leadSatz} `
        + `Ist die Pause gewollt (Kampagnen beendet oder pausiert), erlischt dieser Hinweis nach sieben Tagen ohne Ausgaben von selbst. Prüfen: ${PRUEFSCHRITTE_AUSLIEFERUNG}`,
    };
  }
  if (eingebrochen) {
    return {
      an: true, grund: "leads_eingebrochen", ohneAusgaben, seit: null, letzteAusgabe: letzterTag ? { tag: letzterTag, cents: aus(letzterTag) } : null, leadsGestern, leadsSchnitt,
      text: `${EINBRUCH_ANFANG}: gestern ${leadsGestern} statt Ø ${schnittText} — ${leadSatz} `
        + `Erst im Lead-Motor die Kosten ansehen: Fließt noch Geld, liegt es an Anzeige oder Formular; fließt keins, liefert Meta nicht aus. Prüfen: ${PRUEFSCHRITTE_AUSLIEFERUNG}`,
    };
  }
  return { an: false, grund: null, ohneAusgaben, seit: null, letzteAusgabe: null, leadsGestern, leadsSchnitt, text: "" };
}

/** Holt die Zahlen für auslieferungBeurteilen — nur lesend. */
export async function auslieferungDaten(lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<AuslieferungDaten> {
  const { berlinToday } = await import("./fiaon-time");
  const { kostenTabelle, KOSTEN_STAND_SCHLUESSEL } = await import("./fiaon-meta-kosten");
  await kostenTabelle(lauf);
  const heute = berlinToday(jetzt);
  const ab = tagPlus(heute, -9);
  const kosten = (await lauf`
    SELECT to_char(tag, 'YYYY-MM-DD') AS tag, SUM(ausgaben_cents)::bigint AS cents
      FROM fiaon_meta_kosten WHERE ebene = 'kampagne' AND tag >= ${ab}::date GROUP BY 1`) as any[];
  const leads = (await lauf`
    SELECT to_char((erstellt_am AT TIME ZONE 'Europe/Berlin')::date, 'YYYY-MM-DD') AS tag, COUNT(*)::int AS n
      FROM fiaon_leads WHERE quelle = 'facebook_lead_ads'
       AND erstellt_am > ${jetzt}::timestamptz - INTERVAL '11 days' AND erstellt_am <= ${jetzt}::timestamptz GROUP BY 1`) as any[];
  let kostenFrisch = false;
  let kostenBis: string | null = null;
  try {
    const st = JSON.parse((await einstellung(KOSTEN_STAND_SCHLUESSEL, lauf)) ?? "null");
    kostenBis = st?.ok && /^\d{4}-\d{2}-\d{2}$/.test(String(st?.bis ?? "")) ? String(st.bis) : null;
    kostenFrisch = !!st?.ok && String(st?.bis ?? "") === heute
      && Number.isFinite(Date.parse(st?.am)) && jetzt.getTime() - Date.parse(st.am) < 7 * 3_600_000;
  } catch { kostenFrisch = false; }
  const ausgabenJeTag: Record<string, number> = {};
  for (const r of kosten) ausgabenJeTag[String(r.tag)] = Number(r.cents || 0);
  const leadsJeTag: Record<string, number> = {};
  for (const r of leads) leadsJeTag[String(r.tag)] = Number(r.n || 0);
  return { heute, kostenFrisch, ausgabenJeTag, leadsJeTag, kostenBis };
}

/**
 * Ruhe für die Stille-Regel: Kein Werbegeld erklärt keine Leads. Belegt bei
 * frischem Stand (gestern und heute 0 €). Bei ALTEM Stand zählt, was er noch
 * weiß: Reicht er bis gestern und stand gestern wie heute 0 €, bleibt die
 * Stille ruhig — sonst würde jeder ausgefallene Kostenabruf mitten in einer
 * gewollten Pause eine neue Prio-1-Aufgabe bringen. Reicht er nicht mehr bis
 * gestern, entscheidet wieder die Stille allein.
 */
export function stilleRuhe(d: AuslieferungDaten): boolean {
  const gestern = tagPlus(d.heute, -1);
  const null0 = (t: string) => Number(d.ausgabenJeTag[t] || 0) <= 0;
  if (d.kostenFrisch) return null0(gestern) && null0(d.heute);
  return !!d.kostenBis && d.kostenBis >= gestern && null0(gestern) && null0(d.heute);
}

/**
 * Stille und Auslieferung — der Teil des Wächters, der nur die Datenbank
 * braucht (kein Meta-Zugang). Eigene Stufe, damit der Prüfstand Läufe über
 * Tag/Nacht und alten/frischen Kostenstand gegen eine zurückgerollte Buchung
 * fahren kann (.pruef/e244-meta-waechter.mts).
 *
 * NACHBESSERUNG 26.09.2026 (Gegenprüfung E-244):
 *   · Stille ENDET nicht mehr nachts: Außerhalb 9–22 Uhr wird der Alarm nur
 *     ausgeschaltet, wenn die Stille vorbei ist — nie „erledigt“, nur weil es
 *     Nacht ist. Vorher begann der Zähler jeden Morgen bei 1, und jeder Tag
 *     brachte eine NEUE Prio-1-Aufgabe.
 *   · Keine Ausgaben erklären keine Leads: Steht bei frischem Kostenstand
 *     gestern und heute 0 €, gibt es keinen Stille-Alarm — egal, was davor
 *     war (auch nach dem geplanten Kampagnenende, dann dauerhaft ruhig).
 *   · Ein alter Kostenstand darf „Meta liefert nicht aus“ weder an- noch
 *     ausschalten; ein offener EINBRUCH-Alarm geht aber aus, sobald die Leads
 *     wieder fließen — dafür braucht es keine Kosten.
 */
export async function waechterLeadRegeln(lauf: Lauf = sqlPool, opts: { jetzt?: Date; aufgabe?: AufgabeAnlegen } = {}): Promise<string[]> {
  await metaTabellen(lauf);
  const jetzt = opts.jetzt ?? new Date();
  const aOpts = { aufgabe: opts.aufgabe, jetzt };
  const aktiv: string[] = [];

  const [st] = (await lauf`
    WITH l AS (SELECT MAX(erstellt_am) AS letzter FROM fiaon_leads WHERE quelle = 'facebook_lead_ads' AND erstellt_am <= ${jetzt}::timestamptz)
    SELECT l.letzter,
      (SELECT COUNT(*)::int FROM fiaon_leads WHERE quelle = 'facebook_lead_ads'
         AND erstellt_am BETWEEN ${jetzt}::timestamptz - INTERVAL '27 hours' AND ${jetzt}::timestamptz - INTERVAL '24 hours') AS gestern,
      (SELECT COUNT(*)::int FROM fiaon_leads WHERE quelle = 'facebook_lead_ads'
         AND erstellt_am > l.letzter - INTERVAL '7 days' AND erstellt_am <= l.letzter) AS vorher7
      FROM l
  `) as any[];
  const stille = stilleBeurteilen({
    stunde: berlinStunde(jetzt), jetztMs: jetzt.getTime(), letzterMs: st?.letzter ? new Date(st.letzter).getTime() : null,
    gesternFenster: Number(st?.gestern || 0), vorher7: Number(st?.vorher7 || 0),
  });

  // Auslieferung: fließt bei Meta überhaupt noch Geld?
  let ohneAusgaben = false;
  try {
    const au = await auslieferungDaten(lauf, jetzt);
    const u = auslieferungBeurteilen(au);
    if (au.kostenFrisch || u.an) {
      await alarm("auslieferung", u.an, u.text, lauf, aOpts);
    } else {
      // Alter Kostenstand, kein Einbruch: nur ein offener EINBRUCH-Alarm darf
      // aus („liefert nicht aus“ entscheidet erst ein frischer Stand).
      await lauf`
        UPDATE fiaon_meta_alarme SET erledigt_am = NOW()
         WHERE art = 'auslieferung' AND erledigt_am IS NULL AND text LIKE ${EINBRUCH_ANFANG + "%"}`;
    }
    if (u.an) aktiv.push("auslieferung");
    ohneAusgaben = stilleRuhe(au);
  } catch (e) {
    console.warn("[LEAD-MOTOR] Auslieferung nicht prüfbar:", e instanceof Error ? e.message : String(e));
  }

  // Stille: Ohne Werbegeld ist sie keine Störung (die Auslieferung sagt es,
  // wenn davor Geld floss). Nachts nur aus, nie an und nie „erledigt“ aus
  // bloßer Tageszeit.
  if (ohneAusgaben || !stille.still) {
    await alarm("stille", false, stille.text, lauf, aOpts);
  } else if (stille.tagsueber) {
    await alarm("stille", true, stille.text, lauf, aOpts);
    aktiv.push("stille");
  }
  return aktiv;
}

export async function waechterLauf(lauf: Lauf = sqlPool): Promise<{ alarme: string[] }> {
  await metaTabellen(lauf);
  const k = metaKonfig();
  const aktiv: string[] = [];
  if (!k.bereit) return { alarme: aktiv };

  // Stille und Auslieferung (E-244) — siehe waechterLeadRegeln.
  aktiv.push(...(await waechterLeadRegeln(lauf)));

  // Webhook schweigt, Nachhol-Lauf findet: Das Abo ist weg oder gestört.
  const [w] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE weg = 'meta_webhook')::int AS webhook,
           COUNT(*) FILTER (WHERE weg = 'meta_nachhol')::int AS nachhol
      FROM fiaon_meta_leads WHERE gesehen_am > NOW() - INTERVAL '3 hours'`) as any[];
  const webhookStumm = Number(w?.nachhol || 0) >= 2 && Number(w?.webhook || 0) === 0;
  // ══════════════════════════════════════════════════════════════════════
  // DER ALARM MUSS SAGEN, WAS ZU TUN IST (23.09.2026, E-226)
  //
  // Der alte Text schickte auf „Verbindung einrichten" — Justin hat gedrückt,
  // alles blieb grün, und es kam trotzdem kein Lead über den Webhook.
  //
  // GEMESSEN am 23.09.: In sieben Tagen kein einziger Lead mit dem Eingangsweg
  // `meta_webhook`; alles kam über den Nachhol-Lauf oder Make. Gleichzeitig
  // erreichen uns WhatsApp-Ereignisse über DIESELBE Adresse im Sekundentakt
  // (POST /api/meta/webhook, HTTP 200). Adresse, Prüftoken und Signatur sind
  // also in Ordnung — sonst käme auch WhatsApp nicht an.
  //
  // Bleiben zwei Ursachen, und beide liegen bei Meta, nicht bei uns:
  //   1. Die App steht auf „Entwicklung" statt „Live". Dann zeigt Meta jedes
  //      Abo als bestehend an und liefert trotzdem keine echten Ereignisse.
  //   2. Das Lead-Formular hängt an einer anderen Seite als der abonnierten.
  //
  // Der Alarm nennt das jetzt. Ein Alarm, der zu einem Knopf schickt, der das
  // Problem nicht löst, ist schlimmer als keiner: Man drückt, es bleibt grün,
  // und man glaubt, es liege an etwas anderem.
  //
  // NACHTRAG 26.09.2026 (E-244): Ursache 1 ist erledigt — Justin hat die App
  // auf „Live" gestellt. Ursache 2 ist über die Schnittstelle ausgeschlossen:
  // Beide Lead-Anzeigen nutzen Formulare der abonnierten Seite FIAON. Die
  // Frage nach dem Live-Modus fällt deshalb aus dem Text; stattdessen stehen
  // dort die drei Stellen, an denen man den Webhook bei Meta selbst sieht.
  // ══════════════════════════════════════════════════════════════════════
  await alarm("webhook", webhookStumm,
    "Der Webhook meldet keine Leads — der Nachhol-Lauf fängt sie auf (bis zu 5 Minuten später), es geht also nichts verloren. "
    + "Adresse und Token stimmen: Über dieselbe Adresse kommen WhatsApp-Ereignisse an. "
    + "Prüfen: 1. developers.facebook.com/tools/lead-ads-testing → Seite FIAON → Formular → „Lead erstellen“ — kommt die Meldung, springt hier die Kopfzeile auf „Webhook bestätigt“ "
    + "(der Test-Lead wird erkannt: kein Kunde, keine Zuteilung, keine Mail). "
    + "2. App-Dashboard → Webhooks → Objekt „Page“: Feld „leadgen“ abonniert, Adresse wie unten unter „Verbindung zu Meta“. "
    + "3. Seite FIAON → Einstellungen → Integrationen → Leadzugriff: Die App „FIAON Ltd.“ ist zugelassen.",
    lauf);
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

/**
 * E-244: Ist der Webhook bewiesen? Nur eine Lead-Meldung (page/leadgen), die
 * die Signaturprüfung bestanden hat UND deren Lead sich bei Meta abrufen ließ
 * (status verarbeitet, ungueltig oder test). Die Beispielmeldung aus dem
 * App-Dashboard (status beispiel, Kennung 444…) zählt NICHT — sie beweist das
 * Seiten-Abo nicht. Eine grüne Prüfliste beweist es auch nicht (Meta zeigt
 * Abos auch dann als bestehend, wenn nie etwas geliefert wird).
 */
export const WEBHOOK_BEWEIS_STATUS = ["verarbeitet", "ungueltig", "test"] as const;
export async function webhookBeweis(lauf: Lauf = sqlPool): Promise<{ ersteMeldung: string | null; letzteMeldung: string | null; webhookLeads: number }> {
  await metaTabellen(lauf);
  const [r] = (await lauf`
    SELECT MIN(empfangen_am) AS erste, MAX(empfangen_am) AS letzte,
           (SELECT COUNT(*)::int FROM fiaon_meta_leads WHERE weg = 'meta_webhook') AS leads
      FROM fiaon_meta_ereignisse
     WHERE objekt = 'page' AND feld = 'leadgen' AND status IN ${lauf([...WEBHOOK_BEWEIS_STATUS])}`) as any[];
  const iso = (v: unknown) => (v ? new Date(v as any).toISOString() : null);
  return { ersteMeldung: iso(r?.erste), letzteMeldung: iso(r?.letzte), webhookLeads: Number(r?.leads || 0) };
}

/** Für Hinweise im Steuerpult: die öffentliche Adresse des Webhooks und der Plattform. */
export function adressen(): { webhook: string; plattform: string } {
  return { webhook: webhookAdresse(), plattform: absoluteUrl("/") };
}
