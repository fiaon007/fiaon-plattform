// ═══════════════════════════════════════════════════════════════════════════
// MARA BUSINESS AUF WHATSAPP — DER SERVER (E-481, 05.11.2026)
//
// Regeln, Stimme und Wand: shared/fiaon-mara-business.ts. Hier: wer ein Business-Kontakt ist, was Mara ihm antwortet,
// und der Takt (Begrüßung, Termin, Erinnerung, „nicht erreicht“, eine Nachfrage).
//
// ── DER BEFUND (05.11.2026, Produktion nur gelesen) ───────────────────────
// Schrieb ein Business-Lead Mara auf WhatsApp, wurde seine Nummer ein PRIVAT-Lead (leadAusEingang → processIntake), und
// Mara pitchte ihm die Kreditkarte. Jetzt: Eine Nummer mit offener Global-Anfrage (60 Tage, nicht Privat-Weg), eine
// Nachricht mit Anfrage-Kennung oder mit „FIAON Global“ wird nie ein Privat-Lead (businessEingang) und bekommt Mara
// Business (maraBusinessAntwortet, Haken in fiaon-whatsapp-mara.ts nach STOPP/Fenster, vor allem Privaten).
//
// ── WER NICHT ─────────────────────────────────────────────────────────────
// · Global-Kunden mit Vertrag: E-272 bleibt (Mara schweigt, Karte an Justin) — der Haken sitzt NACH dieser Regel.
// · Zahlende Privatkunden: Privat-Mara wie bisher (dieselbe Regel wie die Mara-Weiche 0c, E-476).
// · Lead-Mails: schreibt Justin aus js@ (E-476). Mara schreibt nie Mails an Leads.
//
// Vorlagen gehen erst raus, wenn Meta sie freigegeben hat (vorlageNutzbar). Alles über waSenden (Bremse, Sperren).
//
// ── E-487 (09.11.2026, Justin: „ALLES … WhatsApp — nichts darf still hängen“) ──
// · Nummern aus Formularen mit dem Land (anfrageNummer → formularNummer): „15…“ ist nie eine +1-Nummer.
// · Das Ja findet seine Anfrage: Website-Ja mit anfrage_id, der Takt verknüpft offene Ja-Zeilen über die letzten neun
//   Ziffern (falsch gelesene ziehen um), das Ja am Telefon aus dem Cockpit (telefonOptinMerken: wer, wann, welcher Satz).
// · Ja + Termin → die Terminnachricht (fiaon_gl_termin) und am Vortag die Erinnerung (fiaon_gl_erinnerung) — Bedingung
//   optin_am statt nur Weg „whatsapp“. Die Begrüßung prüft nur Anfragen MIT Ja und OHNE Begrüßung, die neuesten zuerst.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { waSenden, fensterOffen, freigegebeneVorlagen, waKonfig } from "./fiaon-whatsapp";
import { waKanonisch, formularNummer, waJaNummer, nummerKey9, GLOBAL_WA_TELEFON_SATZ } from "@shared/fiaon-whatsapp-erlaubnis";
import { vorlageNutzbar } from "@shared/fiaon-lead-texte";
import {
  MB_DIENST, MB_VON, MB_SCHEMA, businessAuftrag, businessWand, knopfAktion, kennungAusText, istGlobalEinstieg, vorstellungVoran,
  satzWegMail, satzWegWhatsapp, satzTelefon, satzSpaeter, satzPasst, satzGebucht, satzUebergabe, istGespraechsweg, WEG_TEXT,
  waGlobalLink, type Gespraechsweg,
} from "@shared/fiaon-mara-business";
import { antwortZeile, type LeadAntwort } from "@shared/fiaon-global-lead";
import { imVersandfenster, berlinMinuten } from "@shared/fiaon-nicht-erreicht-nachfass";
import { berlinHeuteIso } from "@shared/fiaon-geburtsdatum";

type Lauf = typeof sqlPool;

// ── Einstellungen (fiaon_settings) — Justin 05.11.2026: „alles an“ ─────────
export const MB_SCHLUESSEL = {
  /** Mara Business antwortet Business-Leads auf WhatsApp. */
  an: "mara_business_an",
  /** Der Takt (Begrüßung, Termin, Erinnerung, nicht erreicht, Nachfrage). */
  taktAn: "wa_global_takt_an",
  /** Zählbeginn: Begrüßung nur für Anfragen danach (beim ersten Lauf gesetzt — Alt-Leads bekommen nichts). */
  ab: "wa_global_ab",
  /** Hausanweisung für Mara Business (Steuerpult). */
  anweisung: "mara_business_anweisung",
  /** Die Nummer für den wa.me-Link (leer = WHATSAPP_NUMMER) — für die eigene Nummer „FIAON Global“ (Entscheidung 4). */
  nummer: "wa_global_nummer",
} as const;

const istAn = (v: unknown, vorgabe = true) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return vorgabe;
  return /^(1|an|true|ja|on)$/.test(s);
};

async function einstellung(key: string, lauf: Lauf = sqlPool): Promise<string | null> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${key} LIMIT 1`.catch(() => [])) as any[];
  return r ? String(r.value ?? "") : null;
}
async function einstellungSetzen(key: string, wert: string, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}
export async function mbAn(lauf: Lauf = sqlPool): Promise<boolean> { return istAn(await einstellung(MB_SCHLUESSEL.an, lauf)); }
/** E-487: Ist der WhatsApp-Takt an (Begrüßung, Termin, Erinnerung …)? Für den Lead-Wächter „Lead-Kette“. */
export async function mbTaktAn(lauf: Lauf = sqlPool): Promise<boolean> { return istAn(await einstellung(MB_SCHLUESSEL.taktAn, lauf)); }
/** E-487: der Zählbeginn der Begrüßung (wa_global_ab) — null, solange der Takt nie lief. */
export async function mbTaktAb(lauf: Lauf = sqlPool): Promise<Date | null> {
  const ab = String((await einstellung(MB_SCHLUESSEL.ab, lauf)) ?? "").trim();
  return ab && Number.isFinite(Date.parse(ab)) ? new Date(ab) : null;
}

/** Die Mara-Nummer für den wa.me-Link (Lead-Mail, Website). */
export async function mbNummer(lauf: Lauf = sqlPool): Promise<string | null> {
  const eigen = String((await einstellung(MB_SCHLUESSEL.nummer, lauf)) ?? "").trim();
  return eigen || waKonfig().nummer || null;
}
/** Der WhatsApp-Link mit Kennung für eine Anfrage — null ohne Nummer. */
export async function mbWaLink(code: string | null, sprache: "de" | "en" = "de", lauf: Lauf = sqlPool): Promise<string | null> {
  return waGlobalLink(await mbNummer(lauf), code, sprache);
}

// ── Speicher: eine Zeile je Nummer ─────────────────────────────────────────
let schema: Promise<void> | null = null;
export function mbSchema(lauf: Lauf = sqlPool): Promise<void> {
  if (!schema) {
    schema = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_wa_global (
          nummer TEXT PRIMARY KEY,
          anfrage_id INTEGER,
          firma_id INTEGER,
          weg TEXT,
          weg_am TIMESTAMPTZ,
          weg_quelle TEXT,
          optin_am TIMESTAMPTZ,
          optin_quelle TEXT,
          willkommen_am TIMESTAMPTZ,
          willkommen_status TEXT,
          termin_gemeldet_id INTEGER,
          erinnert_id INTEGER,
          nicht_erreicht_id INTEGER,
          nachfrage_am TIMESTAMPTZ,
          spaeter_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_wa_global_anfrage_idx ON fiaon_wa_global (anfrage_id)`;
      // E-487 (09.11.2026): der Satz, zu dem er Ja gesagt hat (Website-Hinweis oder der am Telefon vorgelesene Satz) —
      // zusammen mit optin_am (wann) und optin_quelle (wo, „telefon:<Name>“ = wer) der Nachweis des Jas. Scheitert die Spalte
      // (Sperre), läuft alles andere weiter — die DDL-Wache holt sie nach, zeileMerken schreibt so lange ohne den Satz.
      await lauf`ALTER TABLE fiaon_wa_global ADD COLUMN IF NOT EXISTS optin_text TEXT`
        .catch((e: unknown) => console.error("[MARA-BUSINESS] Spalte optin_text:", String((e as Error)?.message ?? e).slice(0, 160)));
    })().catch((e) => { schema = null; throw e; });
  }
  return schema;
}

/**
 * Zeile anlegen oder ergänzen (nur leere Felder werden gefüllt — das erste Ja bleibt stehen). E-487: `optinAm` übernimmt die
 * Zeit eines früheren Jas (Verknüpfen einer falsch gelesenen Zeile), `optinText` den Satz, zu dem er Ja gesagt hat.
 */
