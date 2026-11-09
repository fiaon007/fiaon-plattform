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
//      E-490 F1 (09.11.2026): Er findet auch NEUE Formulare selbst (höchstens
//      stündlich, Seiten-Token) und holt deren Leads ab der Anlage nach — siehe
//      „NACHHOL-LAUF UND RÜCKSTAND“.
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
// E-408 (Scheibe 3, 22.10.2026): „Ja zum Anruf“ aus dem Formular — derselbe JA-Erkenner wie auf WhatsApp.
import { istKlaresJa } from "../../shared/fiaon-ja-zum-anruf";
// E-476 (05.11.2026): Klartext der Antworten und der Platzhalter „(Firma noch offen)“ — an EINER Stelle.
import {
  metaAntworten, antwortZeile, schluesselLesbar, firmaOffenPlatzhalter, type MetaFrageDef, type LeadAntwort,
} from "../../shared/fiaon-global-lead";
// E-476 Scheibe 5 (05.11.2026): der Merker des bekannten Zustands „Webhook still“ — ein Schlüssel, eine Stelle.
import { LEAD_TAKT_SCHLUESSEL } from "../../shared/fiaon-lead-takt";

/** E-476 Nachbesserung: der Weg-Wert einer Zeile ohne Mail und Telefon (nie eine verwaiste Beanspruchung, nie neu versucht). */
export const META_UNGUELTIG = "meta_ungueltig";

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
  // E-466 (30.10.2026): Ein Lead aus einem „FIAON Global …“-Formular wird eine Global-Anfrage, kein Privat-Lead.
  await lauf`ALTER TABLE fiaon_meta_leads ADD COLUMN IF NOT EXISTS global_anfrage_id INTEGER`;
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
// JA ZUM ANRUF AUS DEM FORMULAR (E-408 Scheibe 3, 22.10.2026) — rein, ohne Datenbank (Prüfstand)
//
// Fragt ein Lead-Formular AUSDRÜCKLICH nach dem Ja zum Anruf — als Kästchen im benutzerdefinierten Hinweis
// (custom_disclaimer) oder als eigene Frage — und hat er Ja gesagt, entsteht beim Einspielen EINE Einwilligung der Art
// „meta_kaestchen“ (fiaon_telefon_einwilligung) mit dem Wortlaut der Frage. Erkannt an Schlüssel ODER Text: „anruf/
// telefon“ UND „einwillig/zustimm/ja“. Nie daraus: ein Pflicht-Kästchen (nicht freiwillig, DSGVO Art. 7 Abs. 4), ein
// nicht angehaktes Kästchen, eine Antwort, die kein klares Ja ist — und der Hinweistext ohne Kästchen („Mit dem Absenden
// erlauben Sie …“): Ein Hinweis ist keine Einwilligung.
// Gemessen am 22.10.2026 (Produktion, nur lesend, nur Feldnamen): Die drei Formulare fragen Name, E-Mail und Telefon
// (eines dazu „inbox_url“), KEIN Kästchen, keine eigene Frage — heute entsteht hier also nichts. Was ergänzt werden
// müsste: ein freiwilliges Kästchen mit dem Schlüssel „anruf_einwilligung“ (Bericht E-408).
// ═══════════════════════════════════════════════════════════════════════════
export const META_ANRUF_WORT = /anruf|telefon/i;
export const META_JA_WORT = new RegExp("einwillig|willige|zustimm|stimme\\s+zu|(?:^|[^\\p{L}])ja(?:$|[^\\p{L}])", "iu");

export interface MetaAnrufJa { wortlaut: string; schluessel: string; weg: "kaestchen" | "frage"; antwort: string }
export interface MetaFormularTeile {
  fragen?: { key?: string; label?: string; type?: string }[] | null;
  kaestchen?: { key?: string; text?: string; is_required?: boolean }[] | null;
}

/** Hat dieser Lead im Formular Ja zum Anruf gesagt? Dann Wortlaut, Schlüssel, Weg und Antwort — sonst null. */
export function anrufJaAusMeta(roh: MetaRohLead, formular: MetaFormularTeile | null): MetaAnrufJa | null {
  const passt = (...teile: (string | null | undefined)[]) => {
    const t = teile.filter(Boolean).join(" ");
    return META_ANRUF_WORT.test(t) && META_JA_WORT.test(t);
  };
  for (const c of roh.custom_disclaimer_responses ?? []) {
    const key = String(c?.checkbox_key ?? "").trim();
    if (!key) continue;
    const def = (formular?.kaestchen ?? []).find((k) => String(k?.key ?? "").trim() === key);
    if (!passt(key, def?.text) || def?.is_required === true || !ja(c?.is_checked)) continue;
    const text = String(def?.text ?? "").replace(/\s+/g, " ").trim();
    return { wortlaut: text || `Kästchen „${key}“ (Text nicht geladen)`, schluessel: key, weg: "kaestchen", antwort: "angehakt" };
  }
  const telefonFelder = new Set(FELD.telefon);
  for (const f of roh.field_data ?? []) {
    const key = String(f?.name ?? "").trim().toLowerCase();
    if (!key || telefonFelder.has(key)) continue;
    const def = (formular?.fragen ?? []).find((q) => String(q?.key ?? "").trim().toLowerCase() === key);
    if (!passt(key, def?.label)) continue;
    const wert = String(f?.values?.[0] ?? "").trim();
    if (!(ja(wert) || istKlaresJa(wert))) continue;
    const label = String(def?.label ?? "").replace(/\s+/g, " ").trim();
    return { wortlaut: label || key, schluessel: key, weg: "frage", antwort: wert.slice(0, 120) };
  }
  return null;
}

/**
 * Nach dem Einspielen: Ja zum Anruf aus dem Formular → Einwilligung „meta_kaestchen“ (genau einmal je Meta-Lead,
 * Quelle meta_lead + Meta-Lead-ID, Zeitpunkt = sein Absenden). Ohne Kästchen-Antwort und ohne eigene Frage (heute jeder
 * Lead) keine Abfrage. Wirft nie — ein Lead wird nie wegen der Einwilligung nicht angelegt.
 */