async function zeileMerken(nummer: string, w: {
  anfrageId?: number | null; firmaId?: number | null; optinQuelle?: string | null; optinAm?: Date | null; optinText?: string | null;
}, lauf: Lauf = sqlPool): Promise<void> {
  await mbSchema(lauf);
  const optinAm = w.optinQuelle ? (w.optinAm ?? new Date()) : null;
  const optinText = w.optinQuelle ? (w.optinText ?? null) : null;
  try {
    await lauf`
      INSERT INTO fiaon_wa_global (nummer, anfrage_id, firma_id, optin_am, optin_quelle, optin_text)
      VALUES (${nummer}, ${w.anfrageId ?? null}, ${w.firmaId ?? null}, ${optinAm}, ${w.optinQuelle ?? null}, ${optinText})
      ON CONFLICT (nummer) DO UPDATE SET
        anfrage_id = COALESCE(fiaon_wa_global.anfrage_id, EXCLUDED.anfrage_id),
        firma_id = COALESCE(fiaon_wa_global.firma_id, EXCLUDED.firma_id),
        optin_text = CASE WHEN fiaon_wa_global.optin_am IS NULL THEN EXCLUDED.optin_text ELSE fiaon_wa_global.optin_text END,
        optin_am = COALESCE(fiaon_wa_global.optin_am, EXCLUDED.optin_am),
        optin_quelle = COALESCE(fiaon_wa_global.optin_quelle, EXCLUDED.optin_quelle),
        updated_at = NOW()`;
  } catch (e: any) {
    if (String(e?.code) !== "42703") throw e;
    // Die Spalte optin_text fehlt noch (die DDL-Wache holt sie nach) — das Ja zählt trotzdem.
    await lauf`
      INSERT INTO fiaon_wa_global (nummer, anfrage_id, firma_id, optin_am, optin_quelle)
      VALUES (${nummer}, ${w.anfrageId ?? null}, ${w.firmaId ?? null}, ${optinAm}, ${w.optinQuelle ?? null})
      ON CONFLICT (nummer) DO UPDATE SET
        anfrage_id = COALESCE(fiaon_wa_global.anfrage_id, EXCLUDED.anfrage_id),
        firma_id = COALESCE(fiaon_wa_global.firma_id, EXCLUDED.firma_id),
        optin_am = COALESCE(fiaon_wa_global.optin_am, EXCLUDED.optin_am),
        optin_quelle = COALESCE(fiaon_wa_global.optin_quelle, EXCLUDED.optin_quelle),
        updated_at = NOW()`;
  }
}

/**
 * Die WhatsApp-Nummer einer Anfrage (Handy, WhatsApp-fähig) — null bei Festnetz oder Unsinn. E-487 (09.11.2026): Die Nummer
 * kommt aus einem FORMULAR und wird mit dem Land gelesen (formularNummer): „15…“ ohne 0 und ohne +49 ist eine deutsche
 * Handynummer, nie eine +1-Nummer (Befund 09.11.: die Ja-Zeile einer Buchung). Nur eine Anfrage, die aus WhatsApp kam
 * (`ausWhatsapp`), trägt schon die fertige WhatsApp-Nummer — die bleibt, wie sie ist (waKanonisch).
 */
export function anfrageNummer(telefon: unknown, land?: string | null, opt: { ausWhatsapp?: boolean } = {}): string | null {
  const n = opt.ausWhatsapp ? waKanonisch(telefon) : formularNummer(telefon, land);
  if (!n) return null;
  // Festnetz kann kein WhatsApp (DE 1x, AT 6x, CH 7x sind Handys; andere Länder lassen wir durch — Meta lehnt sonst ab).
  if (n.startsWith("49")) return /^491[5-7]/.test(n) ? n : null;
  if (n.startsWith("43")) return /^436/.test(n) ? n : null;
  if (n.startsWith("41")) return /^417[5-9]/.test(n) ? n : null;
  return n;
}

// ── Wer ist ein Business-Kontakt? ──────────────────────────────────────────
export interface BusinessKontakt {
  nummer: string;
  anfrageId: number | null;
  firmaId: number | null;
  anrede: string | null;
  name: string;
  firma: string;
  email: string;
  telefon: string;
  code: string | null;
  link: string | null;
  weg: Gespraechsweg | null;
  englisch: boolean;
  optin: boolean;
  antworten: string[];
}

async function zahlenderPrivatkunde(nummer: string, personId: number | null, lauf: Lauf): Promise<boolean> {
  const k9 = nummer.slice(-9);
  const { produktkategorieSql } = await import("./fiaon-produktkategorie");
  const [z] = (await lauf.unsafe(`
    SELECT 1 AS ja FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.merged_into IS NULL AND a.payment_status = 'paid' AND ${produktkategorieSql("a")} <> 'global'
       AND ((p.id IS NOT NULL AND (p.phone_key9 = $1 OR RIGHT(REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) = $1))
         OR ($2::int IS NOT NULL AND a.person_id = $2::int))
     LIMIT 1`, [k9, personId])) as any[];
  return !!z;
}

/**
 * Ist diese Nummer ein Business-Kontakt (offene Global-Anfrage oder schon als Business gemerkt)? null = nein (dann gilt
 * alles wie bisher). Global-Kunden mit Vertrag erreichen diese Stelle nicht (E-272 sitzt davor). Wirft nie.
 */