export async function anrufJaAusMetaMerken(roh: MetaRohLead, f: MetaLeadFelder, erg: { leadId: number | null; personId: number | null }, weg: string, lauf: Lauf = sqlPool): Promise<number | null> {
  try {
    if (!(roh.custom_disclaimer_responses ?? []).length && !Object.keys(f.fragen).length) return null;
    const [fd] = roh.form_id ? ((await lauf`SELECT fragen, kaestchen FROM fiaon_meta_formulare WHERE id = ${roh.form_id}`) as any[]) : [];
    const treffer = anrufJaAusMeta(roh, fd ? { fragen: Array.isArray(fd.fragen) ? fd.fragen : [], kaestchen: Array.isArray(fd.kaestchen) ? fd.kaestchen : [] } : null);
    if (!treffer) return null;
    if (!f.telefon) { console.warn(`[META-LEADS] ${roh.id}: Ja zum Anruf im Formular, aber keine Telefonnummer — nichts gespeichert.`); return null; }
    const { arasSchema } = await import("./fiaon-aras-schema");
    await arasSchema(lauf);
    const [schon] = (await lauf`SELECT id FROM fiaon_telefon_einwilligung WHERE art = 'meta_kaestchen' AND quelle_art = 'meta_lead' AND quelle_id = ${String(roh.id)} LIMIT 1`) as any[];
    if (schon) return Number(schon.id);
    const { waehlbareNummer } = await import("./fiaon-telefon");
    const { einwilligungMerken } = await import("./fiaon-telefon-einwilligung");
    const abgeschickt = roh.created_time && Number.isFinite(Date.parse(roh.created_time)) ? new Date(roh.created_time) : new Date();
    const { id } = await einwilligungMerken({
      personId: erg.personId, leadId: erg.leadId, nummer: waehlbareNummer([{ nummer: f.telefon }], f.land).waehlbar ?? f.telefon,
      art: "meta_kaestchen", wortlaut: treffer.wortlaut, quelleArt: "meta_lead", quelleId: String(roh.id), erteiltAm: abgeschickt,
      beleg: { formularId: roh.form_id ?? null, schluessel: treffer.schluessel, weg: treffer.weg, antwort: treffer.antwort,
        plattform: f.plattform, anzeigeId: roh.ad_id ?? null, kampagneId: roh.campaign_id ?? null, eingang: weg },
    }, lauf);
    console.log(`[META-LEADS] ${roh.id}: Ja zum Anruf aus dem Formular gespeichert (Nr. ${id}).`);
    return id;
  } catch (e) {
    console.error(`[META-LEADS] ${roh.id}: Ja zum Anruf aus dem Formular NICHT gespeichert — der Lead ist trotzdem angelegt:`, e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EINSPIELEN — idempotent über die Meta-Lead-ID
// ═══════════════════════════════════════════════════════════════════════════
export type EinspielErgebnis = { status: "neu" | "dublette" | "ungueltig" | "test"; leadId: number | null; grund?: string; globalAnfrageId?: number | null };

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

/** E-476: die gespeicherten Fragen eines Formulars (mit Optionen) — JSONB, zur Sicherheit auch als Text gelesen. */
function fragenAus(v: unknown): MetaFrageDef[] | null {
  let o: any = v;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  return Array.isArray(o) ? (o as MetaFrageDef[]) : null;
}

/**
 * Das Formular kennen wir? Sonst jetzt laden (Name, Kästchen) — für Anzeige und Einwilligung. E-476 (05.11.2026): dazu
 * die Fragen samt Optionen — daraus wird der Klartext der Antworten (statt „vorhaben_3“).
 */
async function formularSichern(formularId: string | undefined, seiteId: string | null, lauf: Lauf): Promise<{ name: string | null; einwilligungSchluessel: string | null; fragen: MetaFrageDef[] | null }> {
  if (!formularId) return { name: null, einwilligungSchluessel: null, fragen: null };
  const [da] = (await lauf`SELECT name, einwilligung_schluessel, fragen FROM fiaon_meta_formulare WHERE id = ${formularId}`) as any[];
  if (da) return { name: da.name ?? null, einwilligungSchluessel: da.einwilligung_schluessel ?? null, fragen: fragenAus(da.fragen) };
  try {
    const token = seiteId ? await seitenToken(seiteId) : undefined;
    const f = await formularLesen(formularId, token);
    await formularSpeichern(f, seiteId, lauf);
    const [neu] = (await lauf`SELECT name, einwilligung_schluessel, fragen FROM fiaon_meta_formulare WHERE id = ${formularId}`) as any[];
    return { name: neu?.name ?? null, einwilligungSchluessel: neu?.einwilligung_schluessel ?? null, fragen: fragenAus(neu?.fragen) };
  } catch {
    return { name: null, einwilligungSchluessel: null, fragen: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE WEICHE (30.10.2026, E-466)
//
// Bis heute wurde JEDER Meta-Lead über processIntake ein Privat-Lead: Begrüßung,
// Kreditkarten-Strecke, WhatsApp-Vorlagen fiaon_kk_*. Für ein Unternehmen, das
// über eine Anzeige von FIAON Global eine US-Gesellschaft anfragt, ist das falsch
// (E-272: Global-Kunden raus aus allen Privat-Abläufen).
//
// Die Weiche: Beginnt der Formularname mit „FIAON Global“ (so heißen die Formulare
// der Global-Anzeigen) oder steht die Formular-ID in der Einstellung
// META_GLOBAL_FORMULARE (Rückfall, falls jemand ein Formular anders benennt) oder heißt
// die Kampagne „FIAON Global …“ (falls Meta den Formularnamen gerade nicht liefert), dann
// läuft der Lead über globalAnfrageAnnehmen — denselben Weg wie die Anfrage von
// fiaon.com/business: Anfrage (fiaon_anfragen, art „global“), Firma ganz oben im
// Firmen-Cockpit, dringende Aufgabe für die zuständige Person
// (global_zustaendig_agent_id). Kein processIntake, keine Privat-Mail, kein WhatsApp.
// Die Antworten der Auswahlfragen stehen in der Anfrage und in der Aufgabe.
//
// E-476 (05.11.2026): IM KLARTEXT. Bis heute stand dort der Options-Schlüssel („Vorhaben: vorhaben_3“), obwohl
// formularSpeichern Fragetext und Optionen längst in fiaon_meta_formulare.fragen ablegt. Jetzt: „Was planen Sie mit
// Ihrer US-Gesellschaft? — Beides“ (Frage bis zum ersten „?“, damit fällt der Institut-Satz des Rahmen-Labels weg) —
// in Anfrage, Cockpit-Verlauf und Daniels Auftrag. Ohne gespeichertes Formular: lesbarer Schlüssel + Wert wie bisher.
// Dazu geht das Lead-Dossier an Justin (fiaon-lead-dossier.ts) — angestoßen in globalAnfrageAnnehmen.
// ═══════════════════════════════════════════════════════════════════════════
export const META_GLOBAL_FORMULARE = "meta_global_formular_ids";

/** Gehört das Formular zu FIAON Global? Name „FIAON Global …“ oder ausdrücklich eingetragene ID. */
export function istGlobalFormular(name: string | null | undefined, formularId?: string | null, ids: readonly string[] = []): boolean {
  if (formularId && ids.includes(String(formularId).trim())) return true;
  return /^\s*FIAON\s+Global(\b|\s|$)/i.test(String(name ?? ""));
}

/** Meta liefert eigene Fragen als Schlüssel („wann_möchten_sie_gründen?“) — lesbar machen. */
export function frageLesbar(schluessel: string): string {
  return schluesselLesbar(schluessel);
}

const FIRMA_FELD = ["company_name", "firma", "unternehmen", "firmenname", "name_des_unternehmens"];

/**
 * E-476: die Antworten eines Global-Leads in Klartext (shared/fiaon-global-lead.ts — dieselbe Übersetzung wie im Dossier).
 * Nachbesserung (Gutachten Technik 05.11.2026): Der Eingang darf hier nie werfen — eine kaputte Formular-Definition
 * fällt auf den alten Weg zurück (lesbarer Schlüssel + Rohwert), sonst bliebe der Lead in keinem Nachhol-Lauf hängen.
 */
export function globalMetaAntworten(f: MetaLeadFelder, fragen: MetaFrageDef[] | null): LeadAntwort[] {
  const ohneFirma = Object.fromEntries(Object.entries(f.fragen ?? {}).filter(([k]) => !FIRMA_FELD.includes(k)));
  try {
    return metaAntworten(ohneFirma, Array.isArray(fragen) ? fragen : null);
  } catch {
    return Object.entries(ohneFirma).filter(([, v]) => String(v ?? "").trim())
      .map(([k, v]) => ({ schluessel: k, frage: schluesselLesbar(k), antwort: String(v).trim(), code: null }));
  }
}

/** Die Nachricht der Global-Anfrage: Formular, Antworten im Klartext, Anzeige — für die Person, die anruft. */
export function globalMetaText(f: MetaLeadFelder, formularName: string | null, roh: MetaRohLead, fragen: MetaFrageDef[] | null = null): string {
  const antworten = globalMetaAntworten(f, fragen).map(antwortZeile);
  return [
    `Über das Meta-Sofortformular${formularName ? ` „${formularName}“` : ""}${f.plattform ? ` (${f.plattform})` : ""}.`,
    ...antworten,
    roh.ad_name ? `Anzeige: ${roh.ad_name}` : null,
    roh.campaign_name ? `Kampagne: ${roh.campaign_name}` : null,
  ].filter(Boolean).join("\n").slice(0, 2000);
}

async function globalMetaLeadEinspielen(
  roh: MetaRohLead, f: MetaLeadFelder, formularName: string | null, weg: string, lauf: Lauf, fragen: MetaFrageDef[] | null = null,
): Promise<EinspielErgebnis> {
  const email = String(f.email ?? "").trim().toLowerCase();
  const telefon = String(f.telefon ?? "").trim();
  if (!email && !telefon) {
    // Nachbesserung (Gutachten Technik, Mangel 4): ein eigener Weg-Wert „meta_ungueltig“ — sonst sähe die Zeile aus wie eine
    // verwaiste Beanspruchung und liefe alle fünf Minuten neu.
    await lauf`
      INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, erstellt_am, weg)
      VALUES (${String(roh.id)}, NULL, ${roh.form_id ?? null}, ${roh.created_time ?? null}, ${META_UNGUELTIG})
      ON CONFLICT (meta_lead_id) DO UPDATE SET weg = ${META_UNGUELTIG}
       WHERE fiaon_meta_leads.lead_id IS NULL AND fiaon_meta_leads.global_anfrage_id IS NULL`;
    return { status: "ungueltig", leadId: null, grund: "Global-Formular ohne E-Mail und Telefon" };
  }
  const name = String(f.vollname ?? [f.vorname, f.nachname].filter(Boolean).join(" ")).trim() || "Kontakt aus Meta-Formular";
  const firmaFeld = FIRMA_FELD.map((k) => f.fragen[k]).find((v) => v && v.trim());
  // E-476 Scheibe 3 (Gutachten 0, Mangel 4): ERST BEANSPRUCHEN, DANN ANNEHMEN. Der Danke-Knopf (/gb, Weg „meta_danke“)
  // und der Nachhol-Lauf können denselben Lead gleichzeitig holen — vorher entstanden dann zwei Anfragen, zwei Aufträge,
  // zwei Dossiers. Jetzt gewinnt genau einer die Zeile (PRIMARY KEY meta_lead_id); der andere ist „dublette“. Scheitert die
  // Annahme, wird die Beanspruchung zurückgenommen — der nächste Lauf versucht es neu, nichts geht verloren.
  // Nachbesserung (Gutachten Technik, Mangel 4): Starb ein Prozess zwischen Beanspruchen und Annehmen (Deploy, Neustart), blieb
  // die Zeile ohne Ziel stehen — jeder spätere Lauf meldete „dublette“, der Lead kam nie an. Eine Beanspruchung ohne Ziel, die
  // älter als drei Minuten ist (eine Annahme dauert Sekunden; der Danke-Knopf wartet genauso lange), wird deshalb neu
  // beansprucht — atomar, nur EIN Lauf gewinnt sie. Drei statt zehn Minuten, damit der nächste 5-Minuten-Nachhol-Lauf den Lead
  // noch in seinem Fenster hat.
  const [frei] = (await lauf`
    INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, erstellt_am, weg)
    VALUES (${String(roh.id)}, NULL, ${roh.form_id ?? null}, ${roh.created_time ?? null}, ${weg})
    ON CONFLICT (meta_lead_id) DO UPDATE SET gesehen_am = NOW(), weg = EXCLUDED.weg
     WHERE fiaon_meta_leads.global_anfrage_id IS NULL AND fiaon_meta_leads.lead_id IS NULL
       AND fiaon_meta_leads.weg NOT IN ('meta_test', ${META_UNGUELTIG}) AND fiaon_meta_leads.gesehen_am < NOW() - INTERVAL '3 minutes'
    RETURNING meta_lead_id`) as any[];
  if (!frei) return { status: "dublette", leadId: null };
  const { globalAnfrageAnnehmen } = await import("./fiaon-global-termin");
  let erg: Awaited<ReturnType<typeof globalAnfrageAnnehmen>>;
  try {
    erg = await globalAnfrageAnnehmen({
      kontakt: {
        name, vorname: f.vorname, nachname: f.nachname,
        // Das Kapital-Formular fragt die Firma (company_name), das US-Gesellschaft-Formular nicht — dann steht der Name für
        // sie, bis das Gespräch sie klärt. Der Platzhalter kommt aus EINER Konstante (E-476: das Dossier erkennt ihn daran).
        firma: (firmaFeld?.trim() || firmaOffenPlatzhalter(name)).slice(0, 200),
        email, telefon,
        paket: null, paketText: null,
        land: f.land, sprache: "de",
      },
      wunschzeit: null,
      text: globalMetaText(f, formularName, roh, fragen),
      ip: "meta-sofortformular",
      // E-476: Quelle „meta“ (Herkunft im Auftrag: „Meta-Formular“) statt „website“.
      herkunft: { wo: "das Meta-Sofortformular (Instagram/Facebook)", quelle: "meta", autor: "Meta-Sofortformular" },
      lead: {
        kanal: "meta", antworten: globalMetaAntworten(f, fragen), formular: formularName, plattform: f.plattform,
        anzeige: roh.ad_name ?? null, kampagne: roh.campaign_name ?? null, metaLeadId: String(roh.id),
        // Nachbesserung: der echte Eingang und der Weg — ein alter Lead aus „Rückstand nachholen“ kommt nicht einzeln.
        metaErstellt: roh.created_time ?? null, weg,
      },
    });
  } catch (e) {
    await lauf`DELETE FROM fiaon_meta_leads WHERE meta_lead_id = ${String(roh.id)} AND global_anfrage_id IS NULL AND lead_id IS NULL`.catch(() => {});
    throw e;
  }
  await lauf`UPDATE fiaon_meta_leads SET global_anfrage_id = ${erg.anfrageId} WHERE meta_lead_id = ${String(roh.id)}`;
  return { status: "neu", leadId: null, globalAnfrageId: erg.anfrageId };
}

/** Einen abgerufenen Meta-Lead in die Plattform bringen. */
export async function metaLeadEinspielen(
  roh: MetaRohLead,
  // E-476 Scheibe 3: „meta_danke“ = der Danke-Knopf der Global-Formulare (/gb) — kein falscher „Webhook“-Treffer.
  weg: "meta_webhook" | "meta_nachhol" | "meta_rueckstand" | "meta_danke",
  seiteId: string | null = null,
  lauf: Lauf = sqlPool,
): Promise<EinspielErgebnis> {
  await metaTabellen(lauf);
  if (!roh?.id) return { status: "ungueltig", leadId: null, grund: "Lead ohne ID" };
  const [schon] = (await lauf`SELECT lead_id, global_anfrage_id, weg, gesehen_am FROM fiaon_meta_leads WHERE meta_lead_id = ${String(roh.id)}`) as any[];
  // Nachbesserung (Gutachten Technik, Mangel 4): eine verwaiste Beanspruchung (ohne Lead, ohne Anfrage, älter als drei Minuten)
  // ist KEINE Dublette — der Weg unten beansprucht sie neu (atomar).
  const verwaist = !!schon && !schon.lead_id && !schon.global_anfrage_id && !["meta_test", META_UNGUELTIG].includes(String(schon.weg))
    && Date.now() - new Date(schon.gesehen_am).getTime() > 3 * 60_000;
  if (schon && !verwaist) return { status: "dublette", leadId: schon.lead_id ?? null };

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
  // E-466: Global-Formular → Global-Anfrage, nie Privat-Lead (siehe „DIE WEICHE“ oben).
  const globalIds = String((await einstellung(META_GLOBAL_FORMULARE, lauf)) ?? "").split(/[\s,;]+/).filter(Boolean);
  // Zweites Zeichen: Kampagne „FIAON Global …“ — falls Meta den Formularnamen gerade nicht liefert (formularSichern fängt Fehler ab).
  const globalKampagne = /^\s*FIAON\s+Global(\b|\s|$)/i.test(String(roh.campaign_name ?? ""));
  if (istGlobalFormular(formular.name, roh.form_id, globalIds) || globalKampagne) return globalMetaLeadEinspielen(roh, f, formular.name, weg, lauf, formular.fragen);
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
    // damit der Nachhol-Lauf ihn nicht alle fünf Minuten erneut versucht (E-476: mit eigenem Weg-Wert, s. oben).
    await lauf`
      INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, erstellt_am, weg)
      VALUES (${String(roh.id)}, NULL, ${roh.form_id ?? null}, ${roh.created_time ?? null}, ${META_UNGUELTIG})
      ON CONFLICT (meta_lead_id) DO UPDATE SET weg = ${META_UNGUELTIG}
       WHERE fiaon_meta_leads.lead_id IS NULL AND fiaon_meta_leads.global_anfrage_id IS NULL`;
    return { status: "ungueltig", leadId: null, grund: erg.error };
  }
  await lauf`
    INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, erstellt_am, weg)
    VALUES (${String(roh.id)}, ${erg.id}, ${roh.form_id ?? null}, ${roh.created_time ?? null}, ${weg})
    ON CONFLICT (meta_lead_id) DO UPDATE SET lead_id = EXCLUDED.lead_id WHERE fiaon_meta_leads.lead_id IS NULL`;
  // E-408 (Scheibe 3): Hat das Formular nach dem Ja zum Anruf gefragt und er Ja gesagt → meta_kaestchen. Wirft nie.
  await anrufJaAusMetaMerken(roh, f, { leadId: erg.id, personId: erg.personId ?? null }, weg, lauf);
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
      } else if (objekt === "whatsapp_business_account" && (feld === "phone_number_quality_update" || feld === "account_update")) {
        // E-261 (29.09.2026): Qualität und Kontostand kommen sofort statt erst im 5-Min.-Takt — sobald Justin die
        // beiden Felder im Meta-App-Dashboard abonniert (Webhooks → WhatsApp Business Account). Der Stand wird
        // frisch gelesen (fiaon-wa-bremse.ts). Eine Kontosperre (ban_info DISABLE) pausiert WhatsApp sofort.
        const bremse = await import("./fiaon-wa-bremse");
        const bann = String(wert?.ban_info?.waba_ban_state ?? "").toUpperCase();
        if (feld === "account_update" && bann === "DISABLE") {
          await bremse.pausieren({
            art: "gesperrt", code: null, von: "automatisch", quelle: "webhook",
            fehler: `Meta meldet account_update ${String(wert?.event ?? "")}: WhatsApp-Konto gesperrt (waba_ban_state DISABLE${wert?.ban_info?.waba_ban_date ? `, ${String(wert.ban_info.waba_ban_date)}` : ""}).`,
          }).catch((e) => console.error("[WA-BREMSE] account_update:", e));
        }
        void bremse.metaStandAuffrischen(`webhook_${feld}`).catch((e) => console.error("[WA-BREMSE] Meta-Stand:", e));
        await lauf`
          INSERT INTO fiaon_meta_ereignisse (objekt, feld, schluessel, seite_id, nutzlast, status, verarbeitet_am)
          VALUES (${objekt}, ${feld}, NULL, ${String(eintrag?.id ?? "") || null},
                  ${lauf.json({ event: wert?.event ?? null, bann: bann || null })}, 'verarbeitet', NOW())`;
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

/**
 * Alle Formulare aller Seiten neu laden. {seite}/leadgen_forms braucht den SEITEN-Token — mit dem Systemnutzer-Token kommt
 * Fehler #190. E-490 F1: gibt dazu die Kennungen zurück, die vorher noch nicht in fiaon_meta_formulare standen.
 */
export async function formulareLaden(lauf: Lauf = sqlPool): Promise<{ seiten: number; formulare: number; neu: string[] }> {
  await metaTabellen(lauf);
  const seiten = await seitenIds(lauf);
  const bekannt = new Set(((await lauf`SELECT id FROM fiaon_meta_formulare`) as any[]).map((r) => String(r.id)));
  let n = 0;
  const neu: string[] = [];
  for (const seite of seiten) {
    const token = await seitenToken(seite);
    const liste = await graphAlle(`${seite}/leadgen_forms`, { params: { fields: "id,name,status,locale,created_time", limit: 100 }, app: "leads", token, hoechstens: 500 });
    for (const kurz of liste) {
      const f = await formularLesen(String(kurz.id), token).catch(() => kurz as MetaFormular);
      await formularSpeichern(f, seite, lauf);
      if (!bekannt.has(String(kurz.id))) { bekannt.add(String(kurz.id)); neu.push(String(kurz.id)); }
      n++;
    }
  }
  return { seiten: seiten.length, formulare: n, neu };
}

/** Die Einwilligung eines Formulars von Hand zuordnen (Steuerpult). Leer = kein Kästchen erlaubt WhatsApp. */
export async function einwilligungZuordnen(formularId: string, schluessel: string | null, lauf: Lauf = sqlPool): Promise<void> {
  await metaTabellen(lauf);
  await lauf`UPDATE fiaon_meta_formulare SET einwilligung_schluessel = ${schluessel || null}, einwilligung_von = 'hand' WHERE id = ${formularId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// NACHHOL-LAUF UND RÜCKSTAND
//
// ── E-490 F1 (09.11.2026): NEUE FORMULARE FINDET DER NACHHOL-LAUF SELBST ────
// Der Befund (Diagnose 09.11., Produktion nur gelesen): Der Webhook liefert seit dem 05.11. nichts — alle Meta-Leads der
// letzten 30 Tage kamen über diesen Lauf. Er fragte aber nur Formulare, die schon in fiaon_meta_formulare standen, und nur
// ab dem gemerkten Stand minus 10 Minuten. Ein neues Formular kam erst über die Prüfliste (alle 6 Stunden) oder den Knopf
// „Formulare neu laden“ in die Tabelle — die Leads zwischen Anlage und Laden fehlten STILL. Am 09.11. lagen so beim Tausch
// auf die Formular-Fassung 2 fast vier Stunden zwischen Anlage und Laden (von Hand; verloren ging diesmal nichts).
// Jetzt:
//   · Höchstens stündlich lädt der Lauf alle Formulare der Seiten selbst (formulareLaden mit Seiten-Token; atomar über den
//     Merker META_FORMULARE_GESUCHT — beim Deploy laden nicht zwei Prozesse).
//   · Ein Formular, dessen Leads noch nie AB SEINER ANLAGE geholt wurden (nicht in META_FORMULARE_AB_ANLAGE — egal, ob der
//     Lauf, die Prüfliste, der Knopf oder ein ankommender Lead es in die Tabelle brachte), fragt er einmal ab created_time
//     (höchstens 89 Tage zurück) — mit dem Weg „meta_nachhol“, NIE „meta_rueckstand“: Ein Rückstand-Lead bekäme weder Justins
//     Willkommen (fiaon-global-lead-post.ts, willkommenSenden) noch ein Einzel-Dossier (shared/fiaon-global-lead.ts,
//     einzelDossierFaellig). Beide verfallen ohnehin nach drei Tagen — ein alter Lead bekommt also auch so keine Mail.
//   · Erst wenn das gelingt, steht das Formular in der Liste; scheitert es, versucht es der nächste Lauf wieder.
//   · Die Grundlinie: Fehlt die Liste (erster Lauf nach dem Deploy), gelten alle Formulare, die DANN in der Tabelle stehen,
//     als nachgeholt — sie liefen bisher schon durch diesen Lauf (die Prüfliste lädt alle 6 Stunden jedes Formular der Seite).
// Für die Anleitung zum Formulartausch (liegt außerhalb des Repos): Nach dem Tausch muss niemand mehr „Formulare neu laden“
// drücken — spätestens nach einer Stunde (plus fünf Minuten) steht das neue Formular da, und seine Leads sind ab der Anlage
// geholt. Wer nicht warten will, drückt den Knopf: Dann holt der nächste Lauf (≤ 5 Minuten) die Leads ab der Anlage.
// Der Rückstand von Hand (Datum gewählt, Weg „meta_rueckstand“) bleibt, wie er war — er sucht nicht und führt die Liste nicht.
// ═══════════════════════════════════════════════════════════════════════════
let nachholLaeuft = false;

/** E-490 F1: Wann zuletzt nach neuen Formularen gesucht wurde (ISO) — höchstens alle FORMULAR_SUCHE_MIN Minuten. */
export const META_FORMULARE_GESUCHT = "meta_formulare_gesucht_am";
/** E-490 F1: Formulare, deren Leads ab der Anlage geholt sind (Komma-Liste der Kennungen). */
export const META_FORMULARE_AB_ANLAGE = "meta_formulare_ab_anlage";
export const FORMULAR_SUCHE_MIN = 60;
/** Meta hält Leads 90 Tage — gefragt wird höchstens 89 Tage zurück (wie beim Rückstand). */
export const NACHHOL_HOECHSTENS_TAGE = 89;

/** Eine Komma-Liste von Kennungen (Ziffern, Buchstaben, _-) → eindeutige Liste. Rein. */
export function kennungsListe(roh: unknown): string[] {
  return Array.from(new Set(String(roh ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{1,64}$/.test(s))));
}

/** E-490 F1: Ist die stündliche Formular-Suche fällig? Ohne (gültigen) Merker: ja. Rein. */
export function formularSucheFaellig(letzte: unknown, jetzt: Date): boolean {
  const t = Date.parse(String(letzte ?? ""));
  return !Number.isFinite(t) || jetzt.getTime() - t >= FORMULAR_SUCHE_MIN * 60_000;
}

/**
 * E-490 F1: Ab wann die Leads eines neuen Formulars geholt werden — seine Anlage (eine Minute Spielraum), höchstens 89 Tage
 * zurück. Ohne gültige Anlage: null (dann nur das normale Fenster — nie blind 89 Tage für ein Formular unbekannten Alters). Rein.
 */
export function abAnlageZeit(erstelltAm: unknown, jetzt: Date): Date | null {
  const t = erstelltAm instanceof Date ? erstelltAm.getTime() : Date.parse(String(erstelltAm ?? ""));
  if (!Number.isFinite(t)) return null;
  return new Date(Math.max(t - 60_000, jetzt.getTime() - NACHHOL_HOECHSTENS_TAGE * 86_400_000));
}

/** E-490 F1: die Liste der ab der Anlage geholten Formulare — fehlt sie, wird der heutige Bestand die Grundlinie (einmal). */
async function abAnlageListe(lauf: Lauf): Promise<Set<string>> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${META_FORMULARE_AB_ANLAGE}`) as any[];
  if (r) return new Set(kennungsListe(r.value));
  const bestand = ((await lauf`SELECT id FROM fiaon_meta_formulare`) as any[]).map((x) => String(x.id));
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${META_FORMULARE_AB_ANLAGE}, ${kennungsListe(bestand.join(",")).join(",")}, NOW())
    ON CONFLICT (key) DO NOTHING`;
  const [neu] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${META_FORMULARE_AB_ANLAGE}`) as any[];
  console.log(`[META] Formulare ab der Anlage: Grundlinie mit ${bestand.length} Formular(en) gesetzt.`);
  return new Set(kennungsListe(neu?.value));
}

/**
 * E-490 F1: höchstens stündlich alle Formulare der Seiten laden (formulareLaden, Seiten-Token) — atomar beansprucht. Wirft
 * nie: Scheitert Meta, fragt der Lauf trotzdem die bekannten Formulare (und die Suche ist in einer Stunde wieder dran).
 */
async function formulareStuendlichSuchen(lauf: Lauf, jetzt: Date): Promise<{ gesucht: boolean; neu: number; fehler: string | null }> {
  try {
    await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${META_FORMULARE_GESUCHT}, '', NOW()) ON CONFLICT (key) DO NOTHING`;
    const [m] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${META_FORMULARE_GESUCHT}`) as any[];
    const alt = String(m?.value ?? "");
    if (!formularSucheFaellig(alt, jetzt)) return { gesucht: false, neu: 0, fehler: null };
    const [frei] = (await lauf`
      UPDATE fiaon_settings SET value = ${jetzt.toISOString()}, updated_at = NOW()
       WHERE key = ${META_FORMULARE_GESUCHT} AND COALESCE(value, '') = ${alt} RETURNING key`) as any[];
    if (!frei) return { gesucht: false, neu: 0, fehler: null };
    const f = await formulareLaden(lauf);
    if (f.neu.length) console.log(`[META] ${f.neu.length} neue(s) Formular(e) gefunden: ${f.neu.join(", ")} — der Nachhol-Lauf holt ihre Leads ab der Anlage.`);
    return { gesucht: true, neu: f.neu.length, fehler: null };
  } catch (err) {
    const text = err instanceof MetaFehler ? err.klartext : err instanceof Error ? err.message : String(err);
    console.warn("[META] Formular-Suche:", text.slice(0, 200));
    return { gesucht: true, neu: 0, fehler: text.slice(0, 300) };
  }
}

/**
 * Jedes Formular nach Leads seit `seit` fragen und fehlende einspielen.
 * Ohne `seit`: ab dem gemerkten Stand (minus 10 Minuten Überlappung), beim
 * allerersten Lauf die letzten 2 Tage — und (E-490 F1) neue Formulare suchen
 * und ab ihrer Anlage fragen (siehe oben).
 */
export async function nachholLauf(opts: { seit?: Date; weg?: "meta_nachhol" | "meta_rueckstand"; hoechstens?: number; jetzt?: Date } = {}, lauf: Lauf = sqlPool): Promise<{
  formulare: number; gefunden: number; neu: number; schonDa: number; ungueltig: number; test: number; fehler: string[]; seit: string;
  /** E-490 F1: Formulare, deren Leads in diesem Lauf ab der Anlage geholt wurden (Anzahl und Kennungen). */
  abAnlage: number; abAnlageFormulare: string[];
  /** E-490 F1: Lief die stündliche Formular-Suche, und was fand sie? (fehlt beim Rückstand von Hand) */
  suche: { gesucht: boolean; neu: number; fehler: string | null } | null;
}> {
  const leer = { formulare: 0, gefunden: 0, neu: 0, schonDa: 0, ungueltig: 0, test: 0, fehler: [] as string[], seit: "", abAnlage: 0, abAnlageFormulare: [] as string[], suche: null };
  if (nachholLaeuft) return { ...leer, fehler: ["Ein Nachhol-Lauf läuft bereits."] };
  if (!metaKonfig().bereit) return { ...leer, fehler: ["Meta-Zugang fehlt noch."] };
  nachholLaeuft = true;
  try {
    await metaTabellen(lauf);
    const jetzt = opts.jetzt ?? new Date();
    const regulaer = !opts.seit;
    // E-490 F1: erst die Grundlinie (vor der Suche — sonst gälte ein eben gefundenes Formular als längst nachgeholt), dann suchen.
    const abAnlage = regulaer ? await abAnlageListe(lauf) : null;
    const suche = regulaer ? await formulareStuendlichSuchen(lauf, jetzt) : null;
    const gemerkt = await einstellung(META_NACHHOL_BIS, lauf);
    const neunzig = new Date(jetzt.getTime() - NACHHOL_HOECHSTENS_TAGE * 86_400_000);
    let seit = opts.seit ?? (gemerkt ? new Date(new Date(gemerkt).getTime() - 10 * 60_000) : new Date(jetzt.getTime() - 2 * 86_400_000));
    if (seit < neunzig) seit = neunzig;
    const ab = Math.floor(seit.getTime() / 1000);
    const formulare = (await lauf`
      SELECT id, seite_id, erstellt_am FROM fiaon_meta_formulare
       WHERE status IS NULL OR UPPER(status) IN ('ACTIVE', 'ARCHIVED') OR ${!!opts.seit}
       ORDER BY geladen_am DESC`) as any[];
    const erg = { ...leer, formulare: formulare.length, seit: seit.toISOString(), suche };
    let juengster = gemerkt ? new Date(gemerkt).getTime() : 0;
    const startLauf = Date.now();
    for (const f of formulare) {
      // E-490 F1: Ein Formular, dessen Leads noch nie ab der Anlage geholt wurden, fragt dieser Lauf ab created_time.
      const neuesFormular = !!abAnlage && !abAnlage.has(String(f.id));
      const seitAnlage = neuesFormular ? abAnlageZeit(f.erstellt_am, jetzt) : null;
      const abF = seitAnlage && seitAnlage.getTime() < seit.getTime() ? Math.floor(seitAnlage.getTime() / 1000) : ab;
      try {
        const token = f.seite_id ? await seitenToken(String(f.seite_id)) : undefined;
        const leads = await graphAlle(`${f.id}/leads`, {
          params: { fields: LEAD_FELDER, limit: 100, filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: abF }]) },
          app: "leads", token, hoechstens: opts.hoechstens ?? 2000,
        });
        erg.gefunden += leads.length;
        for (const roh of leads) {
          // Auch die Leads ab der Anlage laufen als „meta_nachhol“ (nie „meta_rueckstand“ — siehe oben).
          const e = await metaLeadEinspielen(roh, opts.weg ?? "meta_nachhol", f.seite_id ?? null, lauf);
          if (e.status === "neu") erg.neu++; else if (e.status === "dublette") erg.schonDa++; else if (e.status === "test") erg.test++; else erg.ungueltig++;
          const t = Date.parse(String(roh.created_time ?? ""));
          if (!Number.isNaN(t) && t > juengster) juengster = t;
        }
        if (neuesFormular) {
          abAnlage!.add(String(f.id));
          erg.abAnlageFormulare.push(String(f.id));
        }
      } catch (err) {
        erg.fehler.push(`Formular ${f.id}: ${err instanceof MetaFehler ? err.klartext : err instanceof Error ? err.message : String(err)}`);
      }
    }
    erg.abAnlage = erg.abAnlageFormulare.length;
    if (erg.abAnlage) {
      // Anhängen statt ersetzen (atomar) — ein zweiter Prozess verliert so keine Kennung; doppelte entfernt kennungsListe.
      await lauf`
        UPDATE fiaon_settings SET value = CONCAT_WS(',', NULLIF(value, ''), ${erg.abAnlageFormulare.join(",")}::text), updated_at = NOW()
         WHERE key = ${META_FORMULARE_AB_ANLAGE}`;
      console.log(`[META] Leads ab der Anlage geholt: Formular ${erg.abAnlageFormulare.join(", ")}.`);
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
// E-490 F5 (09.11.2026): WELCHES FORMULAR NUTZEN DIE LAUFENDEN ANZEIGEN?
//
// Der Wächter „Lead-Kette“ (fiaon-lead-takt.ts) fragte bisher: Kamen die letzten drei Meta-Leads (24 Stunden) alle über ein
// Formular OHNE WhatsApp-Satz? Diese Regel kannte den Tausch auf die Formular-Fassung 2 nicht — nach jedem Tausch stand sie
// bis zu 24 Stunden gelb, obwohl längst die neue Fassung lief (am 09.11. noch Stunden nach dem Tausch). Jetzt fragt sie Meta
// direkt, wie der Kostenabruf (Werbekonto aus META_WERBEKONTO bzw. der Einstellung meta_werbekonto, nur GET): die Anzeigen
// mit effective_status ACTIVE, IN_PROCESS, PENDING_REVIEW oder WITH_ISSUES und je Anzeige die Formular-Kennungen
// (lead_gen_form_id) aus dem Motiv (object_story_spec und asset_feed_spec). Nutzt eine davon ein Global-Formular ohne
// Fassung-2-Namen und ohne „WhatsApp“ im Namen, steht die Anzeige mit ihrem NAMEN im gelben Alarm. Höchstens stündlich
// (Zwischenspeicher ANZEIGEN_FORMULARE_STAND). Scheitert Meta: keine Aussage — nie ein Alarm aus einer Vermutung.
// ═══════════════════════════════════════════════════════════════════════════
export const ANZEIGEN_FORMULARE_STAND = "meta_anzeigen_formulare_stand";
/** Diese Anzeigen laufen (oder gehen gleich live) — nur sie zählen. */
export const ANZEIGEN_LAUFEND = ["ACTIVE", "IN_PROCESS", "PENDING_REVIEW", "WITH_ISSUES"] as const;
export const ANZEIGEN_ABFRAGE_MIN = 60;

/** Alle Formular-Kennungen (lead_gen_form_id) in einem Anzeigen-Motiv — wo auch immer Meta sie ablegt (rekursiv, begrenzt). Rein. */
export function formularIdsAusMotiv(motiv: unknown): string[] {
  const ids = new Set<string>();
  const gehe = (x: unknown, tiefe: number) => {
    if (!x || typeof x !== "object" || tiefe > 8) return;
    if (Array.isArray(x)) { for (const y of x.slice(0, 200)) gehe(y, tiefe + 1); return; }
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (k === "lead_gen_form_id" && (typeof v === "string" || typeof v === "number") && /^\d{3,25}$/.test(String(v))) ids.add(String(v));
      else gehe(v, tiefe + 1);
    }
  };
  gehe(motiv, 0);
  return Array.from(ids);
}