export async function businessKontakt(nummerRoh: string, personId: number | null, lauf: Lauf = sqlPool): Promise<BusinessKontakt | null> {
  try {
    const nummer = waKanonisch(nummerRoh);
    if (!nummer) return null;
    await mbSchema(lauf);
    const [z] = (await lauf`SELECT * FROM fiaon_wa_global WHERE nummer = ${nummer}`) as any[];
    const { offeneAnfrageFuer, leadCodeSichern } = await import("./fiaon-lead-weg");
    let anfrageId: number | null = z?.anfrage_id ? Number(z.anfrage_id) : null;
    if (anfrageId) {
      const [ok] = (await lauf`SELECT 1 AS ja FROM fiaon_anfragen WHERE id = ${anfrageId} AND art = 'global' AND COALESCE(status, '') <> 'privat' AND NOT COALESCE(ist_test, FALSE)`) as any[];
      if (!ok) anfrageId = null;
    }
    if (!anfrageId) anfrageId = (await offeneAnfrageFuer(null, nummer, lauf))?.anfrageId ?? null;
    if (!anfrageId && !z) return null;
    if (await zahlenderPrivatkunde(nummer, personId, lauf)) return null;
    let a: any = null;
    if (anfrageId) [a] = (await lauf`SELECT id, name, firma, email, telefon, text FROM fiaon_anfragen WHERE id = ${anfrageId}`) as any[];
    const link = anfrageId ? await leadCodeSichern(anfrageId, { lauf }).catch(() => null) : null;
    const [d] = anfrageId ? (await lauf`SELECT antworten, firma_id FROM fiaon_lead_dossier WHERE anfrage_id = ${anfrageId} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[] : [];
    const roh = Array.isArray(d?.antworten) ? d.antworten : (typeof d?.antworten === "string" ? (() => { try { return JSON.parse(d.antworten); } catch { return []; } })() : []);
    const antworten = (roh as LeadAntwort[]).filter((x) => x && x.frage && x.antwort).map((x) => antwortZeile(x));
    const name = String(a?.name ?? "").trim();
    const { leadAnredeZeile } = await import("@shared/fiaon-global-lead-texte");
    const anredeZeile = name ? leadAnredeZeile(name, "de") : "";
    const anrede = anredeZeile ? anredeZeile.replace(/^Guten Tag\s*/i, "").replace(/,\s*$/, "").trim() || null : null;
    if (anfrageId && !z) await zeileMerken(nummer, { anfrageId, firmaId: d?.firma_id ? Number(d.firma_id) : null }, lauf).catch(() => {});
    return {
      nummer, anfrageId, firmaId: z?.firma_id ? Number(z.firma_id) : (d?.firma_id ? Number(d.firma_id) : null),
      anrede, name, firma: String(a?.firma ?? "").trim(), email: String(a?.email ?? "").trim(), telefon: String(a?.telefon ?? "").trim(),
      code: link?.code ?? null, link: link?.url ?? null,
      weg: istGespraechsweg(z?.weg) ? z.weg : null,
      englisch: /^Sprache:\s*Englisch/m.test(String(a?.text ?? "")),
      optin: !!z?.optin_am,
      antworten,
    };
  } catch (e) {
    console.error("[MARA-BUSINESS] businessKontakt:", String((e as Error)?.message || e).slice(0, 200));
    return null;
  }
}

/**
 * Eingang einer UNBEKANNTEN Nummer (waEingang, verwaisteNachziehen): Ist es ein Business-Kontakt, wird die Nummer gemerkt
 * und KEIN Privat-Lead angelegt. true = Business. Wirft nie (im Zweifel false = der alte Weg).
 */
export async function businessEingang(nummerRoh: string, text: string, lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const nummer = waKanonisch(nummerRoh);
    if (!nummer) return false;
    await mbSchema(lauf);
    const { leadCodeLesen, offeneAnfrageFuer } = await import("./fiaon-lead-weg");
    const code = kennungAusText(text);
    const ausCode = code ? await leadCodeLesen(code, { lauf }).catch(() => null) : null;
    if (ausCode) {
      await zeileMerken(nummer, { anfrageId: ausCode.anfrageId, firmaId: ausCode.firmaId, optinQuelle: "whatsapp_selbst" }, lauf);
      await wegSetzen(nummer, "whatsapp", "whatsapp_link", lauf).catch(() => {});
      return true;
    }
    const offen = await offeneAnfrageFuer(null, nummer, lauf);
    if (offen) {
      await zeileMerken(nummer, { anfrageId: offen.anfrageId, firmaId: offen.firmaId, optinQuelle: "whatsapp_selbst" }, lauf);
      return true;
    }
    const [schon] = (await lauf`SELECT 1 AS ja FROM fiaon_wa_global WHERE nummer = ${nummer}`) as any[];
    if (schon) return true;
    if (istGlobalEinstieg(text)) {
      // Website-Knopf ohne Kennung: eine neue Global-Anfrage (Daniel, Dossier, Justin) — nie die Privat-Strecke.
      const anfrageId = await anfrageAusWhatsapp(nummer, text, lauf).catch((e) => {
        console.error("[MARA-BUSINESS] Anfrage aus WhatsApp:", String(e?.message ?? e).slice(0, 160)); return null;
      });
      await zeileMerken(nummer, { anfrageId, optinQuelle: "whatsapp_selbst" }, lauf);
      await wegSetzen(nummer, "whatsapp", "whatsapp_link", lauf).catch(() => {});
      return true;
    }
    return false;
  } catch (e) {
    console.error("[MARA-BUSINESS] businessEingang:", String((e as Error)?.message || e).slice(0, 200));
    return false;
  }
}

async function anfrageAusWhatsapp(nummer: string, text: string, lauf: Lauf): Promise<number | null> {
  const { globalAnfrageAnnehmen } = await import("./fiaon-global-termin");
  const erg = await globalAnfrageAnnehmen({
    kontakt: {
      name: "", vorname: null, nachname: null, firma: "", email: "", telefon: `+${nummer}`,
      paket: null, paketText: null, land: nummer.startsWith("41") ? "CH" : nummer.startsWith("43") ? "AT" : "DE", sprache: "de",
    },
    wunschzeit: null,
    text: `Über WhatsApp an Mara (FIAON Global): „${String(text).slice(0, 400)}“`,
    ip: "whatsapp",
    herkunft: { wo: "WhatsApp (Mara Business)", quelle: "whatsapp", autor: "Mara" },
  });
  void lauf;
  return erg?.anfrageId ?? null;
}

// ── Der gewählte Weg ───────────────────────────────────────────────────────
/**
 * Merkt den Weg (telefon | mail | whatsapp). Wählt er E-Mail oder WhatsApp, schließt sich Daniels Anruf-Auftrag mit
 * Vermerk (leadStandSetzen); bei E-Mail bekommt Justin eine kurze Mail, dass er schreiben soll. Wirft nie.
 */
export async function wegSetzen(nummer: string, weg: Gespraechsweg, quelle: string, lauf: Lauf = sqlPool): Promise<void> {
  try {
    await mbSchema(lauf);
    const [alt] = (await lauf`SELECT weg, anfrage_id, firma_id FROM fiaon_wa_global WHERE nummer = ${nummer}`) as any[];
    await lauf`
      INSERT INTO fiaon_wa_global (nummer, weg, weg_am, weg_quelle) VALUES (${nummer}, ${weg}, NOW(), ${quelle})
      ON CONFLICT (nummer) DO UPDATE SET weg = EXCLUDED.weg, weg_am = NOW(), weg_quelle = EXCLUDED.weg_quelle, updated_at = NOW()`;
    if (alt?.weg === weg) return;
    const anfrageId = alt?.anfrage_id ? Number(alt.anfrage_id) : null;
    if (!anfrageId) return;
    const firmaId = alt?.firma_id ? Number(alt.firma_id) : null;
    // Cockpit-Verlauf: was er gewählt hat.
    if (firmaId) {
      await lauf`
        INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
        VALUES (${firmaId}, NULL, 'Mara (WhatsApp)', 'global', 'gespraechsweg', ${`Gesprächsweg gewählt: ${WEG_TEXT[weg]}`})`.catch(() => {});
    }
    if (weg === "mail" || weg === "whatsapp") {
      const { leadStandSetzen } = await import("./fiaon-lead-takt");
      await leadStandSetzen({ anfrageId, ereignis: weg === "mail" ? "weg_mail" : "weg_whatsapp", wer: { id: null, name: "Mara (WhatsApp)" } }, lauf).catch(() => {});
    }
    if (weg === "whatsapp") {
      // Er spricht jetzt auf WhatsApp mit Mara — die Nachfass-Mails aus js@ hören auf (Stopp „hat geantwortet“, E-476).
      await lauf`UPDATE fiaon_lead_weg SET antwort_am = COALESCE(antwort_am, NOW()), updated_at = NOW() WHERE anfrage_id = ${anfrageId}`.catch(() => {});
    }
    if (weg === "mail") await anJustin(anfrageId, "wünscht das Gespräch per E-Mail", "Er hat auf WhatsApp „Per E-Mail“ gewählt — bitte schreib ihm aus js@ (Daniel ruft nicht an).", lauf);
  } catch (e) {
    console.error("[MARA-BUSINESS] wegSetzen:", String((e as Error)?.message || e).slice(0, 200));
  }
}

/** Eine kurze Mail an Justin (js@) zu einem Business-Lead. Wirft nie. */
async function anJustin(anfrageId: number | null, kurz: string, text: string, lauf: Lauf = sqlPool): Promise<void> {
  try {
    const [a] = anfrageId ? (await lauf`SELECT name, firma, email, telefon FROM fiaon_anfragen WHERE id = ${anfrageId}`) as any[] : [];
    const wer = [String(a?.name ?? "").trim(), String(a?.firma ?? "").trim()].filter(Boolean).join(" · ") || "Business-Lead";
    const { CRONS_AN } = await import("./fiaon-crons");
    if (!CRONS_AN) return;
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    await eigeneMailSenden({
      an: "js@fiaon.com", name: "Justin Schwarzott",
      betreff: `WhatsApp: ${wer} ${kurz}`,
      text: [`Hallo Justin,`, ``, `${wer}${anfrageId ? ` (Anfrage #${anfrageId})` : ""}: ${text}`,
        a?.email ? `E-Mail: ${a.email}` : "", a?.telefon ? `Telefon: ${a.telefon}` : "", ``,
        `Den Chat siehst du im Chefbüro › WhatsApp-Raum.`].filter((z) => z !== "").join("\n"),
    });
  } catch (e) {
    console.error("[MARA-BUSINESS] Mail an Justin:", String((e as Error)?.message || e).slice(0, 160));
  }
}

// ── Freie Zeiten bei Justin ────────────────────────────────────────────────
const WOCHENTAG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
/** „Donnerstag, 12.11., 14:00 Uhr“ aus Tag (JJJJ-MM-TT, Berlin) und Zeit. Rein. */
export function zeitText(tag: string, zeit: string): string {
  const [j, m, t] = tag.split("-").map(Number);
  const wt = WOCHENTAG[new Date(Date.UTC(j, (m || 1) - 1, t || 1, 12)).getUTCDay()];
  return `${wt}, ${String(t).padStart(2, "0")}.${String(m).padStart(2, "0")}., ${zeit} Uhr`;
}
/** Bis zu drei Zeiten an verschiedenen Tagen (die frühesten), dazu alle als Text für Mara. */
export async function freieZeiten(): Promise<{ angebot: { tag: string; zeit: string; text: string }[]; alle: { tag: string; zeit: string; text: string }[] }> {
  try {
    const { globalAngebotLaden } = await import("./fiaon-global-termin");
    const st = await globalAngebotLaden();
    const frei = [...(st.ergebnis?.frei ?? [])].sort((a: any, b: any) => `${a.tag} ${a.zeit}`.localeCompare(`${b.tag} ${b.zeit}`));
    const alle = frei.slice(0, 24).map((f: any) => ({ tag: String(f.tag), zeit: String(f.zeit), text: zeitText(String(f.tag), String(f.zeit)) }));
    const angebot: typeof alle = [];
    const tage = new Set<string>();
    for (const f of alle) { if (tage.has(f.tag)) continue; tage.add(f.tag); angebot.push(f); if (angebot.length === 3) break; }
    return { angebot, alle };
  } catch (e) {
    console.error("[MARA-BUSINESS] freie Zeiten:", String((e as Error)?.message || e).slice(0, 160));
    return { angebot: [], alle: [] };
  }
}

/** Ein kommendes Lead-Gespräch dieses Kontakts (Text + Id), sonst null. */
async function kommendesGespraech(k: BusinessKontakt, lauf: Lauf): Promise<{ id: number; text: string; beginn: Date } | null> {
  const { kommenderTerminFuerKontakt } = await import("./fiaon-lead-weg");
  const t = await kommenderTerminFuerKontakt(k.email || null, k.telefon || `+${k.nummer}`, lauf).catch(() => null);
  if (!t) return null;
  const b = new Date(t.beginn);
  const tag = berlinHeuteIso(b);
  const zeit = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(b);
  return { id: t.terminId, text: zeitText(tag, zeit), beginn: b };
}

/** Bucht eine von Mara angebotene Zeit bei Justin über den persönlichen Link der Anfrage. */
async function buchen(k: BusinessKontakt, tag: string, zeit: string): Promise<{ ok: boolean; text: string | null; terminId: number | null }> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || !/^\d{2}:\d{2}$/.test(zeit)) return { ok: false, text: null, terminId: null };
    const { globalTerminBuchen, globalKontaktLesen } = await import("./fiaon-global-termin");
    const kontakt = globalKontaktLesen({ name: k.name || "Business-Lead", firma: k.firma, email: k.email, telefon: k.telefon || `+${k.nummer}`, sprache: k.englisch ? "en" : "de" });
    if ("error" in kontakt) return { ok: false, text: null, terminId: null };
    const erg: any = await globalTerminBuchen({ kontakt, tag, zeit, thema: "Über WhatsApp mit Mara (FIAON Global)", code: k.code });
    if (!erg?.ok) return { ok: false, text: null, terminId: null };
    const terminId = Number(erg.terminId ?? erg.termin?.id ?? 0) || null;
    if (terminId) await sqlPool`UPDATE fiaon_wa_global SET termin_gemeldet_id = ${terminId}, updated_at = NOW() WHERE nummer = ${k.nummer}`.catch(() => {});
    return { ok: true, text: zeitText(tag, zeit), terminId };
  } catch (e) {
    console.error("[MARA-BUSINESS] buchen:", String((e as Error)?.message || e).slice(0, 200));
    return { ok: false, text: null, terminId: null };
  }
}

// ── Die Antwort ────────────────────────────────────────────────────────────
export interface MbEin {
  nummer: string;
  kontakt: BusinessKontakt;
  /** Verlauf (neueste zuerst), wie maraAntwortet ihn liest. */
  verlauf: any[];
  /** Die offenen Kundennachrichten (neueste zuerst). */
  offeneRein: any[];
  neuesteRein: any;
  /** Aus fiaon-whatsapp-mara.ts: Antwort vorbereiten (Versandtakt schickt nach 6–18 s). */
  vorbereiten: (nummer: string, antwort: string, aufId: number, frage: string, meta: { kunde?: string; handlung?: string }) => Promise<void>;
  /** Aus fiaon-whatsapp-mara.ts: eine Aufgabe für Justin (Klasse global, Betreiber-Brett). */
  anJustinUebergeben: (grund: string) => Promise<boolean>;
}

const istMaraVon = (v: unknown) => /^mara/i.test(String(v ?? ""));

/** Wer hat sich in diesem Gespräch schon als digitale Assistentin vorgestellt (frei oder per Vorlage)? */
function schonVorgestellt(verlauf: any[]): boolean {
  return verlauf.some((v) => v.richtung === "raus" && /digitale Assistentin|digital assistant/i.test(String(v.text ?? "")));
}

/** Chatverlauf fürs Modell (älteste zuerst, höchstens 16 Zeilen). */
function fuerModell(verlauf: any[]): { role: "user" | "assistant"; content: string }[] {
  return verlauf.slice(0, 16).slice().reverse()
    .filter((v) => String(v.text || v.knopf || "").trim())
    .map((v) => ({ role: v.richtung === "rein" ? "user" as const : "assistant" as const, content: String(v.text || v.knopf).slice(0, 1500) }));
}

export async function maraBusinessAntwortet(ein: MbEin): Promise<{ gesendet: boolean; grund: string }> {
  const { nummer, kontakt: k } = ein;
  const aufId = Number(ein.neuesteRein.id);
  const seinText = ein.offeneRein.slice().reverse().map((v) => String(v.text || v.knopf || "")).join(" · ").replace(/\s+/g, " ").trim();
  const ersteAntwort = !schonVorgestellt(ein.verlauf);
  const fertig = async (text: string, handlung: string) => {
    const t = ersteAntwort ? vorstellungVoran(text, k.englisch) : text;
    await ein.vorbereiten(nummer, t, aufId, seinText, { kunde: seinText, handlung: `Mara Business: ${handlung}` });
    return { gesendet: false, grund: `Mara Business: ${handlung} (liegt bereit)` };
  };

  if (!(await mbAn())) {
    await ein.anJustinUebergeben(`FIAON Global — Business-Lead schreibt auf WhatsApp: „${seinText.slice(0, 300)}“. Mara Business ist aus — bitte selbst antworten (WhatsApp-Raum).`);
    return { gesendet: false, grund: "Mara Business ist aus — Aufgabe für Justin." };
  }
  // Ein Lead, der auf WhatsApp schreibt, ist im Gespräch — die Nachfass-Mails aus js@ hören auf (E-476 Stopp „antwort“).
  if (k.anfrageId) await sqlPool`UPDATE fiaon_lead_weg SET antwort_am = COALESCE(antwort_am, NOW()), updated_at = NOW() WHERE anfrage_id = ${k.anfrageId}`.catch(() => {});

  // 1. Ein Knopf einer Business-Vorlage — feste Sätze, ohne KI (auch in der KI-Pause).
  const knopf = knopfAktion(ein.neuesteRein.text, ein.neuesteRein.knopf);
  if (knopf && ein.offeneRein.length === 1) {
    const termin = await kommendesGespraech(k, sqlPool).catch(() => null);
    if (knopf.art === "weg") {
      await wegSetzen(nummer, knopf.weg, "knopf");
      if (knopf.weg === "mail") return fertig(satzWegMail(k.email || null, k.englisch), "Weg E-Mail gewählt — Justin informiert");
      if (knopf.weg === "whatsapp") return fertig(satzWegWhatsapp(k.englisch), "Weg WhatsApp gewählt");
      if (termin) return fertig(satzPasst(termin.text, k.englisch), "Telefon gewählt — Gespräch steht schon");
      const z = await freieZeiten();
      return fertig(satzTelefon(z.angebot.map((x) => x.text), k.link, k.englisch), "Telefon gewählt — Zeiten angeboten");
    }
    if (knopf.art === "termin_ja" || knopf.art === "verschieben") {
      const z = await freieZeiten();
      return fertig(satzTelefon(z.angebot.map((x) => x.text), k.link, k.englisch), knopf.art === "verschieben" ? "will verschieben — neue Zeiten angeboten" : "Zeiten angeboten");
    }
    if (knopf.art === "spaeter") {
      await sqlPool`UPDATE fiaon_wa_global SET spaeter_am = NOW(), updated_at = NOW() WHERE nummer = ${nummer}`.catch(() => {});
      return fertig(satzSpaeter(k.englisch), "„Später“ — keine Nachfrage mehr");
    }
    if (knopf.art === "passt") return fertig(satzPasst(termin?.text ?? null, k.englisch), "Termin bestätigt");
    if (knopf.art === "antwort_lesen") {
      await ein.anJustinUebergeben(`FIAON Global — ${k.name || "der Lead"} möchte deine Antwort auf WhatsApp lesen (Knopf „Ja, bitte“). Das Fenster ist jetzt offen: bitte im WhatsApp-Raum senden.`);
      return fertig(k.englisch ? "Thank you, Mr Schwarzott will send you his answer here." : "Danke, Herr Schwarzott schickt Ihnen seine Antwort hier.", "Antwort-Wunsch an Justin");
    }
  }

  // 2. Das Modell — mit Business-Gehirn, Wand und genau einem zweiten Versuch.
  const termin = await kommendesGespraech(k, sqlPool).catch(() => null);
  const zeiten = termin ? { angebot: [], alle: [] } : await freieZeiten();
  const { erzaehltLesen } = await import("./fiaon-lead-weg");
  const erzaehlt = k.firmaId ? (await erzaehltLesen(k.firmaId).catch(() => [])).slice(0, 4).map((x) => x.text) : [];
  const anweisung = String((await einstellung(MB_SCHLUESSEL.anweisung)) ?? "").trim() || null;
  const auftrag = businessAuftrag({
    anrede: k.anrede, firma: k.firma || null, email: k.email || null, antworten: k.antworten, weg: k.weg, termin: termin?.text ?? null,
    freieZeiten: zeiten.alle.slice(0, 8).map((x) => `${x.text} [${x.tag} ${x.zeit}]`), link: k.link, ersteAntwort,
    englisch: k.englisch, erzaehlt, anweisung,
  });
  const { kiAufruf, antwortLesen } = await import("./fiaon-postmeister-agent");
  const { kiModell } = await import("./fiaon-ki-kasse");
  const { sendePruefung } = await import("./fiaon-whatsapp");
  const nachrichten: any[] = [{ role: "system", content: auftrag }, ...fuerModell(ein.verlauf)];
  let obj: any = null;
  let funde: string[] = [];
  for (let versuch = 0; versuch < 2; versuch++) {
    try {
      const j = await kiAufruf({
        dienst: MB_DIENST, modell: kiModell("whatsapp"), schema: MB_SCHEMA, aufwand: "low", maxTokens: 3000, person: null,
        nachrichten: versuch === 0 ? nachrichten : [...nachrichten, { role: "user", content: `INTERN (nicht vom Kunden): Deine letzte Fassung verletzt diese Regeln — ${funde.join(" · ")}. Schreib die Nachricht neu, gleiche Aufgabe.` }],
      });
      obj = antwortLesen(j, "Mara Business");
    } catch (e: any) {
      const pausiert = /pausiert|KiPausiert|kasse/i.test(String(e?.name ?? "") + String(e?.message ?? ""));
      console.warn(`[MARA-BUSINESS] ${nummer.slice(-4)}: KI ${pausiert ? "pausiert" : "Fehler"}:`, String(e?.message ?? e).slice(0, 160));
      if (pausiert) return { gesendet: false, grund: "KI pausiert — Mara Business antwortet, sobald sie wieder da ist." };
      obj = null;
    }
    const text = String(obj?.antwort ?? "").trim();
    funde = obj ? [...sendePruefung(text), ...businessWand(text, { ersteAntwort })] : ["keine Antwort der KI"];
    if (!funde.length) break;
  }
  if (!obj || funde.length) {
    await ein.anJustinUebergeben(`FIAON Global — Mara Business konnte nicht sicher antworten (${funde.join(" · ").slice(0, 200)}). Er schreibt: „${seinText.slice(0, 300)}“ — bitte selbst antworten (WhatsApp-Raum).`);
    return fertig(satzUebergabe(k.englisch), "Wand zweimal getroffen — an Justin übergeben");
  }

  // 3. Handeln: Weg, Termin, Notiz, Übergabe.
  let text = String(obj.antwort).trim();
  const handlungen: string[] = [];
  if (istGespraechsweg(obj.weg) && obj.weg !== k.weg) { await wegSetzen(nummer, obj.weg, "chat"); handlungen.push(`Weg ${obj.weg}`); }
  if (obj.termin && !termin) {
    const b = await buchen(k, String(obj.termin.tag ?? ""), String(obj.termin.zeit ?? ""));
    if (b.ok && b.text) { text = satzGebucht(b.text, k.englisch); handlungen.push(`Gespräch gebucht ${b.text}`); }
    else {
      const z = await freieZeiten();
      text = `${k.englisch ? "That time has just been taken, I am sorry." : "Diese Zeit ist leider gerade vergeben."} ${satzTelefon(z.angebot.map((x) => x.text), k.link, k.englisch)}`;
      handlungen.push("Zeit vergeben — neue angeboten");
    }
  }
  if (obj.notiz && k.firmaId) {
    const { erzaehltVermerken } = await import("./fiaon-lead-weg");
    await erzaehltVermerken(k.firmaId, `WhatsApp: ${String(obj.notiz).slice(0, 500)}`, { id: null, name: "Mara (WhatsApp)" }).catch(() => {});
    handlungen.push("Notiz fürs Dossier");
  }
  if (obj.uebergabe) {
    await ein.anJustinUebergeben(`FIAON Global — ${k.name || "Business-Lead"}${k.firma ? ` (${k.firma})` : ""} auf WhatsApp: ${String(obj.uebergabe).slice(0, 300)} — er schrieb: „${seinText.slice(0, 200)}“`);
    handlungen.push("an Justin übergeben");
  }
  return fertig(text, handlungen.join(", ") || "Antwort");
}

// ═══════════════════════════════════════════════════════════════════════════
// DER TAKT (alle 5 Minuten): Ja verknüpfen, Begrüßung, Termin, Erinnerung, nicht erreicht, eine Nachfrage
// ═══════════════════════════════════════════════════════════════════════════
const VORLAGE = {
  willkommen: "fiaon_gl_willkommen", termin: "fiaon_gl_termin", erinnerung: "fiaon_gl_erinnerung",
  nichtErreicht: "fiaon_gl_nicht_erreicht", nachfrage: "fiaon_gl_nachfrage",
} as const;
const WILLKOMMEN_MAX_TAG = 40;
/** E-487 (09.11.2026): so viele Anfragen prüft die Begrüßung je Takt — die neuesten zuerst (vorher 30, die ältesten zuerst). */
export const WA_KANDIDATEN = 60;

/**
 * Die Formular-Namen mit WhatsApp-Satz: die Formular-Fassung 2 (E-476 Danke-Knopf + E-481 WhatsApp-Satz, Namen aus
 * META_FASSUNG2_NAMEN) und jede spätere Fassung mit „WhatsApp“ im Namen (das prüft die Abfrage mit ILIKE).
 */
export async function waFormularNamen(): Promise<string[]> {
  const { META_FASSUNG2_NAMEN } = await import("@shared/fiaon-lead-weg");
  return Object.values(META_FASSUNG2_NAMEN) as string[];
}

/** Die WhatsApp-Nummer einer Anfrage-Zeile (telefon, land, ip): Formular mit Land; aus WhatsApp so, wie sie kam. Rein. */
export function nummerDerAnfrage(a: { telefon?: unknown; land?: unknown; ip?: unknown } | null | undefined): string | null {
  if (!a) return null;
  return anfrageNummer(a.telefon, a.land ? String(a.land) : null, { ausWhatsapp: String(a.ip ?? "") === "whatsapp" });
}

export interface WaJaZeile { nummer: string; anfrageId: number | null; optinAm: Date | null; optinQuelle: string | null; optinText: string | null }

/**
 * E-487 (09.11.2026): An welche Nummer geht die Nachricht zu einer Anfrage, und auf welches Ja stützt sie sich? Rein.
 *   1. Ein Ja am selben Anschluss (gleiche letzte neun Ziffern — auch eine früher als „+1“ gelesene Zeile) → die Nummer der Anfrage.
 *   2. Ein Ja an DIESER Anfrage für einen anderen Anschluss (z. B. im Buchungsformular eine zweite Nummer) → genau diese Nummer.
 *   3. Das Meta-Formular mit WhatsApp-Satz (Fassung 2) → die Nummer der Anfrage.
 * Sonst null: ohne Ja schreibt Mara nie zuerst.
 */
export function waZielFuerAnfrage(ein: { anfrageId: number; nummer: string | null; ja: readonly WaJaZeile[]; formular: boolean }): { nummer: string; quelle: string; am: Date | null; text: string | null } | null {
  const k9 = ein.nummer ? nummerKey9(ein.nummer) : "";
  const amAnschluss = ein.nummer ? ein.ja.find((z) => !!z.optinAm && (z.nummer === ein.nummer || (!!k9 && nummerKey9(z.nummer) === k9))) : undefined;
  if (ein.nummer && amAnschluss) return { nummer: ein.nummer, quelle: amAnschluss.optinQuelle || "website", am: amAnschluss.optinAm, text: amAnschluss.optinText };
  const anAnfrage = ein.ja.find((z) => !!z.optinAm && z.anfrageId === ein.anfrageId && /^\d{8,15}$/.test(z.nummer));
  if (anAnfrage) return { nummer: anAnfrage.nummer, quelle: anAnfrage.optinQuelle || "website", am: anAnfrage.optinAm, text: anAnfrage.optinText };
  if (ein.formular && ein.nummer) return { nummer: ein.nummer, quelle: "formular", am: null, text: null };
  return null;
}

function jaZeile(z: any): WaJaZeile {
  return {
    nummer: String(z.nummer), anfrageId: z.anfrage_id ? Number(z.anfrage_id) : null, optinAm: z.optin_am ? new Date(z.optin_am) : null,
    optinQuelle: z.optin_quelle ? String(z.optin_quelle) : null, optinText: z.optin_text ? String(z.optin_text) : null,
  };
}

/** Alle Ja-Zeilen, die zu einer Anfrage gehören können (Nummer, Anfrage, gleicher Anschluss). */
async function jaZeilenFuer(anfrageId: number, nummer: string | null, lauf: Lauf): Promise<WaJaZeile[]> {
  const k9 = nummer ? nummerKey9(nummer) : "";
  const zeilen = (await lauf`
    SELECT * FROM fiaon_wa_global
     WHERE optin_am IS NOT NULL
       AND (anfrage_id = ${anfrageId} OR (${nummer ?? ""} <> '' AND nummer = ${nummer ?? ""}) OR (${k9} <> '' AND RIGHT(nummer, 9) = ${k9}))
     ORDER BY optin_am`.catch(() => [])) as any[];
  return zeilen.map(jaZeile);
}

/**
 * E-487 (09.11.2026): Ja-Zeilen ohne Anfrage verknüpfen — „der Takt findet das Ja per anfrage_id oder letzten 9 Ziffern“.
 * Befund (Produktion nur gelesen): Die Website-Ja der Buchungen vom 05.–07.11. trugen anfrage_id NULL, eine davon eine als
 * +1 gelesene Nummer — die Terminnachricht auf WhatsApp erreichte keinen. Gesucht wird die jüngste Global-Anfrage (60 Tage,
 * kein Test, kein Privat-Weg) am selben Anschluss. Gleiche Nummer → verknüpfen. Falsch gelesene Nummer → die Zeile zieht
 * auf die richtige Nummer um; steht die richtige schon da, übernimmt sie das Ja, und die falsche fällt weg (nur ohne eigenen
 * Verlauf). Nur Formular- und Telefon-Jas — nie eine Nummer, die uns selbst auf WhatsApp geschrieben hat. Wirft nie.
 */
async function jaVerknuepfen(lauf: Lauf): Promise<number> {
  const offen = (await lauf`
    SELECT * FROM fiaon_wa_global
     WHERE optin_am IS NOT NULL AND anfrage_id IS NULL AND created_at > NOW() - INTERVAL '60 days'
       AND COALESCE(optin_quelle, '') NOT LIKE 'whatsapp%' AND nummer ~ '^[0-9]{8,15}$'
     ORDER BY created_at DESC LIMIT 50`.catch(() => [])) as any[];
  let n = 0;
  for (const g of offen) {
    try {
      const alt = String(g.nummer);
      const k9 = nummerKey9(alt);
      if (!k9) continue;
      const [a] = (await lauf`
        SELECT id, telefon, land, ip FROM fiaon_anfragen
         WHERE art = 'global' AND NOT COALESCE(ist_test, FALSE) AND COALESCE(status, '') <> 'privat'
           AND created_at > NOW() - INTERVAL '60 days'
           AND RIGHT(REGEXP_REPLACE(COALESCE(telefon, ''), '\\D', '', 'g'), 9) = ${k9}
         ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
      if (!a) continue;
      const richtig = nummerDerAnfrage(a);
      if (!richtig || nummerKey9(richtig) !== k9) continue;
      const anfrageId = Number(a.id);
      if (richtig === alt) {
        await lauf`UPDATE fiaon_wa_global SET anfrage_id = ${anfrageId}, updated_at = NOW() WHERE nummer = ${alt} AND anfrage_id IS NULL`;
        n++;
        continue;
      }
      const [umgezogen] = (await lauf`
        UPDATE fiaon_wa_global SET nummer = ${richtig}, anfrage_id = ${anfrageId}, updated_at = NOW()
         WHERE nummer = ${alt} AND anfrage_id IS NULL AND NOT EXISTS (SELECT 1 FROM fiaon_wa_global x WHERE x.nummer = ${richtig})
        RETURNING nummer`.catch(() => [])) as any[];
      if (!umgezogen) {
        await zeileMerken(richtig, { anfrageId, optinQuelle: g.optin_quelle ? String(g.optin_quelle) : "website", optinAm: new Date(g.optin_am), optinText: g.optin_text ? String(g.optin_text) : null }, lauf);
        await lauf`
          DELETE FROM fiaon_wa_global
           WHERE nummer = ${alt} AND anfrage_id IS NULL AND willkommen_am IS NULL AND weg IS NULL AND termin_gemeldet_id IS NULL
             AND erinnert_id IS NULL AND nicht_erreicht_id IS NULL AND nachfrage_am IS NULL`.catch(() => {});
      }
      console.log(`[MARA-BUSINESS] Ja zu WhatsApp verknüpft: Anfrage #${anfrageId} (Nummer …${alt.slice(-4)}${richtig !== alt ? ", falsch gelesen — umgezogen" : ""}).`);
      n++;
    } catch (e) {
      console.error("[MARA-BUSINESS] Ja verknüpfen:", String((e as Error)?.message || e).slice(0, 160));
    }
  }
  return n;
}