/** Hat ein Formular den WhatsApp-Satz? Name der Fassung 2 oder „WhatsApp“ im Namen — dieselbe Regel wie Takt und Wächter. Rein. */
export function formularMitWaSatz(name: string | null | undefined, waNamen: readonly string[]): boolean {
  const n = String(name ?? "").trim();
  return /whats\s*app/i.test(n) || waNamen.some((w) => String(w).trim() === n);
}

export interface AlteFassungAnzeige { anzeigeId: string; anzeige: string; formularId: string; formular: string }

/**
 * Die laufenden Anzeigen, die ein Global-Formular OHNE WhatsApp-Satz nutzen (alte Fassung). Ein Formular ohne bekannten Namen
 * zählt nicht (über es gibt es keine Aussage). Rein.
 */
export function alteFassungAnzeigen(
  anzeigen: readonly { id?: unknown; name?: unknown; effective_status?: unknown; creative?: unknown }[],
  formulare: ReadonlyMap<string, string | null>,
  opt: { globalIds?: readonly string[]; waNamen: readonly string[] },
): AlteFassungAnzeige[] {
  const laufend = new Set<string>(ANZEIGEN_LAUFEND);
  const aus: AlteFassungAnzeige[] = [];
  for (const a of anzeigen) {
    if (!laufend.has(String(a?.effective_status ?? "").toUpperCase())) continue;
    for (const id of formularIdsAusMotiv(a?.creative)) {
      const name = formulare.get(id);
      if (!name || !istGlobalFormular(name, id, opt.globalIds ?? []) || formularMitWaSatz(name, opt.waNamen)) continue;
      aus.push({ anzeigeId: String(a?.id ?? ""), anzeige: String(a?.name ?? "").trim() || `Anzeige ${String(a?.id ?? "?")}`, formularId: id, formular: name });
    }
  }
  return aus;
}