/** Ein STOPP von dieser Nummer, jemals? (Werbesperre und Sperren prüft waSenden zusätzlich.) */
async function hatStopp(nummer: string, lauf: Lauf): Promise<boolean> {
  const { istStopp } = await import("./fiaon-whatsapp-mara");
  const zeilen = (await lauf`SELECT text, knopf FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'rein' ORDER BY id DESC LIMIT 60`.catch(() => [])) as any[];
  return zeilen.some((z) => istStopp(z.text, z.knopf));
}

async function vorlageSenden(nummer: string, vorlage: string, werte: string[], knopfWert?: string): Promise<{ ok: boolean; grund?: string }> {
  const erg: any = await waSenden(nummer, { vorlage, werte, ...(knopfWert ? { knopfWert } : {}) }, { personId: null, leadId: null, von: "Mara", frischerLead: vorlage === VORLAGE.willkommen });
  return { ok: !!erg?.ok, grund: erg?.grund };
}
async function textSenden(nummer: string, text: string): Promise<{ ok: boolean }> {
  const erg: any = await waSenden(nummer, { text }, { personId: null, leadId: null, von: MB_VON });
  return { ok: !!erg?.ok };
}

export async function waGlobalTakt(lauf: Lauf = sqlPool): Promise<Record<string, number>> {
  const zahl = { verknuepft: 0, willkommen: 0, termin: 0, erinnerung: 0, nichtErreicht: 0, nachfrage: 0 };
  try {
    if (!istAn(await einstellung(MB_SCHLUESSEL.taktAn, lauf)) || !(await mbAn(lauf))) return zahl;
    const { CRONS_AN } = await import("./fiaon-crons");
    if (!CRONS_AN) return zahl;
    await mbSchema(lauf);
    // Zählbeginn: der erste Lauf setzt ihn — Anfragen davor bekommen nie eine Begrüßung (Alt-Leads, E-481 Entscheidung 2).
    // E-487: Ein frisches Ja (Telefon, Website, in den letzten drei Tagen) gilt auch für eine ältere Anfrage — es ist neu.
    let ab = String((await einstellung(MB_SCHLUESSEL.ab, lauf)) ?? "").trim();
    if (!ab || !Number.isFinite(Date.parse(ab))) { ab = new Date().toISOString(); await einstellungSetzen(MB_SCHLUESSEL.ab, ab, lauf); }
    const frei = await freigegebeneVorlagen().catch(() => new Set<string>());
    const nutzbar = (n: string) => vorlageNutzbar(n, frei);
    const fenster = imVersandfenster(new Date());

    // 0. E-487: Ja-Zeilen ohne Anfrage verknüpfen (letzte neun Ziffern) — falsch gelesene Nummern ziehen um.
    zahl.verknuepft += await jaVerknuepfen(lauf);

    // 1. E-487 (09.11.2026): Anfragen MIT Ja zu WhatsApp und OHNE Begrüßung — verknüpfen, dann die Begrüßung (einmal,
    //    8–20 Uhr, ≥ 10 Minuten nach der Anfrage, ohne Termin). Vorher kamen die ältesten 30 Anfragen dran, Ja und Begrüßung
    //    erst in der Schleife geprüft — ab 30 Anfragen in drei Tagen verhungerten die neuesten. Jetzt: LEFT JOIN
    //    fiaon_wa_global (nur ohne willkommen_am, das Ja gleich im SQL), die neuesten zuerst, bis zu WA_KANDIDATEN. Eine
    //    Anfrage mit Termin wird nur verknüpft: Schritt 2 schickt ihr die Terminnachricht (fiaon_gl_termin).
    const namen = await waFormularNamen();
    const [heute] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_wa_global WHERE willkommen_am > NOW() - INTERVAL '20 hours' AND willkommen_status = 'gesendet'`) as any[];
    let rest = Math.max(0, WILLKOMMEN_MAX_TAG - Number(heute?.n ?? 0));
    const kandidaten = (await lauf`
      SELECT a.id, a.telefon, a.email, a.land, a.ip, COALESCE(a.status, '') AS status, COALESCE(f.ja, FALSE) AS formular
        FROM fiaon_anfragen a
        LEFT JOIN LATERAL (
          SELECT BOOL_OR(w.willkommen_am IS NOT NULL) AS begruesst, BOOL_OR(w.optin_am IS NOT NULL) AS ja,
                 BOOL_OR(w.optin_am > NOW() - INTERVAL '3 days') AS ja_frisch
            FROM fiaon_wa_global w
           WHERE w.anfrage_id = a.id OR RIGHT(w.nummer, 9) = RIGHT(REGEXP_REPLACE(COALESCE(a.telefon, ''), '\\D', '', 'g'), 9)) g ON TRUE
        LEFT JOIN LATERAL (
          SELECT TRUE AS ja FROM fiaon_meta_leads m JOIN fiaon_meta_formulare mf ON mf.id = m.formular_id
           WHERE m.global_anfrage_id = a.id AND (mf.name ILIKE '%WhatsApp%' OR mf.name = ANY(${namen})) LIMIT 1) f ON TRUE
       WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE)
         AND COALESCE(a.status, '') NOT IN ('privat', 'kein_interesse', 'ungueltig', 'kunde', 'antrag')
         AND a.created_at < NOW() - INTERVAL '10 minutes' AND a.created_at > NOW() - INTERVAL '60 days'
         AND ((a.created_at > ${new Date(ab)} AND a.created_at > NOW() - INTERVAL '3 days') OR COALESCE(g.ja_frisch, FALSE))
         AND COALESCE(a.telefon, '') <> ''
         AND NOT COALESCE(g.begruesst, FALSE) AND (COALESCE(g.ja, FALSE) OR COALESCE(f.ja, FALSE))
       ORDER BY a.created_at DESC LIMIT ${WA_KANDIDATEN}`.catch((e: unknown) => {
      console.error("[MARA-BUSINESS] Kandidaten der Begrüßung:", String((e as Error)?.message ?? e).slice(0, 200));
      return [];
    })) as any[];
    for (const a of kandidaten) {
      const anfrageId = Number(a.id);
      const nummerA = nummerDerAnfrage(a);
      const ziel = waZielFuerAnfrage({ anfrageId, nummer: nummerA, ja: await jaZeilenFuer(anfrageId, nummerA, lauf), formular: !!a.formular });
      if (!ziel) continue;
      // Verknüpfen — auch mit Termin und außerhalb 8–20 Uhr (Schritt 2 braucht die Zeile mit Anfrage und Ja).
      await zeileMerken(ziel.nummer, { anfrageId, optinQuelle: ziel.quelle, optinAm: ziel.am, optinText: ziel.text }, lauf);
      if (!fenster || !nutzbar(VORLAGE.willkommen) || rest <= 0 || a.status === "termin") continue;
      const [z] = (await lauf`SELECT willkommen_am FROM fiaon_wa_global WHERE nummer = ${ziel.nummer}`) as any[];
      if (z?.willkommen_am) continue;
      const [schonWa] = (await lauf`SELECT 1 AS ja FROM fiaon_whatsapp WHERE nummer = ${ziel.nummer} AND created_at > NOW() - INTERVAL '30 days' LIMIT 1`) as any[];
      if (schonWa) continue;
      if (await hatStopp(ziel.nummer, lauf)) continue;
      const k = await businessKontakt(ziel.nummer, null, lauf);
      if (!k || !k.anfrageId) continue;
      if (await kommendesGespraech(k, lauf).catch(() => null)) continue;
      const erg = await vorlageSenden(ziel.nummer, VORLAGE.willkommen, [k.anrede || "und willkommen"]);
      await lauf`UPDATE fiaon_wa_global SET willkommen_am = NOW(), willkommen_status = ${erg.ok ? "gesendet" : `fehler: ${String(erg.grund ?? "").slice(0, 120)}`}, updated_at = NOW() WHERE nummer = ${ziel.nummer}`;
      if (erg.ok) { zahl.willkommen++; rest--; }
    }

    // 2.–5. Für alle Business-Nummern mit Weg WhatsApp, Ja zu WhatsApp (E-487) oder WhatsApp-Verlauf: Termin, Erinnerung,
    //       nicht erreicht, Nachfrage. E-487: auch ein Website-Ja aus einer Buchung ohne Anfrage (Direktbucher) — nur eine
    //       DACH-Handynummer (49/43/41), nie eine falsch gelesene.
    const zeilen = (await lauf`
      SELECT g.*, EXISTS (SELECT 1 FROM fiaon_whatsapp w WHERE w.nummer = g.nummer AND w.richtung = 'rein') AS eingang
        FROM fiaon_wa_global g
       WHERE g.created_at > NOW() - INTERVAL '60 days' AND g.nummer ~ '^[0-9]{8,15}$'
         AND (g.anfrage_id IS NOT NULL OR (g.optin_am IS NOT NULL AND g.optin_quelle = 'website' AND g.nummer ~ '^(49|43|41)'))
         AND (g.weg = 'whatsapp' OR g.optin_am IS NOT NULL OR g.willkommen_status = 'gesendet'
              OR EXISTS (SELECT 1 FROM fiaon_whatsapp w WHERE w.nummer = g.nummer AND w.richtung = 'rein'))
       ORDER BY g.updated_at DESC LIMIT 200`) as any[];
    for (const z of zeilen) {
      const nummer = String(z.nummer);
      if (await hatStopp(nummer, lauf)) continue;
      const k = await businessKontakt(nummer, null, lauf);
      if (!k) continue;
      const offen = await fensterOffen(nummer, lauf).catch(() => false);
      const termin = await kommendesGespraech(k, lauf).catch(() => null);
      // Ist er schon im Gespräch mit Mara (Weg WhatsApp, Begrüßung, eigene Nachricht)? Nur dann gibt es die Nachfrage (5.).
      const imGespraech = z.weg === "whatsapp" || z.willkommen_status === "gesendet" || !!z.eingang;

      // 2. Termin bestätigt (nur einmal je Termin; Maras eigene Buchung ist schon bestätigt). E-487: auch für ein Ja zu
      //    WhatsApp ohne gewählten Weg (Justin 09.11.: „ALLES … WhatsApp“). Die Vorlage nur 8–20 Uhr und erst nach Metas
      //    Freigabe — bis dahin wartet die Meldung (vorher galt sie außerhalb des Fensters als erledigt und kam nie).
      // Kommt die Bestätigung erst kurz vor dem Gespräch (unter 30 Stunden), ersetzt sie die Erinnerung am Vortag — nie zwei
      // Nachrichten zum selben Termin innerhalb von Minuten.
      let erinnerungErsetzt = false;
      if (termin && Number(z.termin_gemeldet_id ?? 0) !== termin.id) {
        const bald = termin.beginn.getTime() - Date.now() < 30 * 3_600_000;
        if (offen) {
          const ok = (await textSenden(nummer, satzGebucht(termin.text, k.englisch))).ok;
          if (ok) {
            zahl.termin++; erinnerungErsetzt = bald;
            await lauf`UPDATE fiaon_wa_global SET termin_gemeldet_id = ${termin.id}, erinnert_id = CASE WHEN ${bald} THEN ${termin.id}::int ELSE erinnert_id END, updated_at = NOW() WHERE nummer = ${nummer}`;
          }
        } else if (fenster && nutzbar(VORLAGE.termin)) {
          const ok = (await vorlageSenden(nummer, VORLAGE.termin, [k.anrede || "und willkommen", termin.text])).ok;
          // Ein Versuch je Termin — ein Fehler wird nicht alle fünf Minuten wiederholt.
          erinnerungErsetzt = ok && bald;
          await lauf`UPDATE fiaon_wa_global SET termin_gemeldet_id = ${termin.id}, erinnert_id = CASE WHEN ${erinnerungErsetzt} THEN ${termin.id}::int ELSE erinnert_id END, updated_at = NOW() WHERE nummer = ${nummer}`;
          if (ok) zahl.termin++;
        }
      }

      // 3. Erinnerung am Vortag (17–20 Uhr) — wer WhatsApp gewählt hat oder (E-487) Ja zu WhatsApp gesagt hat und nicht
      //    „Per E-Mail“ wählte (die Mail-Erinnerung läuft ohnehin, E-458). Die Berliner Stunde über berlinMinuten.
      if (termin && !erinnerungErsetzt && (z.weg === "whatsapp" || (!!z.optin_am && z.weg !== "mail")) && Number(z.erinnert_id ?? 0) !== termin.id) {
        const morgen = berlinHeuteIso(new Date(Date.now() + 24 * 3_600_000));
        const minuten = berlinMinuten(new Date());
        if (berlinHeuteIso(termin.beginn) === morgen && minuten >= 17 * 60 && minuten < 20 * 60) {
          const ok = offen
            ? (await textSenden(nummer, k.englisch ? `A short reminder: your call with Mr Schwarzott is tomorrow, ${termin.text}. Does the time still suit you?` : `Eine kurze Erinnerung: Ihr Gespräch mit Herrn Schwarzott ist morgen, ${termin.text}. Passt Ihnen die Zeit weiterhin?`)).ok
            : (nutzbar(VORLAGE.erinnerung) ? (await vorlageSenden(nummer, VORLAGE.erinnerung, [k.anrede || "und willkommen", termin.text])).ok : false);
          if (ok) { zahl.erinnerung++; await lauf`UPDATE fiaon_wa_global SET erinnert_id = ${termin.id}, updated_at = NOW() WHERE nummer = ${nummer}`; }
        }
      }

      // 4. Nicht erreicht (Gespräch der letzten 24 h auf „verpasst“) — mit seinem persönlichen Link.
      if (fenster && z.weg === "whatsapp" && k.code) {
        const [v] = (await lauf`
          SELECT t.id FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id
           WHERE t.quelle = 'global' AND t.status = 'verpasst' AND t.beginn > NOW() - INTERVAL '24 hours' AND t.beginn < NOW()
             AND (RIGHT(REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) = ${nummer.slice(-9)}
               OR (${k.email} <> '' AND LOWER(COALESCE(p.primary_email, '')) = LOWER(${k.email})))
           ORDER BY t.beginn DESC LIMIT 1`.catch(() => [])) as any[];
        if (v && Number(z.nicht_erreicht_id ?? 0) !== Number(v.id)) {
          const ok = offen
            ? (await textSenden(nummer, k.englisch ? `We tried to reach you by phone just now, unfortunately without success. You can choose a new time here: ${k.link}` : `Wir haben eben versucht, Sie telefonisch zu erreichen – leider ohne Erfolg. Eine neue Zeit wählen Sie hier: ${k.link}`)).ok
            : (nutzbar(VORLAGE.nichtErreicht) ? (await vorlageSenden(nummer, VORLAGE.nichtErreicht, [k.anrede || "und willkommen"], k.code)).ok : false);
          if (ok) { zahl.nichtErreicht++; await lauf`UPDATE fiaon_wa_global SET nicht_erreicht_id = ${Number(v.id)}, updated_at = NOW() WHERE nummer = ${nummer}`; }
        }
      }

      // 5. Eine Nachfrage — einmal, wenn der Chat zwei Tage still ist, kein Termin steht und er nicht „Später“ sagte.
      //    E-487: nur, wenn er schon mit Mara im Gespräch war (ein Ja allein, z. B. nur mit Terminnachricht, reicht nicht).
      if (fenster && imGespraech && !termin && !offen && !z.nachfrage_am && !z.spaeter_am && nutzbar(VORLAGE.nachfrage)) {
        const [letzte] = (await lauf`SELECT MAX(created_at) AS am FROM fiaon_whatsapp WHERE nummer = ${nummer}`) as any[];
        const still = letzte?.am ? Date.now() - new Date(letzte.am).getTime() : 0;
        if (still > 2 * 24 * 3_600_000 && still < 10 * 24 * 3_600_000) {
          const ok = (await vorlageSenden(nummer, VORLAGE.nachfrage, [k.anrede || "und willkommen"])).ok;
          await lauf`UPDATE fiaon_wa_global SET nachfrage_am = NOW(), updated_at = NOW() WHERE nummer = ${nummer}`;
          if (ok) zahl.nachfrage++;
        }
      }
    }
    const summe = Object.values(zahl).reduce((s, n) => s + n, 0);
    if (summe) console.log(`[MARA-BUSINESS] Takt: ${JSON.stringify(zahl)}`);
  } catch (e) {
    console.error("[MARA-BUSINESS] Takt:", String((e as Error)?.message || e).slice(0, 200));
  }
  return zahl;
}

let letzterPuls = 0;
/** Der Lauf für fiaon-crons (nurMitErgebnis): Historienzeile bei Arbeit und einmal je Stunde (Puls für den Wächter). */
export async function waGlobalTaktLauf(): Promise<boolean> {
  const z = await waGlobalTakt();
  const arbeit = Object.values(z).some((n) => n > 0);
  if (arbeit || Date.now() - letzterPuls > 60 * 60_000) { letzterPuls = Date.now(); return true; }
  return false;
}

/**
 * Die Website (Seite hinter dem persönlichen Link): er wählt „Per E-Mail“ oder tippt auf „Auf WhatsApp mit Mara“. Merkt den
 * Weg an der Anfrage des Links (Schlüssel = seine WhatsApp-Nummer, ohne Handynummer „anfrage-<id>“). Wirft nie.
 */
export async function wegAusWebsite(code: string, weg: Gespraechsweg, lauf: Lauf = sqlPool): Promise<{ ok: boolean; email: string | null }> {
  try {
    const { leadCodeLesen } = await import("./fiaon-lead-weg");
    const v = await leadCodeLesen(code, { lauf }).catch(() => null);
    if (!v) return { ok: false, email: null };
    // E-487: die Nummer der Anfrage mit ihrem Land (nie eine als +1 gelesene deutsche Handynummer).
    const [a] = (await lauf`SELECT telefon, land, ip FROM fiaon_anfragen WHERE id = ${v.anfrageId}`.catch(() => [])) as any[];
    const schluessel = nummerDerAnfrage(a ?? { telefon: v.telefon }) ?? `anfrage-${v.anfrageId}`;
    await zeileMerken(schluessel, { anfrageId: v.anfrageId, firmaId: v.firmaId, optinQuelle: weg === "whatsapp" ? "website_whatsapp" : null }, lauf);
    await wegSetzen(schluessel, weg, "website", lauf);
    return { ok: true, email: v.email || null };
  } catch (e) {
    console.error("[MARA-BUSINESS] Weg von der Website:", String((e as Error)?.message || e).slice(0, 160));
    return { ok: false, email: null };
  }
}

/**
 * Die Welten getrennt halten (waSenden, vor jeder Vorlage): Business-Vorlagen (fiaon_gl_*) nur an Business-Kontakte,
 * Privat-Vorlagen (fiaon_kk_*, fiaon_kkb_*) nie an einen Business-Kontakt. null = darf. Kann es nicht geprüft werden, gilt
 * für Business-Vorlagen „nein“ und für Privat-Vorlagen der alte Weg.
 */
export async function vorlageWeltSperre(vorlage: string, nummer: string, personId: number | null, lauf: Lauf = sqlPool): Promise<string | null> {
  const global = /^fiaon_gl_/.test(vorlage);
  const privat = /^fiaon_kkb?_/.test(vorlage);
  if (!global && !privat) return null;
  const k = await businessKontakt(nummer, personId, lauf);
  if (global && !k) return "Business-Vorlage nur an Business-Kontakte (E-481).";
  if (privat && k) return "Privat-Vorlage nie an einen Business-Kontakt (E-481) — Mara Business übernimmt.";
  return null;
}

/**
 * Website-Formular mit WhatsApp-Satz: das Ja zu WhatsApp an der Nummer merken (Begrüßung bzw. Terminnachricht darf dann raus).
 * E-487 (09.11.2026): MIT der Anfrage (Buchung über den Link oder eine offene Anfrage, „lieber ein Anruf“) — vorher immer
 * NULL, die Terminnachricht erreichte keinen. Die Nummer wird mit dem Land gelesen; ist es derselbe Anschluss wie die Nummer
 * der Anfrage, gilt die Nummer der Anfrage („deren Meta-Nummer nehmen“). Gibt die gemerkte Nummer zurück. Wirft nie.
 */
export async function websiteOptinMerken(ein: { anfrageId: number | null; telefon: string; land?: string | null; satz?: string | null }, lauf: Lauf = sqlPool): Promise<string | null> {
  try {
    const eingabe = anfrageNummer(ein.telefon, ein.land ?? null);
    let anfrage: string | null = null;
    if (ein.anfrageId) {
      const [a] = (await lauf`SELECT telefon, land, ip FROM fiaon_anfragen WHERE id = ${ein.anfrageId} AND art = 'global'`.catch(() => [])) as any[];
      anfrage = nummerDerAnfrage(a);
    }
    const nummer = waJaNummer({ anfrage, eingabe });
    if (!nummer) return null;
    await zeileMerken(nummer, { anfrageId: ein.anfrageId, optinQuelle: "website", optinText: ein.satz ?? null }, lauf);
    return nummer;
  } catch (e) {
    console.error("[MARA-BUSINESS] Website-Ja:", String((e as Error)?.message || e).slice(0, 160));
    return null;
  }
}

/** E-487: Ergebnisse, nach denen ein Ja am Telefon zählt — nur ein Gespräch mit ihm (erreicht), nie „kein Interesse“. */
export const TELEFON_JA_ERGEBNISSE = ["erreicht_interesse", "erreicht_termin", "erreicht_antrag"] as const;

/**
 * E-487 (09.11.2026): DAS JA AM TELEFON — im Firmen-Cockpit hakt die anrufende Person „Möchte auch per WhatsApp (am Telefon
 * gefragt)“, nachdem sie GLOBAL_WA_TELEFON_SATZ vorgelesen hat. Gemerkt an der Nummer der Anfrage (die angerufene Nummer,
 * wenn es ein anderer Anschluss ist) mit Quelle „telefon:<Name>“ (wer), Zeit (wann) und dem vorgelesenen Satz (was). Die
 * Begrüßung schickt der Takt (8–20 Uhr, alle Sperren wie immer); mit Termin die Terminnachricht. Wirft nie.
 */
export async function telefonOptinMerken(ein: { anfrageId: number; firmaId: number | null; telefon: string | null; wer: string; englisch?: boolean }, lauf: Lauf = sqlPool): Promise<{ ok: boolean; nummer: string | null; grund: string | null }> {
  try {
    const [a] = (await lauf`SELECT telefon, land, ip FROM fiaon_anfragen WHERE id = ${ein.anfrageId} AND art = 'global'`.catch(() => [])) as any[];
    if (!a) return { ok: false, nummer: null, grund: "Zu dieser Firma gibt es keine Global-Anfrage." };
    const eingabe = ein.telefon ? anfrageNummer(ein.telefon, a.land ? String(a.land) : null) : null;
    const nummer = waJaNummer({ anfrage: nummerDerAnfrage(a), eingabe });
    if (!nummer) return { ok: false, nummer: null, grund: "Keine Handynummer — auf ein Festnetz geht kein WhatsApp." };
    const wer = String(ein.wer || "Team").replace(/\s+/g, " ").trim().slice(0, 80) || "Team";
    await zeileMerken(nummer, {
      anfrageId: ein.anfrageId, firmaId: ein.firmaId, optinQuelle: `telefon:${wer}`,
      optinText: ein.englisch ? GLOBAL_WA_TELEFON_SATZ.en : GLOBAL_WA_TELEFON_SATZ.de,
    }, lauf);
    return { ok: true, nummer, grund: null };
  } catch (e) {
    console.error("[MARA-BUSINESS] Ja am Telefon:", String((e as Error)?.message || e).slice(0, 160));
    return { ok: false, nummer: null, grund: "Das Ja konnte gerade nicht gespeichert werden — bitte noch einmal." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS STEUERPULT (Chefbüro › Lead-Motor, Karte „Mara Business“) — kein neuer Raum
// ═══════════════════════════════════════════════════════════════════════════
export interface MbStand {
  an: boolean; taktAn: boolean; nummer: string | null; ab: string | null;
  vorlagen: { name: string; kategorie: string; status: string }[];
  zahlen: { kontakte: number; willkommen7: number; mail: number; whatsapp: number; telefon: number; antworten7: number };
}
const MB_VORLAGEN_NAMEN = ["fiaon_gl_willkommen", "fiaon_gl_termin", "fiaon_gl_erinnerung", "fiaon_gl_nicht_erreicht", "fiaon_gl_nachfrage", "fiaon_gl_antwort"];

export async function mbStand(lauf: Lauf = sqlPool): Promise<MbStand> {
  await mbSchema(lauf);
  const { vorlagenStand } = await import("./fiaon-whatsapp");
  const { WA_VORLAGEN } = await import("@shared/fiaon-lead-texte");
  const meta = await vorlagenStand().catch(() => [] as { name: string; status: string; kategorie: string }[]);
  const vorlagen = MB_VORLAGEN_NAMEN.map((n) => {
    const m = meta.find((x) => x.name === n);
    const v = WA_VORLAGEN.find((x) => x.name === n);
    return { name: n, kategorie: m?.kategorie || v?.kategorie || "", status: m?.status || "noch nicht eingereicht" };
  });
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS kontakte,
           COUNT(*) FILTER (WHERE willkommen_status = 'gesendet' AND willkommen_am > NOW() - INTERVAL '7 days')::int AS willkommen7,
           COUNT(*) FILTER (WHERE weg = 'mail')::int AS mail, COUNT(*) FILTER (WHERE weg = 'whatsapp')::int AS whatsapp,
           COUNT(*) FILTER (WHERE weg = 'telefon')::int AS telefon
      FROM fiaon_wa_global`.catch(() => [{}])) as any[];
  const [a] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_ki_nutzung WHERE dienst = ${MB_DIENST} AND created_at > NOW() - INTERVAL '7 days'`.catch(() => [{ n: 0 }])) as any[];
  return {
    an: await mbAn(lauf), taktAn: istAn(await einstellung(MB_SCHLUESSEL.taktAn, lauf)), nummer: await mbNummer(lauf),
    ab: (await einstellung(MB_SCHLUESSEL.ab, lauf)) || null, vorlagen,
    zahlen: { kontakte: Number(z?.kontakte ?? 0), willkommen7: Number(z?.willkommen7 ?? 0), mail: Number(z?.mail ?? 0), whatsapp: Number(z?.whatsapp ?? 0), telefon: Number(z?.telefon ?? 0), antworten7: Number(a?.n ?? 0) },
  };
}

export async function mbSchalten(welcher: "an" | "takt", an: boolean, lauf: Lauf = sqlPool): Promise<MbStand> {
  await einstellungSetzen(welcher === "an" ? MB_SCHLUESSEL.an : MB_SCHLUESSEL.taktAn, an ? "1" : "0", lauf);
  return mbStand(lauf);
}

/** „Mara testen“: Maras Antwort auf eine Frage — mit einem erfundenen Musterlead, ohne Versand. */
export async function mbTrockenlauf(frage: string): Promise<{ antwort: string; funde: string[]; weg: string | null; uebergabe: string | null }> {
  const { kiAufruf, antwortLesen } = await import("./fiaon-postmeister-agent");
  const { kiModell } = await import("./fiaon-ki-kasse");
  const { sendePruefung } = await import("./fiaon-whatsapp");
  const z = await freieZeiten();
  const auftrag = businessAuftrag({
    anrede: "Herr Muster", firma: "Muster GmbH", email: "max@muster.example", antworten: ["Was planen Sie mit Ihrer US-Gesellschaft? — Beides"],
    weg: null, termin: null, freieZeiten: z.alle.slice(0, 8).map((x) => `${x.text} [${x.tag} ${x.zeit}]`), link: "https://fiaon.com/g/Ab3dEf7hJk",
    ersteAntwort: true, englisch: /^\s*(hello|hi|dear|good)\b/i.test(frage), erzaehlt: [],
    anweisung: String((await einstellung(MB_SCHLUESSEL.anweisung)) ?? "").trim() || null,
  });
  const j = await kiAufruf({ dienst: MB_DIENST, modell: kiModell("whatsapp"), schema: MB_SCHEMA, aufwand: "low", maxTokens: 3000, person: null,
    nachrichten: [{ role: "system", content: auftrag }, { role: "user", content: String(frage).slice(0, 1500) }] });
  const obj = antwortLesen(j, "Mara Business (Test)");
  const antwort = String(obj?.antwort ?? "").trim();
  return { antwort, funde: [...sendePruefung(antwort), ...businessWand(antwort, { ersteAntwort: true })], weg: obj?.weg ?? null, uebergabe: obj?.uebergabe ?? null };
}