export interface AnzeigenFormularStand { am: string; ok: boolean; anzeigen: number; alt: AlteFassungAnzeige[]; fehler: string | null }

/** Der Zwischenspeicher (JSON in fiaon_settings) — null, wenn keiner da oder unlesbar. Rein. */
export function anzeigenStandLesen(roh: unknown): AnzeigenFormularStand | null {
  try {
    const o = JSON.parse(String(roh ?? ""));
    if (!o || typeof o !== "object" || !Number.isFinite(Date.parse(String(o.am)))) return null;
    const alt = (Array.isArray(o.alt) ? o.alt : []).filter((x: any) => x && typeof x === "object").map((x: any) => ({
      anzeigeId: String(x.anzeigeId ?? ""), anzeige: String(x.anzeige ?? ""), formularId: String(x.formularId ?? ""), formular: String(x.formular ?? ""),
    }));
    return { am: String(o.am), ok: o.ok === true, anzeigen: Number(o.anzeigen) || 0, alt, fehler: o.fehler ? String(o.fehler) : null };
  } catch { return null; }
}

/** Die Namen zu Formular-Kennungen: aus fiaon_meta_formulare; ein unbekanntes wird geladen wie beim Eingang (Seiten-Token). */
async function formularNamen(ids: readonly string[], lauf: Lauf): Promise<Map<string, string | null>> {
  const namen = new Map<string, string | null>();
  if (!ids.length) return namen;
  for (const z of (await lauf`SELECT id, name FROM fiaon_meta_formulare WHERE id = ANY(${ids as string[]})`) as any[]) namen.set(String(z.id), z.name ?? null);
  const seite = (await seitenIds(lauf))[0] ?? null;
  for (const id of ids.filter((i) => !namen.has(i)).slice(0, 10)) {
    const f = await formularSichern(id, seite, lauf);
    if (f.name) namen.set(id, f.name);
  }
  return namen;
}

/**
 * E-490 F5: Welche laufenden Anzeigen nutzen noch die alte Formular-Fassung (Global-Formular ohne WhatsApp-Satz)? Höchstens
 * stündlich gefragt (Zwischenspeicher), nur GET. `waNamen` = die Namen der Fassung 2 (waFormularNamen). null = keine Aussage
 * (kein Meta-Zugang, kein Werbekonto, Meta-Fehler). Wirft nie.
 */
export async function alteFassungInAnzeigen(lauf: Lauf = sqlPool, opt: { jetzt?: Date; waNamen: readonly string[]; immer?: boolean }): Promise<AlteFassungAnzeige[] | null> {
  const jetzt = opt.jetzt ?? new Date();
  try {
    const [m] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${ANZEIGEN_FORMULARE_STAND}`.catch(() => [])) as any[];
    const stand = anzeigenStandLesen(m?.value);
    if (stand && !opt.immer && jetzt.getTime() - Date.parse(stand.am) < ANZEIGEN_ABFRAGE_MIN * 60_000) return stand.ok ? stand.alt : null;
    if (!metaKonfig().bereit) return null;
    const { gespeicherteWerbekonten } = await import("./fiaon-meta-kosten");
    const konten = await gespeicherteWerbekonten(lauf);
    if (!konten.length) return null;
    let neu: AnzeigenFormularStand;
    try {
      const anzeigen: any[] = [];
      for (const konto of konten) {
        anzeigen.push(...(await graphAlle(`${konto}/ads`, {
          params: { fields: "id,name,effective_status,creative{object_story_spec,asset_feed_spec}", effective_status: JSON.stringify(ANZEIGEN_LAUFEND), limit: 100 },
          hoechstens: 1000, zeitMs: 30_000,
        })));
      }
      const namen = await formularNamen(Array.from(new Set(anzeigen.flatMap((a) => formularIdsAusMotiv(a?.creative)))), lauf);
      const globalIds = kennungsListe(await einstellung(META_GLOBAL_FORMULARE, lauf));
      neu = { am: jetzt.toISOString(), ok: true, anzeigen: anzeigen.length, alt: alteFassungAnzeigen(anzeigen, namen, { globalIds, waNamen: opt.waNamen }), fehler: null };
    } catch (err) {
      const text = err instanceof MetaFehler ? err.klartext : err instanceof Error ? err.message : String(err);
      console.warn("[META] Anzeigen-Formulare nicht lesbar:", text.slice(0, 200));
      neu = { am: jetzt.toISOString(), ok: false, anzeigen: 0, alt: [], fehler: text.slice(0, 300) };
    }
    await einstellungSetzen(ANZEIGEN_FORMULARE_STAND, JSON.stringify(neu), lauf).catch(() => {});
    return neu.ok ? neu.alt : null;
  } catch (e) {
    console.warn("[META] Anzeigen-Formulare:", String((e as Error)?.message ?? e).slice(0, 200));
    return null;
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
    // E-397 (19.10.2026): kein Auftrag mehr je Tag (lead-motor:<art>:<Tag>, 41 offen am 19.10., obwohl die Leads
    // normal ankamen), sondern EINE Zeile in der Alarm-Tafel (Ampel im Lagezimmer) mit festem Schlüssel.
    // Ein Prüfstand kann weiter einen Zähler einhängen (opts.aufgabe).
    if (opts.aufgabe) {
      if (Number(z?.zaehler) === 1) {
        await opts.aufgabe(`lead-motor:${art}`, {
          titel: `Lead-Motor: ${text.split(" — ")[0]}`, text, bereich: "vertrieb", prioritaet: 1, link: "/chef/s/lead-motor", quelle: "lead-motor",
        }).catch((e) => console.error("[LEAD-MOTOR] Aufgabe:", e));
      }
    } else {
      const { alarmMelden } = await import("./fiaon-system-alarme");
      await alarmMelden(`lead-motor:${art}`, { quelle: "lead-motor", titel: `Lead-Motor: ${text.split(" — ")[0]}`, text, stufe: "rot", link: "/chef/s/lead-motor" }, lauf);
    }
  } else {
    const r = (await lauf`UPDATE fiaon_meta_alarme SET erledigt_am = NOW() WHERE art = ${art} AND erledigt_am IS NULL RETURNING art`) as any[];
    // E-397: Der Alarm ist vorbei — die Zeile in der Tafel geht aus, und die alten Tages-Aufträge dieses Alarms
    // (lead-motor:<art>:<Tag>) schließen mit „Alarm vorbei“ — auch der Altbestand ohne offene Meta-Zeile.
    if (!opts.aufgabe) {
      const { alarmVorbei } = await import("./fiaon-system-alarme");
      await alarmVorbei(`lead-motor:${art}`, r.length ? "Leads kommen wieder an" : "kein Alarm mehr", lauf,
        { auftraege: { quelle: "lead-motor", schluesselWie: `lead-motor:${art}:%` } });
    }
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
  // E-476 Scheibe 5 (05.11.2026, Gutachten 0, Mangel 22): Seit dem 20.10. ist das ein BEKANNTER Zustand. Das alte 3-Stunden-
  // Fenster ging jede Nacht aus und jeden Morgen wieder an (Lagezimmer täglich rot). Jetzt
  // meldet webhookStilleWaechter (unten) EINMAL, gelb, und erst wieder, nachdem der Webhook einmal geliefert hat.
  const webhookStumm = await webhookStilleWaechter(lauf);
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
  // dort die drei Stellen, an denen man den Webhook bei Meta selbst sieht (WEBHOOK_STILL_TEXT, unten).
  // ══════════════════════════════════════════════════════════════════════
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

/** Der Merker des bekannten Zustands „Webhook still“ (seit wann; leer = der Webhook liefert). */
export const WEBHOOK_STILL_MERKER = LEAD_TAKT_SCHLUESSEL.webhookStill;
/** Was der Alarm sagt — mit den drei Stellen, an denen man den Webhook bei Meta selbst sieht (E-226/E-244). */
export const WEBHOOK_STILL_TEXT =
  "Der Webhook meldet keine Leads (bekannter Zustand) — der Nachhol-Lauf fängt jeden Lead nach spätestens 5 Minuten auf, es geht also nichts verloren. "
  + "Diese Meldung kommt einmal — und erst wieder, nachdem der Webhook einmal geliefert hat. "
  + "Adresse und Token stimmen: Über dieselbe Adresse kommen WhatsApp-Ereignisse an. "
  + "Prüfen: 1. developers.facebook.com/tools/lead-ads-testing → Seite FIAON → Formular → „Lead erstellen“ — kommt die Meldung, springt hier die Kopfzeile auf „Webhook bestätigt“ "
  + "(der Test-Lead wird erkannt: kein Kunde, keine Zuteilung, keine Mail). "
  + "2. App-Dashboard → Webhooks → Objekt „Page“: Feld „leadgen“ abonniert, Adresse wie unten unter „Verbindung zu Meta“. "
  + "3. Seite FIAON → Einstellungen → Integrationen → Leadzugriff: Die App „FIAON Ltd.“ ist zugelassen.";

/**
 * E-476 Scheibe 5 (Gutachten 0, Mangel 22): „Meta-Webhook still“ als BEKANNTER Zustand — nicht täglich melden.
 *   · 24 Stunden Fenster (statt 3): Nachts ohne Leads ändert sich nichts — der Zustand bleibt, wie er ist.
 *   · Kamen Leads nur über den Nachhol-Lauf und ist der Zustand noch nicht bekannt: Merker setzen (atomar) und EINMAL
 *     melden — im Lead-Motor (fiaon_meta_alarme, bis „Erledigt“) und gelb im Lagezimmer (geht nach 24 Stunden von selbst
 *     aus). Danach keine neue Meldung, auch nicht nach „Erledigt“.
 *   · Liefert der Webhook wieder (ein Lead über meta_webhook in 24 Stunden): Merker leer, beide Meldungen aus. Fällt er
 *     später wieder aus, gibt es genau eine neue Meldung.
 * `true` = der Zustand besteht.
 */
export async function webhookStilleWaechter(lauf: Lauf = sqlPool): Promise<boolean> {
  const [w] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE weg = 'meta_webhook')::int AS webhook,
           COUNT(*) FILTER (WHERE weg = 'meta_nachhol')::int AS nachhol
      FROM fiaon_meta_leads WHERE gesehen_am > NOW() - INTERVAL '24 hours'`) as any[];
  const [m] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${WEBHOOK_STILL_MERKER}`.catch(() => [])) as any[];
  const seit = String(m?.value ?? "").trim();
  const { alarmMelden, alarmVorbei } = await import("./fiaon-system-alarme");
  if (Number(w?.webhook || 0) > 0) {
    if (seit) await lauf`UPDATE fiaon_settings SET value = '', updated_at = NOW() WHERE key = ${WEBHOOK_STILL_MERKER}`;
    await lauf`UPDATE fiaon_meta_alarme SET erledigt_am = NOW() WHERE art = 'webhook' AND erledigt_am IS NULL`;
    await alarmVorbei("lead-motor:webhook", "der Webhook liefert wieder Leads", lauf, { auftraege: { quelle: "lead-motor", schluesselWie: "lead-motor:webhook:%" } });
    return false;
  }
  if (Number(w?.nachhol || 0) < 1) return !!seit;
  if (seit) return true;
  await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${WEBHOOK_STILL_MERKER}, '', NOW()) ON CONFLICT (key) DO NOTHING`;
  const [frei] = (await lauf`
    UPDATE fiaon_settings SET value = ${new Date().toISOString()}, updated_at = NOW()
     WHERE key = ${WEBHOOK_STILL_MERKER} AND COALESCE(value, '') = '' RETURNING key`) as any[];
  if (!frei) return true;
  await lauf`
    INSERT INTO fiaon_meta_alarme (art, text) VALUES ('webhook', ${WEBHOOK_STILL_TEXT})
    ON CONFLICT (art) DO UPDATE SET text = EXCLUDED.text, zuletzt_am = NOW(), zaehler = 1, erstellt_am = NOW(), erledigt_am = NULL`;
  await alarmMelden("lead-motor:webhook", {
    quelle: "lead-motor", titel: "Lead-Motor: Meta-Webhook still (bekannter Zustand) — der Nachhol-Lauf fängt alles auf", text: WEBHOOK_STILL_TEXT,
    stufe: "gelb", link: "/chef/s/lead-motor", endetNachStunden: 24, neueEpisode: true,
  }, lauf);
  console.warn("[LEAD-MOTOR] Meta-Webhook still — einmal gemeldet (bekannter Zustand).");
  return true;
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
