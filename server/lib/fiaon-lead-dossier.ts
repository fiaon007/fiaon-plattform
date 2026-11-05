// ═══════════════════════════════════════════════════════════════════════════
// DAS LEAD-DOSSIER AN JUSTIN (E-476 Scheibe 1+2, 05.11.2026)
//
// Justin (04.11.2026): „Ich möchte für jeden Business-Kunden, der sich einträgt, eine E-Mail bekommen mit allen
// Details zu den Kunden und kurzen Backcheck — wer ist das? Seriös? Unternehmensgröße? Wichtige Infos —, damit ich
// bestens informiert bin, wenn ich den Lead anrufe.“
//
// ── DER BEFUND (Kartierung 04.11.) ────────────────────────────────────────────
// Zu den Business-Anfragen seit 01.11. bekam Justin keine Meldung. Daniel bekam je Lead eine Auftrag-Mail mit Codes
// („vorhaben_3“), die Antworten standen nirgends im Klartext, und keiner prüfte, wer hinter der Anfrage steht.
//
// ── DER WEG (jetzt) ─────────────────────────────────────────────────────────
//   Eingang (Meta-Global-Formular, Website-Anfrage → globalAnfrageAnnehmen; Global-Buchung → globalTerminBuchen)
//     → leadDossierAnstossen: Zeile in fiaon_lead_dossier, NICHT abgewartet (der Eingang scheitert nie daran)
//     → Basis ohne KI (≤ 30 s): Klartext, Kontakt, Quelle, kostenloser Check mit drei Fakten (Firma gefunden? Mail
//       passt? Telefon-Land?), Bestand, Hinweis „Privatkunde/Beschwerde?“, wer ruft wann an, Cockpit-Link
//     → Hintergrund-Check mit Websuche (fiaon-lead-hintergrund.ts, höchstens ~150 s) — klappt er nicht (Pause,
//       Claude-Rückweg, Deckel, Frist), geht die Basis trotzdem raus: „KI-Check folgt“ bzw. „nicht verfügbar“
//     → EINE Mail an js@ (eigeneMailSenden), Betreff-Stamm „Lead: <Firma oder Name> · <Temperatur>“, alle weiteren
//       Meldungen zum Lead im selben Faden (Re: + In-Reply-To/References; lehnt Brevo die Kopfzeilen ab, hält der Betreff)
//   Sicherheitsnetz: der Lauf lead_dossier alle 2 Minuten (nurMitErgebnis + Stundenpuls) — fehlende Zeilen ab dem
//   Zählbeginn, Fehlversuche (mit Wartezeit 2/15/60 Min., danach Alarm), der KI-Nachtrag (höchstens EIN KI-Aufruf
//   gleichzeitig, eine Mail nur, wenn er Neues bringt).
//
// ── DIE REGELN ─────────────────────────────────────────────────────────────
//   · KEINE FLUT ALTER LEADS: Zählbeginn lead_dossier_ab = Einschaltzeit. Die offenen Alt-Leads kommen höchstens als
//     EINE Sammel-Mail (abschaltbar: lead_dossier_sammel_an), nie einzeln (Gutachten 0, Mangel 10); ein Meta-Lead aus
//     „Rückstand nachholen“ bekommt nie ein Einzel-Dossier.
//   · Nur im Betrieb (CRONS_AN): Ein lokaler Prüflauf ruft globalAnfrageAnnehmen und darf dabei nichts senden
//     (Gutachten 0, Mangel 11). Die Vorschau rendert nur.
//   · Schema: Migration 128 + dieselbe DDL hier — sie läuft im Anstoß und im Lauf, nie im Eingang (Mangel 22).
//   · Websites nur über den Netzschutz (impressumLesen/sicherAbrufen), Freemail nie als Firmen-Website, Register
//     nur bei brauchbarer Firma, Details nur bei eindeutigem aktiven Treffer, Credits mit Monatszähler und fester
//     Reserve für den Bestellweg (Mangel 13).
//   · Das Dossier geht nur an Justin, nie an den Lead. Keine Zinszahl, keine Zusage, kein Bank-Vorbehalt (E-468).
//   · Nie in fiaon_radar_firmen schreiben (radarPostLauf würde Justins Mails mit dem Lead einordnen).
//
// ── NACHBESSERUNG NACH DREI GUTACHTEN (05.11.2026) ─────────────────────────
//   · KI-Nachtrag: Die Lage (Not-Aus, Claude-Rückweg, Pause DIESES Anbieters, 30 Min. nach der Pause, Kasse, Tages- und
//     Stundendeckel) wird VOR dem Anspruch gelesen — ein Versuch ohne KI-Aufruf zählt nicht. Pause/Rückweg/Deckel warten
//     bis 48 h (alle 15 Min. ein Blick), dann „entfallen“ mit Cockpit-Zeile.
//   · Höchstens EIN KI-Check gleichzeitig im ganzen Betrieb (Sperrzeile „ki“), Faden-Lesen, KI und Versand je Firma
//     nacheinander (Sperrzeile „firma:<id>“) — auch bei einer Flut gleichzeitiger Leads hält der 8-$-Deckel.
//   · KI nur mit einem Beleg für eine Firma (Rechtsform, Register, Impressum mit Registernummer, Firmen-Mail mit
//     Mailserver) — nie für eine Privatperson mit eigener Domain, nie für eine Wegwerf-Adresse. KI-Vorgabe AUS, bis der
//     Satz in der Datenschutzerklärung live ist (Gutachten Sicherheit) — ein Klick im Lead-Motor schaltet sie ein.
//   · Versand: Wartezeit 2/15/60 Minuten, nach dem dritten Fehlschlag ein System-Alarm (Lagezimmer) und ein Fehler in
//     der Lauf-Historie; die Sammel-Mail höchstens dreimal.
//   · Die Mail: Kopf in zwei Zeilen (wann · woher · Nummer; Temperatur · Firma · Mail · Land · Warnzeichen), Paketwunsch
//     zuerst, Anruf ab dem EINGANG gerechnet (nicht ab dem Versand) und mit dem letzten Anruf aus dem Cockpit, Knopf
//     „Ich rufe selbst an“ (schließt Daniels Auftrag) statt einer Aufgabe an Justin, Links nur zu Cockpit und Quellen.
//   · Aufbewahrung: basis und ki werden nach 180 Tagen geleert, wenn aus dem Lead kein Kunde wurde.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, randomBytes } from "node:crypto";
import { sqlPool } from "./db-pool";
import { CRONS_AN } from "./fiaon-crons";
import { absoluteUrl } from "../fiaon-base-url";
import {
  firmaBrauchbar, firmenDomain, mailDomainAus, istFreemail, istWegwerf, landAusTelefon, telefonLesbar, antwortenAusText,
  antwortenSortieren, antwortZeile, domainPasstZurFirma, metaBlockAusText, paketwunschAus, leadTemperatur, privatOderBeschwerde,
  privatUrteil, leadAnzeigeName, fadenBetreff, fadenAntwortBetreff, namenForm, firmenKern, rechtsformIm, registerBudget,
  registerCreditsErlaubt, registerMonatSchluessel, einzelDossierFaellig, sammelKandidat, anrufFenster, vorDemFenster, berlinZeit,
  naechsterVersuchMinuten, linksEntschaerfen, ANRUF_ERGEBNIS_TEXT, LEAD_DOSSIER_SCHLUESSEL as S, LEAD_DOSSIER_VORGABE as V,
  TEMPERATUR_WORT, type LeadAntwort, type LeadKanal, type LeadTemperatur, type MetaFrageDef, type TelefonLand,
} from "@shared/fiaon-global-lead";
import { produktkategorie } from "@shared/fiaon-produktkategorie";
import {
  hintergrundPruefen, kiLage, hatNeues, type HintergrundErgebnis, type HintergrundAusgang, type HintergrundEingabe, type KiAussage,
} from "./fiaon-lead-hintergrund";
import type { EigeneMail } from "./fiaon-brevo";

type Lauf = typeof sqlPool;

/** Die Dossiers gehen an Justin (wie AUFRUF_MELDUNG_AN in fiaon-global-angebot-aufrufe.ts). */
export const DOSSIER_AN = "js@fiaon.com";
const ALARM = "lead-dossier:versand";

// ── Der Versand (Prüfstand-Haken) ───────────────────────────────────────────
type Versand = (m: EigeneMail) => Promise<{ ok: boolean; messageId: string | null; grund?: string; ohneKopfzeilen?: boolean }>;
let versandAttrappe: Versand | null = null;
/** Prüfstand: den Versand ersetzen (null = Brevo über eigeneMailSenden). */
export function dossierVersandSetzen(f: Versand | null): void { versandAttrappe = f; }
async function mailSenden(m: EigeneMail): Promise<{ ok: boolean; messageId: string | null; grund?: string; ohneKopfzeilen?: boolean }> {
  if (versandAttrappe) return versandAttrappe(m);
  const { eigeneMailSenden } = await import("./fiaon-brevo");
  return eigeneMailSenden(m);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA (gleich Migration 128) — nie im Eingangs-Pfad
// ═══════════════════════════════════════════════════════════════════════════
let schemaBereit: Promise<void> | null = null;
export function leadDossierSchema(lauf: Lauf = sqlPool): Promise<void> {
  if (!schemaBereit) {
    schemaBereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_lead_dossier (
          id BIGSERIAL PRIMARY KEY,
          anlass TEXT NOT NULL,
          anlass_id INTEGER NOT NULL,
          anfrage_id INTEGER,
          termin_id INTEGER,
          firma_id INTEGER,
          person_id INTEGER,
          kanal TEXT,
          eingang_am TIMESTAMPTZ,
          antworten JSONB,
          hinweis JSONB,
          basis JSONB,
          ki JSONB,
          temperatur TEXT,
          status TEXT NOT NULL DEFAULT 'offen',
          versuche INTEGER NOT NULL DEFAULT 0,
          laeuft_seit TIMESTAMPTZ,
          naechster_versuch_am TIMESTAMPTZ,
          grund TEXT,
          ki_status TEXT,
          ki_versuche INTEGER NOT NULL DEFAULT 0,
          ki_grund TEXT,
          ki_kosten_cents NUMERIC,
          ki_am TIMESTAMPTZ,
          ki_naechster_am TIMESTAMPTZ,
          faden_betreff TEXT,
          mail_basis_am TIMESTAMPTZ,
          mail_basis_id TEXT,
          mail_ki_am TIMESTAMPTZ,
          mail_ki_id TEXT,
          selbst_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (anlass, anlass_id)
        )`;
      // Nachbesserung 05.11.2026 — für Prüf-Datenbanken, die die Tabelle schon in der ersten Fassung haben.
      await lauf`ALTER TABLE fiaon_lead_dossier ADD COLUMN IF NOT EXISTS naechster_versuch_am TIMESTAMPTZ`;
      await lauf`ALTER TABLE fiaon_lead_dossier ADD COLUMN IF NOT EXISTS ki_naechster_am TIMESTAMPTZ`;
      await lauf`ALTER TABLE fiaon_lead_dossier ADD COLUMN IF NOT EXISTS selbst_am TIMESTAMPTZ`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_dossier_status_idx ON fiaon_lead_dossier (status, created_at)`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_dossier_firma_idx ON fiaon_lead_dossier (firma_id, created_at) WHERE firma_id IS NOT NULL`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_dossier_ki_idx ON fiaon_lead_dossier (ki_status, created_at)`;
      // Sperrzeilen: höchstens EIN KI-Check gleichzeitig („ki“), je Firma eine Verarbeitung („firma:<id>“). Eine Zeile mit
      // Ablaufzeit statt einer gehaltenen Verbindung — ein abgestürzter Prozess sperrt höchstens bis „bis“.
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_lead_dossier_sperre (
          schluessel TEXT PRIMARY KEY,
          bis TIMESTAMPTZ NOT NULL,
          wer TEXT
        )`;
    })().catch((e) => { schemaBereit = null; throw e; });
  }
  return schemaBereit;
}

// ── Sperrzeilen (Gutachten Technik + Sicherheit 05.11.2026) ────────────────
/** Nimmt die Sperre, wenn sie frei (oder abgelaufen) ist — atomar über ON CONFLICT … WHERE. null = besetzt. */
export async function sperreNehmen(schluessel: string, sekunden: number, lauf: Lauf = sqlPool): Promise<string | null> {
  const wer = `${process.pid}-${randomBytes(5).toString("hex")}`;
  const [r] = (await lauf`
    INSERT INTO fiaon_lead_dossier_sperre (schluessel, bis, wer)
    VALUES (${schluessel}, NOW() + ${Math.max(5, Math.round(sekunden))}::int * INTERVAL '1 second', ${wer})
    ON CONFLICT (schluessel) DO UPDATE SET bis = EXCLUDED.bis, wer = EXCLUDED.wer
     WHERE fiaon_lead_dossier_sperre.bis < NOW()
    RETURNING wer`.catch(() => [])) as any[];
  return r?.wer === wer ? wer : null;
}
export async function sperreFrei(schluessel: string, wer: string, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`UPDATE fiaon_lead_dossier_sperre SET bis = NOW() - INTERVAL '1 second' WHERE schluessel = ${schluessel} AND wer = ${wer}`.catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
// EINSTELLUNGEN (fiaon_settings) — Vorgabe: Dossier AN, Sammel-Mail AN, KI AUS (bis der Datenschutz-Satz live ist)
// ═══════════════════════════════════════════════════════════════════════════
export interface SammelStand { gesendetAm: string | null; fehlversuche: number; letzterVersuch: string | null; laeuftSeit: string | null; nichtsAm: string | null }
export interface DossierEinstellungen {
  an: boolean; kiAn: boolean; sammelAn: boolean; ab: string | null; sammelAm: string | null; sammel: SammelStand;
  kiDeckelUsd: number; kiFristS: number; kiStundeMax: number; registerMonat: number; registerReserve: number; anAdresse: string;
}

const istAus = (v: unknown) => /^(0|aus|false|nein|off)$/i.test(String(v ?? "").trim());
const istAn = (v: unknown) => /^(1|an|true|ja|on)$/i.test(String(v ?? "").trim());

/** Der Merker der Sammel-Mail: '' offen · ISO = gesendet · „laeuft:<ISO>“ · „fehler:<n>:<ISO>“ · „nichts:<ISO>“ (nichts offen). Rein. */
export function sammelStandLesen(wert: string | null | undefined): SammelStand {
  const v = String(wert ?? "").trim();
  const leer: SammelStand = { gesendetAm: null, fehlversuche: 0, letzterVersuch: null, laeuftSeit: null, nichtsAm: null };
  if (!v) return leer;
  let m = /^nichts:(.+)$/.exec(v);
  if (m) return { ...leer, nichtsAm: m[1] };
  m = /^fehler:(\d+):(.+)$/.exec(v);
  if (m) return { ...leer, fehlversuche: Number(m[1]) || 1, letzterVersuch: m[2] };
  m = /^laeuft:(.+)$/.exec(v);
  if (m) return { ...leer, laeuftSeit: m[1] };
  return Number.isFinite(Date.parse(v)) ? { ...leer, gesendetAm: v } : { ...leer, gesendetAm: v };
}

export async function dossierEinstellungen(lauf: Lauf = sqlPool): Promise<DossierEinstellungen> {
  const schluessel = [S.an, S.kiAn, S.sammelAn, S.ab, S.sammelAm, S.kiDeckelUsd, S.kiFristS, S.kiStundeMax, S.registerMonat, S.registerReserve, S.an_adresse];
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key = ANY(${schluessel as unknown as string[]})`.catch(() => [])) as any[];
  const w = new Map<string, string>(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  const zahl = (k: string, vorgabe: number, min: number, max: number) => {
    const n = Number(w.get(k));
    return w.has(k) && Number.isFinite(n) && n >= min && n <= max ? n : vorgabe;
  };
  const adresse = String(w.get(S.an_adresse) ?? "").trim().toLowerCase();
  const sammel = sammelStandLesen(w.get(S.sammelAm));
  return {
    // KI nur, wenn sie ausdrücklich eingeschaltet ist (Gutachten Sicherheit 05.11.2026: erst mit dem Datenschutz-Satz).
    an: !istAus(w.get(S.an)), kiAn: istAn(w.get(S.kiAn)), sammelAn: !istAus(w.get(S.sammelAn)),
    ab: w.get(S.ab) || null, sammelAm: sammel.gesendetAm, sammel,
    kiDeckelUsd: zahl(S.kiDeckelUsd, V.kiDeckelUsd, 0, 50),
    kiFristS: zahl(S.kiFristS, V.kiFristS, 60, 300),
    kiStundeMax: zahl(S.kiStundeMax, V.kiStundeMax, 1, 200),
    registerMonat: zahl(S.registerMonat, V.registerMonat, 0, 100_000),
    registerReserve: zahl(S.registerReserve, V.registerReserve, 0, 100_000),
    // Nur eine fiaon.com-Adresse — das Dossier trägt Kundendaten und geht nie nach außen.
    anAdresse: /^[a-z0-9._%+-]+@fiaon\.com$/.test(adresse) ? adresse : DOSSIER_AN,
  };
}

export async function dossierEinstellungSetzen(key: string, wert: string, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

/**
 * Der Zählbeginn: Wer das Dossier zum ersten Mal laufen lässt, setzt ihn auf JETZT (einmal, atomar). Ab da gibt es
 * einzelne Dossiers; alles davor ist Altbestand (höchstens die eine Sammel-Mail).
 */
export async function zaehlbeginnSichern(lauf: Lauf = sqlPool): Promise<string> {
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${S.ab}, ${new Date().toISOString()}, NOW())
    ON CONFLICT (key) DO NOTHING`;
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${S.ab}`) as any[];
  return String(r?.value ?? new Date().toISOString());
}

// ═══════════════════════════════════════════════════════════════════════════
// DER EINGANG — was wir über den Lead wissen, bevor wir prüfen
// ═══════════════════════════════════════════════════════════════════════════
export interface EingangsHinweis {
  kanal: LeadKanal;
  antworten?: LeadAntwort[];
  formular?: string | null;
  plattform?: string | null;
  anzeige?: string | null;
  kampagne?: string | null;
  metaLeadId?: string | null;
  /** Nachbesserung: wann Meta den Lead angelegt hat (created_time) — ein alter Lead aus dem Rückstand kommt nicht einzeln. */
  metaErstellt?: string | null;
  /** Der Weg des Meta-Leads (meta_webhook | meta_nachhol | meta_rueckstand). */
  weg?: string | null;
}

export interface DossierAnstoss {
  anlass: "anfrage" | "termin";
  anlassId: number;
  firmaId?: number | null;
  personId?: number | null;
  hinweis?: EingangsHinweis | null;
}

interface Eingang {
  anlass: "anfrage" | "termin";
  anlassId: number;
  anfrageId: number | null;
  terminId: number | null;
  kanal: LeadKanal;
  eingangAm: string;
  /** Der echte Eingang bei Meta (created_time) — sonst null. */
  echterEingang: string | null;
  weg: string | null;
  ip: string | null;
  name: string;
  email: string;
  telefon: string;
  firma: string;
  personId: number | null;
  nachricht: string | null;
  wunschzeit: string | null;
  paketwunsch: string | null;
  formular: string | null;
  plattform: string | null;
  anzeige: string | null;
  kampagne: string | null;
  antworten: LeadAntwort[];
  istTest: boolean;
  termin: { beginn: string; status: string; quelle: string; herkunft: string | null; agent: string | null } | null;
  zustaendigAgentId: number | null;
}

const zeile = (text: string | null | undefined, re: RegExp): string | null => {
  const m = re.exec(String(text ?? ""));
  return m ? m[1].trim().slice(0, 300) : null;
};
const alsDefs = (v: unknown): MetaFrageDef[] | null => {
  let o: any = v;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  return Array.isArray(o) ? (o as MetaFrageDef[]) : null;
};
const isoOderNull = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(v as any);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};

async function eingangLesen(a: DossierAnstoss, lauf: Lauf): Promise<Eingang | null> {
  const h = a.hinweis ?? null;
  if (a.anlass === "anfrage") {
    const [r] = (await lauf`
      SELECT a.id, a.name, a.email, a.firma, a.telefon, a.text, a.person_id, a.ip, a.created_at, a.zustaendig_agent_id,
             COALESCE(a.ist_test, FALSE) AS ist_test, m.meta_lead_id, m.formular_id, m.erstellt_am AS meta_erstellt, m.weg AS meta_weg,
             f.name AS formular_name, f.fragen AS formular_fragen
        FROM fiaon_anfragen a
        LEFT JOIN LATERAL (SELECT meta_lead_id, formular_id, erstellt_am, weg FROM fiaon_meta_leads WHERE global_anfrage_id = a.id ORDER BY gesehen_am LIMIT 1) m ON TRUE
        LEFT JOIN fiaon_meta_formulare f ON f.id = m.formular_id
       WHERE a.id = ${a.anlassId} AND a.art = 'global'`) as any[];
    if (!r) return null;
    const text = String(r.text ?? "");
    const meta = r.ip === "meta-sofortformular" || !!r.meta_lead_id || h?.kanal === "meta";
    const defs = alsDefs(r.formular_fragen);
    // globalAnfrageAnnehmen: Kopf (Paketwunsch, Wunschzeit, Sprache), Leerzeile, dann der Text (Website: die Nachricht;
    // Meta: der Block des Formulars). Antworten gibt es NUR aus dem Meta-Block (Gutachten Sicherheit 05.11.2026).
    const leer = text.indexOf("\n\n");
    const kopf = leer >= 0 ? text.slice(0, leer) : text;
    const rumpf = leer >= 0 ? text.slice(leer + 2).trim() : "";
    const antworten = meta
      ? (h?.antworten?.length ? antwortenSortieren(h.antworten, defs) : antwortenAusText(metaBlockAusText(text), defs))
      : [];
    const block = metaBlockAusText(text);
    return {
      anlass: "anfrage", anlassId: Number(r.id), anfrageId: Number(r.id), terminId: null,
      kanal: meta ? "meta" : "website", eingangAm: new Date(r.created_at).toISOString(),
      echterEingang: isoOderNull(r.meta_erstellt) ?? isoOderNull(h?.metaErstellt), weg: r.meta_weg ?? h?.weg ?? null,
      ip: r.ip ? String(r.ip) : null,
      name: String(r.name ?? "").trim(), email: String(r.email ?? "").trim().toLowerCase(), telefon: String(r.telefon ?? "").trim(),
      firma: String(r.firma ?? "").trim(), personId: r.person_id ? Number(r.person_id) : (a.personId ?? null),
      nachricht: meta ? null : (rumpf ? rumpf.slice(0, 3000) : null),
      wunschzeit: zeile(kopf, /^Wunschzeit:\s*(.+)$/m),
      paketwunsch: paketwunschAus(kopf),
      formular: h?.formular ?? r.formular_name ?? zeile(block, /Meta-Sofortformular\s+„([^“]+)“/),
      plattform: h?.plattform ?? zeile(block, /Meta-Sofortformular(?:\s+„[^“]+“)?\s+\(([a-z_]+)\)/),
      anzeige: h?.anzeige ?? zeile(block, /^Anzeige:\s*(.+)$/m),
      kampagne: h?.kampagne ?? zeile(block, /^Kampagne:\s*(.+)$/m),
      antworten, istTest: !!r.ist_test, termin: null,
      zustaendigAgentId: r.zustaendig_agent_id ? Number(r.zustaendig_agent_id) : null,
    };
  }
  const [t] = (await lauf`
    SELECT t.id, t.beginn, t.status, t.quelle, t.herkunft, t.notiz, t.created_at, t.person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.contact_name, p.company_name, '') AS name,
           COALESCE(p.primary_email, '') AS email, COALESCE(p.primary_phone, '') AS telefon, COALESCE(p.company_name, '') AS firma,
           ag.name AS agent_name
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.id = ${a.anlassId}`) as any[];
  if (!t) return null;
  const notiz = String(t.notiz ?? "");
  return {
    anlass: "termin", anlassId: Number(t.id), anfrageId: null, terminId: Number(t.id),
    kanal: t.quelle === "gruender" ? "justin" : "buchung", eingangAm: new Date(t.created_at).toISOString(),
    echterEingang: null, weg: null, ip: null,
    name: String(t.name ?? "").trim(), email: String(t.email ?? "").trim().toLowerCase(), telefon: String(t.telefon ?? "").trim(),
    firma: zeile(notiz, /^Firma:\s*(.+)$/m) ?? String(t.firma ?? "").trim(),
    personId: Number(t.person_id),
    nachricht: zeile(notiz, /^Thema:\s*(.+)$/m), wunschzeit: null, paketwunsch: paketwunschAus(notiz),
    formular: null, plattform: null, anzeige: null, kampagne: null, antworten: h?.antworten ?? [],
    istTest: false,
    termin: { beginn: new Date(t.beginn).toISOString(), status: String(t.status), quelle: String(t.quelle), herkunft: t.herkunft ?? null, agent: t.agent_name ?? null },
    zustaendigAgentId: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE BASIS — kostenloser Check, Bestand, Anruf (ohne KI)
// ═══════════════════════════════════════════════════════════════════════════
export type Fakt = "ja" | "nein" | "unklar";

export interface RegisterKurz {
  status: "eindeutig" | "mehrdeutig" | "keiner" | "geloescht" | "nicht_abgefragt" | "ausgefallen";
  grund: string | null;
  land: string | null;
  quelle: string | null;
  treffer: number;
  name?: string | null;
  rechtsform?: string | null;
  register?: string | null;
  ort?: string | null;
  aktiv?: string | null;
  zweck?: string | null;
  vertreter?: string[];
  vertreterPasst?: boolean | null;
  /** Der passende Vertreter mit Funktion („Erika Muster (Geschäftsführerin)“) — Gutachten Justin-Sicht. */
  vertreterTreffer?: string | null;
  website?: string | null;
  /** Gesucht wurde mit dem Namen aus dem Impressum (Firmenfeld unbrauchbar, Mail von der Firmen-Domain). */
  ausImpressum?: boolean;
  credits: number;
}

export interface ImpressumKurz {
  status: "gelesen" | "nicht_gelesen" | "keine_domain" | "fehler";
  grund: string | null;
  url: string | null;
  nenntFirma: boolean | null;
  nenntPerson: boolean | null;
  registernummer: string | null;
  ustId: string | null;
  ort: string | null;
  /** Der Firmenname im Impressum (mit Rechtsform) — für die Registersuche, wenn das Firmenfeld unbrauchbar ist. */
  firmaName?: string | null;
}

export interface BestandBestellung { ref: string; paket: string | null; kategorie: "konto" | "auskunft" | "global"; bezahlt: boolean; archiviert: boolean; am: string | null; betreuer: string | null }
export interface BestandTermin { id: number; beginn: string; status: string; quelle: string; quelleText: string; agent: string | null; kommend: boolean }

export interface DossierBasis {
  version: 2;
  anlass: "anfrage" | "termin";
  anlassId: number;
  anfrageId: number | null;
  terminId: number | null;
  firmaId: number | null;
  personIds: number[];
  kanal: LeadKanal;
  eingangAm: string;
  echterEingang: string | null;
  istTest: boolean;
  kontakt: {
    name: string; email: string; domain: string | null; freemail: boolean; wegwerf: boolean; firmenDomain: string | null;
    mx: "mx" | "a" | "keine" | "unklar" | null; telefon: string; telefonLesbar: string; tel: TelefonLand;
    /** Eine abweichende Nummer aus Bestellung oder Person (Gutachten Justin-Sicht: der Knopf wählt dann die bekannte). */
    bekannt: { e164: string; lesbar: string; quelle: string } | null;
  };
  firma: { formular: string; brauchbar: boolean; grund: string | null; rechtsform: string | null; anzeige: string };
  quelle: { text: string; formular: string | null; plattform: string | null; anzeige: string | null; kampagne: string | null };
  antworten: LeadAntwort[];
  paketwunsch: string | null;
  nachricht: string | null;
  wunschzeit: string | null;
  temperatur: { wert: LeadTemperatur; grund: string };
  register: RegisterKurz;
  impressum: ImpressumKurz;
  registerBestaetigt: boolean;
  fakten: { firma: Fakt; firmaText: string; mail: Fakt; mailText: string; telefonText: string };
  bestand: {
    privat: BestandBestellung[];
    globalKunde: boolean;
    angebote: { ref: string; status: string; gueltigBis: string | null; auftrag: string | null }[];
    anfragen: { id: number; am: string; status: string | null }[];
    termine: BestandTermin[];
    supportTermine: number;
    cockpit: { status: string | null; letzte: string | null; terminOhneKalender: boolean } | null;
  };
  hinweis: { beschwerde: string[]; schwach: string[]; privat: string[]; zahlend: boolean; art: "beschwerde" | "privat" | null; imBetreff: boolean } | null;
  /** Signalwörter ohne Hinweis — eine leise Zeile, ändert weder Betreff noch Temperatur. */
  signalLeise: string[];
  anruf: { wer: string | null; text: string; auftrag: string | null; offen: boolean };
  /** Darf der KI-Check laufen? Nur mit einem Beleg für eine Firma (Gutachten Sicherheit 05.11.2026). */
  kiErlaubt: { erlaubt: boolean; grund: string | null };
  /** Viele Anfragen derselben IP in kurzer Zeit — kein KI-Check (Schutz vor Kosten-Missbrauch). */
  kiBremse: string | null;
  termin: Eingang["termin"];
  cockpitUrl: string | null;
}

export interface BasisOptionen {
  lauf?: Lauf;
  /** Register und Impressum über das Netz (sonst „nicht abgefragt“). */
  netz?: boolean;
  /** false = nur lesen (Vorschau): kein Cache-Schreiben, kein Credit-Zähler, nichts in der Datenbank. */
  schreiben?: boolean;
  firmaId?: number | null;
  jetzt?: Date;
}

const KANAL_TEXT: Record<LeadKanal, string> = {
  meta: "Meta-Formular", website: "Website-Anfrage (Rückruf-Formular auf fiaon.com)",
  buchung: "Gesprächs-Buchung im Global-Kalender", justin: "Buchung über fiaon.com/justin",
};
const KANAL_KURZ: Record<LeadKanal, string> = { meta: "Meta", website: "Website", buchung: "Global-Kalender", justin: "fiaon.com/justin" };
const PLATTFORM_TEXT: Record<string, string> = { instagram: "Instagram", ig: "Instagram", facebook: "Facebook", fb: "Facebook", messenger: "Messenger", audience_network: "Audience Network" };

function quelleText(e: Eingang): string {
  if (e.kanal === "meta") {
    return [
      `Meta-Formular${e.formular ? ` „${e.formular}“` : ""}`,
      e.plattform ? (PLATTFORM_TEXT[e.plattform] ?? e.plattform) : null,
      e.anzeige ? `Anzeige ${e.anzeige}` : null,
      e.kampagne ? `Kampagne ${e.kampagne}` : null,
    ].filter(Boolean).join(" · ");
  }
  return KANAL_TEXT[e.kanal];
}

const key9 = (tel: string) => { const d = tel.replace(/\D/g, ""); return d.length >= 7 ? d.slice(-9) : ""; };
const nurZiffern = (s: unknown) => String(s ?? "").replace(/\D/g, "");

async function credits(kosten: number, e: DossierEinstellungen, schreiben: boolean, lauf: Lauf): Promise<boolean> {
  const budget = registerBudget({ monat: e.registerMonat, reserve: e.registerReserve });
  const key = registerMonatSchluessel(berlinZeit().iso);
  if (!schreiben) {
    const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${key}`.catch(() => [])) as any[];
    return registerCreditsErlaubt({ verbraucht: Number(r?.value) || 0, budget, kosten });
  }
  await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, '0', NOW()) ON CONFLICT (key) DO NOTHING`;
  // Atomar: nur buchen, wenn es ins Budget passt — zwei Läufe gleichzeitig überziehen es nicht.
  const [r] = (await lauf`
    UPDATE fiaon_settings SET value = (COALESCE(NULLIF(value, ''), '0')::int + ${kosten})::text, updated_at = NOW()
     WHERE key = ${key} AND COALESCE(NULLIF(value, ''), '0')::int + ${kosten} <= ${budget}
    RETURNING value`) as any[];
  return !!r;
}

/** Das Land für die Registersuche: Telefon (DE/AT/CH), sonst die Endung der Firmen-Domain. */
function registerLand(tel: TelefonLand, domain: string | null): "DE" | "AT" | "CH" | null {
  if (tel.land === "DE" || tel.land === "AT" || tel.land === "CH") return tel.land;
  const tld = /\.(de|at|ch)$/.exec(String(domain ?? ""))?.[1];
  return tld ? (tld.toUpperCase() as "DE" | "AT" | "CH") : null;
}

/** Welcher Vertreter ist der Anfragende? Alle Teile des Namens (≥ 3 Zeichen) oder der Nachname. Rein. */
export function vertreterFinden(vertreter: readonly string[], name: string): string | null {
  const nach = namenForm(name).split(" ").filter((x) => x.length >= 3);
  if (!nach.length) return null;
  return vertreter.find((v) => { const n = namenForm(v); return nach.every((teil) => n.includes(teil)); })
    ?? vertreter.find((v) => ` ${namenForm(v)} `.includes(` ${nach[nach.length - 1]} `)) ?? null;
}

async function registerPruefen(e: Eingang, firma: { suchName: string; brauchbar: boolean; ausImpressum?: boolean }, tel: TelefonLand, domain: string | null,
  einst: DossierEinstellungen, opt: Required<Pick<BasisOptionen, "netz" | "schreiben">> & { lauf: Lauf }): Promise<RegisterKurz> {
  const leer = (status: RegisterKurz["status"], grund: string, land: string | null = null): RegisterKurz => ({ status, grund, land, quelle: null, treffer: 0, credits: 0, ausImpressum: !!firma.ausImpressum });
  if (!firma.brauchbar) return leer("nicht_abgefragt", "kein brauchbarer Firmenname");
  if (!opt.netz) return leer("nicht_abgefragt", "in dieser Ansicht nicht abgefragt");
  const land = registerLand(tel, domain);
  if (!land) return leer("nicht_abgefragt", "Land unklar — Telefon und Domain zeigen nicht nach DE/AT/CH");
  const { REIHENFOLGE, firmenSuchen, firmaDetail } = await import("./firmensuche/index");
  const { sucheSaeubern, SUCHE_MIN } = await import("./firmensuche/typen");
  if (!REIHENFOLGE[land].some((a) => a.aktiv())) {
    return leer("nicht_abgefragt", land === "AT" ? "Österreich: kein Registerzugang (das Firmenbuch braucht einen Schlüssel)" : `kein Registeranbieter für ${land} eingerichtet`, land);
  }
  const q = sucheSaeubern(firma.suchName);
  if (q.length < SUCHE_MIN) return leer("nicht_abgefragt", "Firmenname zu kurz für die Suche", land);
  const { firmensucheCacheLesen, firmensucheCacheSchreiben } = await import("../routes/fiaon-firmensuche");
  const kostet = land === "DE"; // openregister: 1 Credit je Suche, 10 je Detail — die Schweiz ist frei
  let verbraucht = 0;

  const schluessel = `suche:${land}:${q.toLowerCase()}`;
  const fund = await firmensucheCacheLesen<{ quelle: string; quelleText: string; treffer: any[] }>(schluessel);
  let treffer: any[]; let quelle: string;
  if (fund?.antwort && Array.isArray(fund.antwort.treffer) && (fund.antwort.treffer.length || fund.alterMin <= 60)) {
    treffer = fund.antwort.treffer; quelle = fund.antwort.quelle;
  } else {
    if (kostet && !(await credits(1, einst, opt.schreiben, opt.lauf))) return leer("nicht_abgefragt", "Credit-Reserve für den Bestellweg — das Monatsbudget des Dossiers ist aufgebraucht", land);
    if (kostet) verbraucht += 1;
    const erg = await firmenSuchen(land, q, { fristMs: 4000 });
    if (erg.quelle === "keine") return { ...leer("ausgefallen", "das Register antwortet gerade nicht", land), credits: verbraucht };
    treffer = erg.treffer; quelle = erg.quelle;
    if (opt.schreiben) void firmensucheCacheSchreiben(schluessel, { quelle: erg.quelle, quelleText: erg.quelleText, treffer: erg.treffer });
  }
  const kern = firmenKern(firma.suchName);
  const gleich = treffer.filter((t) => firmenKern(t?.name) === kern);
  const aktiv = (t: any) => !t?.status || /aktiv/i.test(String(t.status));
  // Ein einzelner ähnlicher Treffer zählt nur bei einem unverwechselbaren Namenskern (≥ 4 Zeichen) — sonst „kein genauer Treffer“.
  const kandidaten = gleich.length ? gleich : (treffer.length === 1 && kern.length >= 4 && ` ${firmenKern(treffer[0]?.name)} `.includes(` ${kern} `) ? treffer : []);
  const aktive = kandidaten.filter(aktiv);
  const basis = { land, quelle, treffer: treffer.length, credits: verbraucht, ausImpressum: !!firma.ausImpressum };
  if (!treffer.length) return { status: "keiner", grund: "kein Eintrag unter diesem Namen", ...basis };
  if (!kandidaten.length) return { status: "keiner", grund: `kein genauer Treffer (${treffer.length} ähnliche Namen)`, ...basis };
  if (!aktive.length) {
    const t = kandidaten[0];
    return { status: "geloescht", grund: `im Register als „${String(t.status ?? "nicht aktiv")}“ geführt`, name: t.name, register: t.register ?? null, ort: t.ort ?? null, aktiv: t.status ?? null, ...basis };
  }
  if (aktive.length > 1) return { status: "mehrdeutig", grund: `${aktive.length} aktive Einträge mit diesem Namen`, ...basis };
  const t = aktive[0];
  const kurz: RegisterKurz = { status: "eindeutig", grund: null, name: t.name, rechtsform: t.rechtsform ?? null, register: t.register ?? null, ort: t.ort ?? null, aktiv: t.status ?? "aktiv", ...basis };
  // Details (Vertreter, Gegenstand, Website) nur bei genau EINEM aktiven Treffer — und nur mit Budget.
  const dSchluessel = `detail:${land}:${quelle}:${String(t.id).toLowerCase()}`;
  const dFund = await firmensucheCacheLesen<any>(dSchluessel);
  let detail: any = dFund?.antwort?.name ? dFund.antwort : null;
  if (!detail) {
    if (kostet && !(await credits(10, einst, opt.schreiben, opt.lauf))) return { ...kurz, grund: "Details nicht abgefragt (Credit-Reserve für den Bestellweg)", credits: verbraucht };
    if (kostet) verbraucht += 10;
    const d = await firmaDetail(land, quelle, String(t.id), { fristMs: 8000 }).catch(() => ({ firma: null }));
    detail = d.firma;
    if (detail && opt.schreiben) void firmensucheCacheSchreiben(dSchluessel, detail);
  }
  kurz.credits = verbraucht;
  if (!detail) return kurz;
  const vertreter: string[] = (Array.isArray(detail.vertreter) ? detail.vertreter : [])
    .map((v: any) => `${String(v?.name ?? [v?.vorname, v?.nachname].filter(Boolean).join(" ")).trim()}${v?.funktion ? ` (${v.funktion})` : ""}`)
    .filter((s: string) => s.trim()).slice(0, 4);
  const trefferV = vertreter.length ? vertreterFinden(vertreter, e.name) : null;
  return {
    ...kurz,
    name: detail.name ?? kurz.name, rechtsform: detail.rechtsform ?? kurz.rechtsform,
    register: [detail.registernummer, detail.registergericht].filter(Boolean).join(", ") || kurz.register,
    ort: detail.ort ?? kurz.ort, zweck: detail.zweck ? String(detail.zweck).slice(0, 220) : null,
    vertreter, vertreterPasst: vertreter.length ? !!trefferV : null, vertreterTreffer: trefferV, website: detail.website ?? null,
  };
}

/** Die Gründe von impressumLesen in Worten für Justin (dort stehen Sätze für Kunden in Sie-Form). */
const IMPRESSUM_GRUND: Readonly<Record<string, string>> = {
  nichts_erkannt: "auf der Website ist kein Impressum erkennbar", kein_text: "die Website liefert keinen lesbaren Text",
  robots: "die Website verbietet automatisches Lesen (robots.txt)", private_adresse: "die Adresse zeigt ins interne Netz",
  zeit: "die Website antwortet nicht rechtzeitig", netz: "die Website ist nicht erreichbar", eingabe: "keine gültige Adresse",
  weiterleitungen: "die Website leitet zu oft weiter", inhaltstyp: "die Adresse liefert keine Seite", status: "die Website meldet einen Fehler",
};

async function impressumPruefen(e: Eingang, firma: { formular: string; brauchbar: boolean }, domain: string | null, land: string | null, netz: boolean): Promise<ImpressumKurz> {
  const leer = (status: ImpressumKurz["status"], grund: string): ImpressumKurz => ({ status, grund, url: null, nenntFirma: null, nenntPerson: null, registernummer: null, ustId: null, ort: null, firmaName: null });
  if (!domain) return leer("keine_domain", "keine Firmen-Domain (Freemail oder keine Adresse)");
  if (!netz) return leer("nicht_gelesen", "in dieser Ansicht nicht gelesen");
  const { impressumLesen } = await import("./firmensuche/impressum");
  // Regex-Modus (ki: null) — kostenlos; jeder Wert muss wörtlich auf der Seite stehen. Abruf nur über den Netzschutz.
  const erg = await impressumLesen(`https://${domain}`, land, { ki: null }).catch(() => null);
  if (!erg || !erg.ok) return leer("fehler", erg && !erg.ok ? (IMPRESSUM_GRUND[erg.grund] ?? String(erg.error).replace(/\s*Bitte .*$/, "").slice(0, 120)) : "Website nicht erreichbar");
  const text = namenForm(erg.text ?? "");
  const kern = firmenKern(firma.formular);
  const nachname = namenForm(e.name).split(" ").filter((x) => x.length >= 3).pop() ?? "";
  const fName = erg.firma.name ? String(erg.firma.name).slice(0, 160) : null;
  return {
    status: "gelesen", grund: null, url: erg.seite,
    nenntFirma: firma.brauchbar && kern.length >= 3 ? ` ${text} `.includes(` ${kern} `) : null,
    nenntPerson: nachname ? ` ${text} `.includes(` ${nachname} `) : null,
    registernummer: erg.firma.registernummer ?? null, ustId: erg.firma.ustId ?? null, ort: erg.firma.ort ?? null,
    firmaName: fName && rechtsformIm(fName) ? fName : null,
  };
}

/** Stimmen die Registernummern von Impressum und Register überein (nur die Ziffern und Buchstaben)? Rein. */
export function registerNummerGleich(impressum: string | null | undefined, register: string | null | undefined): boolean {
  const a = String(impressum ?? "").toUpperCase().match(/(HR[AB]|FN|CHE)[\s.-]*([0-9][0-9.\-A-Z]*)/);
  const b = String(register ?? "").toUpperCase().match(/(HR[AB]|FN|CHE)[\s.-]*([0-9][0-9.\-A-Z]*)/);
  if (!a || !b) return false;
  return a[1] === b[1] && a[2].replace(/[^0-9A-Z]/g, "") === b[2].replace(/[^0-9A-Z]/g, "");
}

/**
 * Die drei Fakten des kostenlosen Checks — jede Zeile mit Grund. Rein.
 * Nachbesserung (Gutachten Sicherheit + Justin-Sicht 05.11.2026): Das Impressum auf der Domain des Leads kontrolliert der
 * Lead selbst — „Firma gefunden: ja“ gibt es nur mit dem Register (gern über den Namen aus dem Impressum gesucht, Muster
 * „Nachname im Firmenfeld, Mail von der Firmen-Domain“). Sonst steht dort „unklar — laut eigener Website …, im Register
 * nicht bestätigt“ mit allem, was das Impressum nennt.
 */
export function faktenBilden(ein: {
  firma: { brauchbar: boolean; grund: string | null; rechtsform?: string | null; formular?: string | null }; register: RegisterKurz; impressum: ImpressumKurz;
  freemail: boolean; wegwerf?: boolean; domain: string | null; firmenDomain: string | null; mx: DossierBasis["kontakt"]["mx"]; tel: TelefonLand;
  registerBestaetigt?: boolean;
}): DossierBasis["fakten"] {
  const r = ein.register, i = ein.impressum;
  let firma: Fakt = "unklar"; let firmaText = "";
  const impressumBeleg = i.status === "gelesen" && (!!i.nenntFirma || !!i.registernummer || !!i.ustId || !!i.firmaName);
  if (r.status === "eindeutig") {
    firma = "ja";
    firmaText = `Register: ${[r.name, r.register, r.ort].filter(Boolean).join(" · ")}${r.aktiv ? ` · ${r.aktiv}` : ""}`
      + (r.ausImpressum ? ` (gesucht mit dem Namen aus dem Impressum von ${ein.firmenDomain})` : "")
      + (r.vertreterPasst === true ? " · die anfragende Person ist als Vertretung eingetragen" : r.vertreterPasst === false ? " · die anfragende Person steht NICHT unter den Vertretern" : "")
      + (ein.registerBestaetigt ? " · das Impressum nennt dieselbe Registernummer" : "");
  } else if (r.status === "geloescht") {
    firma = "nein"; firmaText = `Achtung: ${r.grund}${r.register ? ` (${r.register})` : ""}`;
  } else if (impressumBeleg) {
    firma = "unklar";
    firmaText = `laut eigener Website: Impressum von ${ein.firmenDomain}${i.firmaName ? ` nennt „${i.firmaName}“` : i.nenntFirma ? " nennt die Firma" : ""}`
      + `${i.registernummer ? ` · ${i.registernummer}` : ""}${i.ustId ? ` · USt-IdNr. ${i.ustId}` : ""}${i.nenntPerson ? " · nennt die Person" : ""}`
      + ` — im Register nicht bestätigt${r.status === "nicht_abgefragt" || r.status === "ausgefallen" ? ` (${r.grund})` : r.status === "keiner" || r.status === "mehrdeutig" ? ` (Register: ${r.grund})` : ""}`;
  } else if (r.status === "keiner") {
    // „nein“ nur, wenn es unter diesem Namen GAR keinen Eintrag gibt und der Name eine eingetragene Rechtsform trägt —
    // ein Einzelunternehmen ohne Rechtsform steht oft in keinem Register, ähnliche Namen sind kein Beweis.
    firma = ein.firma.brauchbar && r.treffer === 0 && !!ein.firma.rechtsform ? "nein" : "unklar";
    firmaText = `Register: ${r.grund}${!ein.firma.rechtsform && ein.firma.brauchbar ? " — ohne Rechtsform im Namen (vielleicht ein Einzelunternehmen)" : ""}`;
  } else if (!ein.firma.brauchbar && !ein.firmenDomain) {
    firma = "unklar"; firmaText = ein.firma.grund ?? "keine Firma angegeben";
  } else {
    const teile = [r.status === "mehrdeutig" ? `Register: ${r.grund}` : r.status === "nicht_abgefragt" || r.status === "ausgefallen" ? `Register nicht abgefragt: ${r.grund}` : null,
      i.status === "gelesen" ? `Impressum gelesen${i.registernummer ? ` (${i.registernummer})` : ""}${i.nenntFirma === false ? ", nennt die Firma aber nicht" : ""}`
        : i.status !== "keine_domain" ? `Impressum nicht gelesen: ${i.grund ?? "unbekannt"}` : null];
    firmaText = teile.filter(Boolean).join(" · ") || "nicht prüfbar";
  }
  let mail: Fakt = "unklar"; let mailText = "";
  if (!ein.domain) { mail = "unklar"; mailText = "keine Mailadresse"; }
  else if (ein.wegwerf) { mail = "nein"; mailText = `Wegwerf-Adresse (${ein.domain}) — nicht dauerhaft erreichbar`; }
  else if (ein.freemail) { mail = "nein"; mailText = `Freemail-Adresse (${ein.domain}) — keine Firmen-Mail`; }
  else if (ein.mx === "keine") { mail = "nein"; mailText = `${ein.domain} nimmt keine Post an (kein Mailserver)`; }
  else if (i.status === "gelesen" && i.nenntFirma) { mail = "ja"; mailText = `Firmen-Domain ${ein.domain}, das Impressum dort nennt die Firma`; }
  else if (r.website && ein.firmenDomain && String(r.website).toLowerCase().includes(ein.firmenDomain)) { mail = "ja"; mailText = `Firmen-Domain ${ein.domain} = Website im Register`; }
  else if (ein.firmenDomain && (domainPasstZurFirma(ein.firmenDomain, ein.firma.formular) || (r.status === "eindeutig" && domainPasstZurFirma(ein.firmenDomain, r.name)))) {
    mail = "ja"; mailText = `Firmen-Domain ${ein.domain}${ein.mx === "mx" ? " (Mailserver ✓)" : ""} passt zum Firmennamen${i.status === "gelesen" ? "" : ` — Impressum nicht gelesen${i.grund ? ` (${i.grund})` : ""}`}`;
  }
  else if (i.status === "gelesen" && i.nenntPerson) { mail = "ja"; mailText = `Firmen-Domain ${ein.domain}, das Impressum dort nennt die Person`; }
  else if (i.status === "gelesen") { mail = "unklar"; mailText = `Firmen-Domain ${ein.domain} — das Impressum nennt ${i.nenntFirma === false ? "eine andere Firma oder die Firma nicht wörtlich" : "weder Firma noch Person"}`; }
  else { mail = "unklar"; mailText = `Firmen-Domain ${ein.domain}${ein.mx === "mx" ? " (Mailserver ✓)" : ""} — Impressum ${i.grund ? `nicht lesbar: ${i.grund}` : "nicht gelesen"}`; }
  const telefonText = ein.tel.pruefen ? `${ein.tel.text} — Nummer prüfen: ${ein.tel.pruefen}` : ein.tel.text;
  return { firma, firmaText, mail, mailText, telefonText };
}

/**
 * Gibt es einen Beleg für eine FIRMA (Gutachten Sicherheit 05.11.2026)? Rechtsform im Namen, ein Registereintrag, ein
 * Impressum mit Registernummer/USt-IdNr./Firmenname mit Rechtsform oder eine Firmen-Mail mit Mailserver. Nie bei einer
 * Wegwerf-Adresse; nie für einen Platzhalter („Privatperson · …“, „(Firma noch offen)“) ohne Register oder Impressum. Rein.
 */
export function kiErlaubtFuer(b: Pick<DossierBasis, "kontakt" | "firma" | "register" | "impressum">): { erlaubt: boolean; grund: string | null } {
  if (b.kontakt.wegwerf) return { erlaubt: false, grund: "Wegwerf-Adresse — kein Hintergrund-Check" };
  const r = b.register, i = b.impressum;
  const impressumBeleg = i.status === "gelesen" && (!!i.registernummer || !!i.ustId || !!i.firmaName);
  if (!b.firma.brauchbar) {
    if (r.status === "eindeutig" || impressumBeleg) return { erlaubt: true, grund: null };
    return { erlaubt: false, grund: `${b.firma.grund ?? "keine Firma angegeben"} — zu Privatpersonen recherchieren wir nicht` };
  }
  if (b.firma.rechtsform || ["eindeutig", "mehrdeutig", "geloescht"].includes(r.status) || impressumBeleg || (!!b.kontakt.firmenDomain && b.kontakt.mx === "mx")) {
    return { erlaubt: true, grund: null };
  }
  return { erlaubt: false, grund: "kein Beleg für eine Firma (Name ohne Rechtsform, kein Registereintrag, keine Firmen-Mail mit Mailserver)" };
}

const QUELLE_KURZ = (q: string, text: Record<string, string>) => String(text[q] ?? q).split(/ — | \(/)[0].trim();

async function bestandLesen(e: Eingang, firmaId: number | null, lauf: Lauf): Promise<{ bestand: DossierBasis["bestand"]; personIds: number[]; nummern: { e164: string; quelle: string }[] }> {
  const k9 = key9(e.telefon);
  const personen = (await lauf`
    SELECT DISTINCT COALESCE(p.merged_into_person_id, p.id) AS id
      FROM fiaon_person_aliases a JOIN fiaon_persons p ON p.id = a.person_id
     WHERE (a.kind = 'email' AND ${e.email} <> '' AND a.value_norm = ${e.email})
        OR (a.kind = 'phone' AND ${k9} <> '' AND a.value_norm = ${k9})
     LIMIT 10`.catch(() => [])) as any[];
  const ids = Array.from(new Set([...personen.map((p) => Number(p.id)), ...(e.personId ? [e.personId] : [])])).filter((x) => x > 0);
  const apps = (await lauf`
    SELECT a.ref, a.pack_name, a.pack_key, a.type, a.payment_status, a.archived_at, a.created_at, a.phone,
           ag.name AS betreuer
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(p.assigned_agent_id, a.assigned_agent_id)
     WHERE (a.person_id = ANY(${ids}::int[]) OR (${e.email} <> '' AND LOWER(a.email) = ${e.email}))
       AND a.merged_into IS NULL AND NOT COALESCE(a.ist_entwurf, FALSE)
     ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 5`.catch(() => [])) as any[];
  const personTel = ids.length ? ((await lauf`SELECT primary_phone FROM fiaon_persons WHERE id = ANY(${ids}::int[]) AND primary_phone IS NOT NULL LIMIT 3`.catch(() => [])) as any[]) : [];
  let globalKunde = false;
  if (ids.length) {
    try {
      const gk = await import("./fiaon-global-kunde");
      await gk.globalKundeBereit();
      const [g] = (await lauf.unsafe(`SELECT BOOL_OR(${gk.globalKundeSql("p.id")}) AS ja FROM fiaon_persons p WHERE p.id = ANY($1::int[])`, [ids])) as any[];
      globalKunde = !!g?.ja;
    } catch { /* ohne Global-Kunden-Regel bleibt es „nein“ — die Angebote stehen trotzdem da */ }
  }
  const angebote = (await lauf`
    SELECT angebot_ref, status, gueltig_bis, auftrag_ref FROM fiaon_global_angebote
     WHERE person_id = ANY(${ids}::int[])
        OR (${e.email} <> '' AND LOWER(COALESCE(CASE WHEN jsonb_typeof(kunde) = 'object' THEN kunde->>'email' END, '')) = ${e.email})
     ORDER BY created_at DESC LIMIT 3`.catch(() => [])) as any[];
  const anfragen = (await lauf`
    SELECT id, created_at, status FROM fiaon_anfragen
     WHERE id <> ${e.anfrageId ?? 0} AND NOT COALESCE(ist_test, FALSE) AND art IN ('global', 'termin', 'kontakt')
       AND ((${e.email} <> '' AND LOWER(COALESCE(email, '')) = ${e.email})
         OR (${k9} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(telefon, ''), '\\D', '', 'g'), 9) = ${k9}))
     ORDER BY created_at DESC LIMIT 5`.catch(() => [])) as any[];
  const termine = (await lauf`
    SELECT t.id, t.beginn, t.status, t.quelle, ag.name AS agent
      FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.person_id = ANY(${ids}::int[]) AND t.id <> ${e.terminId ?? 0} AND t.beginn > NOW() - INTERVAL '60 days'
     ORDER BY t.beginn DESC LIMIT 4`.catch(() => [])) as any[];
  const [sup] = ids.length ? ((await lauf`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ANY(${ids}::int[]) AND quelle = 'support'`.catch(() => [])) as any[]) : [];
  let quelleTexte: Record<string, string> = {};
  try { quelleTexte = (await import("./fiaon-termin-meldung")).QUELLE_TEXT; } catch { /* dann der rohe Wert */ }
  const jetzt = Date.now();
  const termineB: BestandTermin[] = termine.map((t) => {
    const beginn = new Date(t.beginn);
    return {
      id: Number(t.id), beginn: beginn.toISOString(), status: String(t.status), quelle: String(t.quelle),
      quelleText: QUELLE_KURZ(String(t.quelle), quelleTexte), agent: t.agent ?? null,
      kommend: beginn.getTime() >= jetzt && !/^(abgesagt|storniert)$/.test(String(t.status)),
    };
  });
  let cockpit: DossierBasis["bestand"]["cockpit"] = null;
  if (firmaId) {
    const [f] = (await lauf`SELECT status FROM fiaon_firmen_leads WHERE id = ${firmaId}`.catch(() => [])) as any[];
    const [l] = (await lauf`
      SELECT art, ergebnis, notiz, agent_name, created_at FROM fiaon_firmen_log
       WHERE firma_id = ${firmaId} AND NOT (art = 'global' AND ergebnis IN ('anfrage', 'dossier', 'selbst'))
       ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
    cockpit = {
      status: f?.status ?? null,
      letzte: l ? `${berlinKurz(l.created_at)} ${l.agent_name || "System"}: ${l.art === "anruf" ? (ANRUF_ERGEBNIS_TEXT[String(l.ergebnis)] ?? String(l.ergebnis ?? "").replace(/_/g, " ")) : String(l.ergebnis ?? l.art)}${l.notiz ? ` — ${linksEntschaerfen(String(l.notiz).slice(0, 140))}` : ""}` : null,
      // Gutachten Justin-Sicht: „termin“ im Cockpit, aber kein kommender Termin im Kalender.
      terminOhneKalender: f?.status === "termin" && !termineB.some((t) => t.kommend),
    };
  }
  const nummern: { e164: string; quelle: string }[] = [];
  for (const a of apps) if (a.phone) nummern.push({ e164: String(a.phone), quelle: `Bestellung ${a.ref}` });
  for (const p of personTel) if (p.primary_phone) nummern.push({ e164: String(p.primary_phone), quelle: "Kundenakte" });
  return {
    personIds: ids, nummern,
    bestand: {
      privat: apps.map((a) => ({
        ref: String(a.ref), paket: a.pack_name ?? null, kategorie: produktkategorie({ type: a.type, ref: a.ref, pack_key: a.pack_key }),
        bezahlt: a.payment_status === "paid", archiviert: !!a.archived_at, am: a.created_at ? new Date(a.created_at).toISOString() : null,
        betreuer: a.betreuer ?? null,
      })),
      globalKunde,
      angebote: angebote.map((a) => ({ ref: String(a.angebot_ref), status: String(a.status ?? ""), gueltigBis: a.gueltig_bis ? new Date(a.gueltig_bis).toISOString().slice(0, 10) : null, auftrag: a.auftrag_ref ?? null })),
      anfragen: anfragen.map((a) => ({ id: Number(a.id), am: new Date(a.created_at).toISOString(), status: a.status ?? null })),
      termine: termineB, supportTermine: Number(sup?.n) || 0,
      cockpit,
    },
  };
}

function berlinKurz(d: Date | string): string {
  const z = berlinZeit(new Date(d));
  return `${z.datum} ${String(z.stunde).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
}
/** „Mi 04.11., 21:13“ */
function berlinMitTag(d: Date | string): string {
  const z = berlinZeit(new Date(d));
  return `${z.wochentag.slice(0, 2)} ${z.datum}, ${String(z.stunde).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
}

async function firmaFinden(e: Eingang, lauf: Lauf): Promise<number | null> {
  const [f] = (await lauf`
    SELECT id FROM fiaon_firmen_leads
     WHERE (${e.personId}::int IS NOT NULL AND person_id = ${e.personId}::int)
        OR (${e.email} <> '' AND LOWER(COALESCE(email, '')) = ${e.email})
     ORDER BY COALESCE(person_id = ${e.personId}::int, FALSE) DESC, id ASC LIMIT 1`.catch(() => [])) as any[];
  return f ? Number(f.id) : null;
}

/**
 * Wer ruft an, und wann? Nachbesserung (Gutachten Justin-Sicht 05.11.2026): gerechnet ab dem EINGANG, nicht ab dem
 * Versand (sonst stand bei jedem Prüfversand „außerhalb der Bürozeit“), mit dem letzten Anruf aus dem Cockpit und
 * neutral formuliert („Auftrag an …, fällig heute“ statt „Anruf heute“ — das war ein Versprechen).
 */
async function anrufLesen(e: Eingang, firmaId: number | null, lauf: Lauf, jetzt: Date): Promise<DossierBasis["anruf"]> {
  let wer: string | null = null;
  try {
    const { globalZustaendig } = await import("./fiaon-global-termin");
    wer = (await globalZustaendig())?.name ?? null;
  } catch { wer = null; }
  const schluessel = e.anfrageId ? `global-anfrage:${e.anfrageId}` : e.terminId ? `global-termin:${e.terminId}` : null;
  const [a] = schluessel ? ((await lauf`
    SELECT status, zustaendig_name, agent_gelesen_am, faellig_am, ergebnis FROM fiaon_betreiber_todos WHERE schluessel = ${schluessel}`.catch(() => [])) as any[]) : [];
  const auftrag = a ? `Auftrag ${a.status === "erledigt" ? "erledigt" : a.agent_gelesen_am ? "geöffnet" : "noch nicht geöffnet"}` : null;
  if (e.kanal === "justin" || e.kanal === "buchung") {
    return { wer, text: e.termin ? `Termin ${berlinMitTag(e.termin.beginn)} Uhr${e.termin.agent ? ` bei ${e.termin.agent}` : ""} (${e.termin.status}).` : "Termin gebucht.", auftrag, offen: false };
  }
  const name = a?.zustaendig_name || wer;
  const [anruf] = firmaId ? ((await lauf`
    SELECT ergebnis, agent_name, created_at FROM fiaon_firmen_log
     WHERE firma_id = ${firmaId} AND art = 'anruf' ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[]) : [];
  const faellig = a?.faellig_am ? String(a.faellig_am instanceof Date ? a.faellig_am.toISOString() : a.faellig_am).slice(0, 10) : null;
  return {
    ...anrufTextBauen({
      eingangAm: e.echterEingang ?? e.eingangAm, jetzt, name: name ?? null,
      auftrag: a ? { status: String(a.status ?? ""), faellig, ergebnis: a.ergebnis ? String(a.ergebnis) : null } : null,
      anruf: anruf ? { wer: anruf.agent_name ? String(anruf.agent_name) : null, am: new Date(anruf.created_at).toISOString(), ergebnis: String(anruf.ergebnis ?? "") } : null,
    }),
    auftrag,
  };
}

/**
 * Der Satz im Abschnitt ANRUF (rein, Prüfstand). Ab dem EINGANG gerechnet: Kam er in der Bürozeit, steht „Eingang in der
 * Bürozeit“ — auch wenn die Mail (Prüfversand, Wiederholung) nachts rausgeht. „Anruf frühestens …“ nur, solange dieses
 * Fenster noch vor uns liegt. Ein Anruf im Cockpit geht vor.
 */
export function anrufTextBauen(ein: {
  eingangAm: string | Date; jetzt: Date; name: string | null;
  auftrag: { status: string; faellig: string | null; ergebnis: string | null } | null;
  anruf: { wer: string | null; am: string; ergebnis: string } | null;
}): { wer: string | null; text: string; offen: boolean } {
  if (ein.anruf) {
    return {
      wer: ein.name, offen: false,
      text: `${ein.anruf.wer || "Jemand aus dem Team"} hat am ${berlinKurz(ein.anruf.am)} angerufen: ${ANRUF_ERGEBNIS_TEXT[ein.anruf.ergebnis] ?? ein.anruf.ergebnis.replace(/_/g, " ")}.`,
    };
  }
  if (ein.auftrag?.status === "erledigt") {
    return { wer: ein.name, offen: false, text: `Der Auftrag an ${ein.name ?? "das Team"} ist erledigt${ein.auftrag.ergebnis ? `: ${linksEntschaerfen(ein.auftrag.ergebnis.slice(0, 160))}` : ""}.` };
  }
  if (!ein.name) return { wer: null, offen: false, text: "Niemand ist für FIAON Global eingetragen — der Auftrag liegt auf dem Betreiber-Brett." };
  const heute = berlinZeit(ein.jetzt).iso;
  const faellig = ein.auftrag?.faellig ?? null;
  const faelligText = !faellig ? "dringend" : faellig === heute ? "dringend, fällig heute" : `dringend, fällig ${faellig.split("-").reverse().join(".").slice(0, 6)}`;
  const f = anrufFenster(new Date(ein.eingangAm));
  const wannText = f.imDienst
    ? "Eingang in der Bürozeit"
    : vorDemFenster(f.abTag, ein.jetzt) ? `Eingang außerhalb der Bürozeit — Anruf frühestens ${f.text}` : "Eingang außerhalb der Bürozeit";
  return { wer: ein.name, offen: true, text: `Auftrag an ${ein.name} (${faelligText}) — ${wannText}.` };
}

/** Viele Anfragen derselben Adresse (IP) in 15 Minuten? Dann kein KI-Check (Gutachten Sicherheit 05.11.2026). */
async function ipBremse(e: Eingang, lauf: Lauf): Promise<string | null> {
  if (!e.ip || e.anlass !== "anfrage" || e.ip === "meta-sofortformular") return null;
  const [r] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_anfragen
     WHERE art = 'global' AND ip = ${e.ip} AND created_at BETWEEN ${e.eingangAm}::timestamptz - INTERVAL '15 minutes' AND ${e.eingangAm}::timestamptz`.catch(() => [])) as any[];
  return Number(r?.n) > 3 ? "viele Anfragen von derselben Adresse in kurzer Zeit — kein KI-Check (Schutz vor Kosten-Missbrauch)" : null;
}

/** Eine bekannte, abweichende Nummer (Bestellung, Kundenakte) — Gutachten Justin-Sicht 05.11.2026. Rein. */
function bekannteNummer(tel: TelefonLand, roh: string, nummern: { e164: string; quelle: string }[]): DossierBasis["kontakt"]["bekannt"] {
  const eigene = key9(tel.e164 ?? roh);
  // Eine Nummer ohne Ländervorwahl („0664 …“) bekommt die Vorwahl des Leads — nicht pauschal +49.
  const vorwahl = tel.vorwahl && ["+49", "+43", "+41"].includes(tel.vorwahl) ? tel.vorwahl : "+49";
  for (const n of nummern) {
    const t = landAusTelefon(n.e164.trim().startsWith("+") || n.e164.trim().startsWith("00") ? n.e164 : n.e164.trim().replace(/^0(?=[1-9])/, vorwahl));
    const k = key9(t.e164 ?? n.e164);
    if (!k || k === eigene || !t.e164) continue;
    return { e164: t.e164, lesbar: telefonLesbar(t, n.e164), quelle: n.quelle };
  }
  return null;
}

/**
 * Die Basis des Dossiers. Wirft nur, wenn der Eingang fehlt. `netz: false` = ohne Register/Impressum/DNS (schnell),
 * `schreiben: false` = reine Lesung (Vorschau gegen die Produktion).
 */
export async function leadDossierBasis(a: DossierAnstoss, opt: BasisOptionen = {}): Promise<DossierBasis> {
  const lauf = opt.lauf ?? sqlPool;
  const netz = opt.netz !== false;
  const schreiben = opt.schreiben !== false;
  const jetzt = opt.jetzt ?? new Date();
  const e = await eingangLesen(a, lauf);
  if (!e) throw new Error(`${a.anlass} #${a.anlassId} nicht gefunden`);
  const einst = await dossierEinstellungen(lauf);
  const tel = landAusTelefon(e.telefon);
  const domain = mailDomainAus(e.email);
  const wegwerf = istWegwerf(domain);
  const freemail = istFreemail(domain);
  const fDomain = firmenDomain(e.email);
  const fu = firmaBrauchbar(e.firma, e.name);
  const firma = { formular: e.firma, brauchbar: fu.brauchbar, grund: fu.grund, rechtsform: fu.rechtsform, anzeige: leadAnzeigeName(e.firma, e.name) };
  let mx: DossierBasis["kontakt"]["mx"] = null;
  if (fDomain && netz) {
    try { mx = await (await import("./fiaon-mx")).mailDomain(fDomain); } catch { mx = "unklar"; }
  }
  const landFuerImpressum = registerLand(tel, fDomain);
  const regFehler = (err: any): RegisterKurz => ({ status: "ausgefallen", grund: String(err?.message ?? err).slice(0, 120), land: null, quelle: null, treffer: 0, credits: 0 });
  const impFehler = (err: any): ImpressumKurz => ({ status: "fehler", grund: String(err?.message ?? err).slice(0, 120), url: null, nenntFirma: null, nenntPerson: null, registernummer: null, ustId: null, ort: null, firmaName: null });
  let register: RegisterKurz; let impressum: ImpressumKurz;
  if (fu.brauchbar) {
    [register, impressum] = await Promise.all([
      registerPruefen(e, { suchName: e.firma, brauchbar: true }, tel, fDomain, einst, { netz, schreiben, lauf }).catch(regFehler),
      impressumPruefen(e, firma, fDomain, landFuerImpressum, netz).catch(impFehler),
    ]);
  } else {
    // Firmenfeld unbrauchbar, aber eine Firmen-Domain (Gutachten 1, Mangel 12 / Justin-Sicht): erst das Impressum, dann das
    // Register mit dem Firmennamen von dort.
    impressum = await impressumPruefen(e, firma, fDomain, landFuerImpressum, netz).catch(impFehler);
    register = impressum.firmaName
      ? await registerPruefen(e, { suchName: impressum.firmaName, brauchbar: true, ausImpressum: true }, tel, fDomain, einst, { netz, schreiben, lauf }).catch(regFehler)
      : { status: "nicht_abgefragt", grund: "kein brauchbarer Firmenname", land: null, quelle: null, treffer: 0, credits: 0 };
  }
  const registerBestaetigt = register.status === "eindeutig" && registerNummerGleich(impressum.registernummer, register.register);
  const firmaId = opt.firmaId ?? a.firmaId ?? (await firmaFinden(e, lauf));
  const { bestand, personIds, nummern } = await bestandLesen(e, firmaId, lauf);
  const privatBestand = bestand.privat.filter((p) => p.kategorie !== "global");
  const zahlend = privatBestand.some((p) => p.bezahlt);
  // Nur die NACHRICHT — die Wunschzeit („vormittags nicht erreichbar“) ist nie eine Beschwerde (Gutachten Justin-Sicht).
  const signale = privatOderBeschwerde(e.nachricht ?? "");
  const urteil = privatUrteil(signale, { privatBestand: privatBestand.length > 0, zahlend, firmaBrauchbar: fu.brauchbar });
  const kontakt: DossierBasis["kontakt"] = {
    name: e.name, email: e.email, domain, freemail, wegwerf, firmenDomain: fDomain, mx, telefon: e.telefon,
    telefonLesbar: telefonLesbar(tel, e.telefon), tel, bekannt: bekannteNummer(tel, e.telefon, nummern),
  };
  const kiErlaubt = kiErlaubtFuer({ kontakt, firma, register, impressum });
  return {
    version: 2, anlass: e.anlass, anlassId: e.anlassId, anfrageId: e.anfrageId, terminId: e.terminId, firmaId, personIds,
    kanal: e.kanal, eingangAm: e.eingangAm, echterEingang: e.echterEingang, istTest: e.istTest,
    kontakt, firma,
    quelle: { text: quelleText(e), formular: e.formular, plattform: e.plattform, anzeige: e.anzeige, kampagne: e.kampagne },
    antworten: e.antworten, paketwunsch: e.paketwunsch, nachricht: e.nachricht, wunschzeit: e.wunschzeit,
    // Die Temperatur bleibt, was SEINE Antworten sagen — ein Hinweis kommt nur dazu (Gutachten Technik 05.11.2026).
    temperatur: leadTemperatur(e.antworten, e.kanal, { paketwunsch: e.paketwunsch, wunschzeit: e.wunschzeit }),
    register, impressum, registerBestaetigt,
    fakten: faktenBilden({ firma: { ...fu, formular: e.firma }, register, impressum, freemail, wegwerf, domain, firmenDomain: fDomain, mx, tel, registerBestaetigt }),
    bestand,
    hinweis: urteil.hinweis ? { ...signale, zahlend, art: urteil.art, imBetreff: urteil.imBetreff } : null,
    signalLeise: urteil.leise,
    anruf: await anrufLesen(e, firmaId, lauf, jetzt),
    kiErlaubt, kiBremse: await ipBremse(e, lauf),
    termin: e.termin,
    cockpitUrl: firmaId ? absoluteUrl(`/agent/firmen?firma=${firmaId}`) : absoluteUrl("/agent/firmen"),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// „ICH RUFE SELBST AN“ — ein Knopf statt einer Aufgabe an Justin (Gutachten 1 „Kleine Fallen“, Justin-Sicht 05.11.2026)
// Ein signierter Link je Dossier (Muster: Abmeldelink, fiaon-abmelden.ts). GET zeigt nur eine Frage mit Knopf — ein
// Link-Scanner im Postfach löst so nichts aus; erst POST schließt Daniels Auftrag und schreibt eine Cockpit-Zeile. Einmal.
// ═══════════════════════════════════════════════════════════════════════════
function selbstGeheim(): string {
  return process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET || "fiaon-dev-lead-dossier-selbst";
}
function selbstSignatur(id: number): string {
  return createHmac("sha256", selbstGeheim()).update(`lead-dossier-selbst.${id}`).digest("hex").slice(0, 32);
}
export function selbstLink(dossierId: number): string {
  return absoluteUrl(`/api/fiaon/lead-dossier/selbst/${dossierId}.${selbstSignatur(dossierId)}`);
}
export function selbstPruefen(token: string): number | null {
  const [id, sig] = String(token || "").split(".");
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0 || !sig || sig.length !== 32) return null;
  return selbstSignatur(n) === sig ? n : null;
}

/** Schließt Daniels Auftrag („Justin ruft selbst an“) und schreibt eine Cockpit-Zeile. Einmal je Dossier. */
export async function selbstAnrufen(dossierId: number, lauf: Lauf = sqlPool): Promise<{ ok: boolean; text: string; cockpitUrl: string | null }> {
  const [z] = (await lauf`
    UPDATE fiaon_lead_dossier SET selbst_am = NOW(), updated_at = NOW()
     WHERE id = ${dossierId} AND selbst_am IS NULL AND anlass = 'anfrage'
    RETURNING anfrage_id, firma_id`.catch(() => [])) as any[];
  if (!z) {
    const [da] = (await lauf`SELECT selbst_am, firma_id FROM fiaon_lead_dossier WHERE id = ${dossierId}`.catch(() => [])) as any[];
    const cockpit = da?.firma_id ? absoluteUrl(`/agent/firmen?firma=${da.firma_id}`) : null;
    return da?.selbst_am
      ? { ok: true, text: `Schon erledigt (${berlinKurz(da.selbst_am)}): Der Auftrag ist geschlossen, es ruft niemand doppelt an.`, cockpitUrl: cockpit }
      : { ok: false, text: "Dieses Dossier gibt es nicht (mehr).", cockpitUrl: null };
  }
  const cockpitUrl = z.firma_id ? absoluteUrl(`/agent/firmen?firma=${z.firma_id}`) : null;
  const [t] = (await lauf`SELECT id, zustaendig_name FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${z.anfrage_id}`} AND status <> 'erledigt'`.catch(() => [])) as any[];
  let wer = "das Team";
  if (t) wer = t.zustaendig_name || wer;
  // Nachbesserung E-476 (Gutachten Betreiber, Mangel 2): „Ich rufe selbst an“ ist ein Ereignis des EINEN Stands — er schließt den
  // Anruf-Auftrag, den Rückruf der Vertretung und die Aufträge weiterer Anfragen derselben Firma, die Stand-Leiste und die
  // Übersicht sagen „Justin ruft selbst an“, und die Meldeadresse bekommt einen Nachtrag im Faden der Lead-Meldung.
  if (z.anfrage_id) {
    await import("./fiaon-lead-takt")
      .then((m) => m.leadStandSetzen({ anfrageId: Number(z.anfrage_id), firmaId: z.firma_id ? Number(z.firma_id) : null, ereignis: "selbst", wer: { id: null, name: "Justin Schwarzott" } }, lauf))
      .catch((e) => console.error(`[LEAD-DOSSIER] Stand „selbst“ zu #${dossierId}:`, String(e).slice(0, 160)));
  }
  // Rückfall: steht der Auftrag noch offen (Störung oben), schließt er sich hier.
  const [noch] = t ? ((await lauf`SELECT status FROM fiaon_betreiber_todos WHERE id = ${t.id}`.catch(() => [])) as any[]) : [];
  if (t && noch?.status !== "erledigt") {
    const { auftragErledigen } = await import("./fiaon-auftraege");
    await auftragErledigen(Number(t.id), {
      art: "verwaltung", von: "Justin Schwarzott", autorArt: "betreiber",
      ergebnis: "Justin ruft selbst an (Knopf im Lead-Dossier) — bitte nicht zusätzlich anrufen.",
      ereignis: "Justin ruft selbst an",
    }, lauf).catch(() => false);
  }
  if (z.firma_id) {
    await lauf`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
      VALUES (${z.firma_id}, NULL, 'Justin Schwarzott', 'global', 'selbst', ${`Justin ruft selbst an — der Auftrag an ${wer} ist geschlossen.`})`.catch(() => {});
  }
  console.log(`[LEAD-DOSSIER] #${dossierId}: Justin ruft selbst an — Auftrag an ${wer} geschlossen`);
  return { ok: true, text: t ? `Erledigt: Der Auftrag an ${wer} ist geschlossen — es ruft niemand doppelt an.` : "Erledigt. Ein offener Auftrag war nicht da — es ruft niemand doppelt an.", cockpitUrl };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE MAIL — kurz, scannbar, du-Form an Justin (rein: Prüfstand und Vorschau rendern dieselbe Mail)
// ═══════════════════════════════════════════════════════════════════════════
export type DossierArt = "neu" | "weitere" | "termin" | "nachtrag";
export interface DossierMail {
  betreff: string; text: string; knoepfe: { text: string; url: string; leise?: boolean }[]; hinweis?: string;
  /** Nur diese Adressen werden in der Mail klickbar (Cockpit, „Ich rufe selbst an“, die geprüften Quellen). */
  links: string[];
}
export interface MailOptionen {
  art: DossierArt;
  /** Betreff-Stamm des Fadens (aus der ersten Mail) — sonst neu gebildet. */
  stamm?: string | null;
  /** Erste Mail zu diesem Lead (kein Faden vorhanden) — dann ohne „Re:“, auch bei einer Buchung. */
  erste?: boolean;
  kiStatus?: string | null;
  kiGrund?: string | null;
  jetzt?: Date;
  /** Der signierte Link „Ich rufe selbst an“ (nur mit Dossier-Zeile, nie in der Vorschau). */
  selbstUrl?: string | null;
  /** E-476 Scheibe 4: ein Satz, was der Lead von Justin bekommt (Willkommens-Mail aus js@) — leadMailHinweis. */
  leadMail?: string | null;
}

const FAKT_ZEICHEN: Record<Fakt, string> = { ja: "✓", nein: "✗", unklar: "?" };
const FAKT_WORT: Record<Fakt, string> = { ja: "ja", nein: "nein", unklar: "unklar" };

function kiAbschnitt(ki: HintergrundErgebnis, quellen: string[], b: DossierBasis): string[] {
  const nr = (url: string) => { let i = quellen.indexOf(url); if (i < 0) { quellen.push(url); i = quellen.length - 1; } return `[${i + 1}]`; };
  const zeilen: string[] = [];
  const unbekannt: string[] = [];
  const z = (titel: string, a: KiAussage | null) => { if (a) zeilen.push(`– ${titel}: ${a.text} ${nr(a.url)}`); else unbekannt.push(titel); };
  // Auffälligkeiten zuerst — sie sind das Wichtigste (Gutachten Justin-Sicht).
  for (const a of ki.auffaelligkeiten) {
    zeilen.push(a.unbestaetigt
      ? `– Hinweis (unbestätigt, bitte selbst prüfen${a.art ? `, ${a.art.replace(/_/g, " ")}` : ""}): ${a.text} ${nr(a.url)}`
      : `– ACHTUNG${a.art ? ` (${a.art.replace(/_/g, " ")})` : ""}: ${a.text} ${nr(a.url)}`);
  }
  z("Wer", ki.kurz); z("Branche", ki.branche); z("Gründung", ki.gegruendet); z("Sitz", ki.sitz);
  if (ki.mitarbeiter || ki.umsatz) {
    zeilen.push(`– Größe: ${[ki.mitarbeiter ? `${ki.mitarbeiter.text} ${nr(ki.mitarbeiter.url)}` : null, ki.umsatz ? `${ki.umsatz.text} ${nr(ki.umsatz.url)}` : null].filter(Boolean).join(" · ")}`);
  } else unbekannt.push("Größe");
  // Die Rolle aus dem Register ist belegt — dann keine zweite (oft „nicht belegt“) aus der Websuche (Justin-Sicht).
  if (b.register.vertreterPasst !== true && ki.personRolle) zeilen.push(`– Rolle der anfragenden Person: ${ki.personRolle.text} ${nr(ki.personRolle.url)}`);
  z("US-Bezug", ki.usBezug);
  for (const p of ki.presse) zeilen.push(`– Presse${p.datum ? ` (${p.datum})` : ""}: ${p.text} ${nr(p.url)}`);
  for (const bw of ki.bewertungen) zeilen.push(`– Bewertung: ${bw.text} ${nr(bw.url)}`);
  if (!ki.auffaelligkeiten.length) zeilen.push(`– Auffälligkeiten: keine gefunden (${ki.suchen ? `${ki.suchen} Websuche${ki.suchen === 1 ? "" : "n"}` : "Websuche"} nach Insolvenz, Warnlisten, negativer Presse)`);
  if (unbekannt.length) zeilen.push(`– Unbekannt: ${unbekannt.join(", ")}`);
  if (ki.hinweis) zeilen.push(`– ${ki.hinweis}`);
  return zeilen;
}

const KI_STATUS_TEXT: Record<string, string> = {
  folgt: "folgt als Nachtrag, wenn er etwas Neues findet — sonst steht das Ergebnis im Cockpit",
  pausiert: "folgt, sobald die KI wieder läuft (sie ist gerade pausiert)",
  frist: "folgt als Nachtrag (die Websuche brauchte zu lange)",
  unvollstaendig: "folgt als Nachtrag (die KI-Antwort war unvollständig)",
  fehler: "folgt als Nachtrag (ein Versuch ist fehlgeschlagen)",
  anbieter: "nicht verfügbar — die KI läuft gerade über den Claude-Rückweg ohne prüfbare Quellen; neuer Versuch, sobald OpenAI wieder trägt",
  deckel: "heute nicht mehr — der Tagesdeckel für den Check ist erreicht",
  aus: "ausgeschaltet (Lead-Motor: KI-Hintergrund ist aus)",
  keine_firma: "keiner",
  gebremst: "keiner",
  entfallen: "entfallen — die KI war 48 Stunden nicht verfügbar",
  leer: "nichts Verlässliches gefunden",
  vorschau: "in dieser Vorschau ausgeschaltet — im Betrieb steht hier die Websuche mit Quellen (oder „folgt“)",
};
/** Bei diesen Zuständen sagt der Text alles — der Grund kommt nicht noch einmal in Klammern dazu (Justin-Sicht). */
const KI_OHNE_GRUND = new Set(["folgt", "pausiert", "frist", "unvollstaendig", "anbieter", "aus", "entfallen", "leer", "vorschau"]);

/** Der Text eines Zustands ohne Ergebnis — ein Satz, der Grund nur, wo er etwas sagt. Rein. */
export function kiStatusZeile(status: string | null | undefined, grund: string | null | undefined): string {
  const s = String(status ?? "");
  const t = KI_STATUS_TEXT[s];
  if (!t) return grund || "nicht gelaufen";
  if (KI_OHNE_GRUND.has(s) || !grund) return t;
  return `${t} — ${grund}`;
}

/** Der Betreff-Stamm eines Leads (Firma oder Name; Temperatur, mit Privat-Bestand und Hinweis „Privatkunde?“). Rein. */
export function stammFuer(b: Pick<DossierBasis, "firma" | "temperatur" | "hinweis">): string {
  return fadenBetreff(b.firma.anzeige, b.temperatur.wert, { privat: !!b.hinweis?.imBetreff });
}

/** Die Dossier-Mail. Rein — Vorschau, Prüfstand und Versand rendern dieselbe Mail. */
export function leadDossierMail(b: DossierBasis, ki: HintergrundErgebnis | null, opt: MailOptionen): DossierMail {
  const stamm = opt.stamm || stammFuer(b);
  const betreff = opt.art === "neu" || opt.erste ? stamm : fadenAntwortBetreff(stamm);
  const quellen: string[] = [];
  const t: string[] = [];
  const nr = b.anfrageId ? `Anfrage #${b.anfrageId}` : b.terminId ? `Termin #${b.terminId}` : "";
  const name = linksEntschaerfen(b.kontakt.name) || "ohne Namen";
  const firmaText = b.firma.brauchbar ? linksEntschaerfen(b.firma.formular) : (b.firma.grund ?? "keine Firma");
  const plattform = b.quelle.plattform ? (PLATTFORM_TEXT[b.quelle.plattform] ?? b.quelle.plattform) : null;
  const woher = b.kanal === "meta" ? `Meta${plattform ? `/${plattform}` : ""}` : KANAL_KURZ[b.kanal];
  const land = b.kontakt.tel.land ?? (b.kontakt.tel.e164 ? "Ausland" : "Land ?");
  const kommend = b.bestand.termine.find((x) => x.kommend);
  const offeneAngebote = b.bestand.angebote.filter((g) => !/^(angenommen|abgelehnt|abgelaufen|storniert|bezahlt)$/i.test(g.status));
  const zeichen = [
    TEMPERATUR_WORT[b.temperatur.wert],
    `Firma ${FAKT_ZEICHEN[b.fakten.firma]}`, `Mail ${FAKT_ZEICHEN[b.fakten.mail]}`,
    `${land}${b.kontakt.tel.ausland || b.kontakt.tel.pruefen ? " !" : ""}`,
    // Eine unbestätigte Auffälligkeit ist nie ein ACHTUNG (Gutachten Sicherheit 05.11.2026).
    ki?.auffaelligkeiten.length
      ? (ki.auffaelligkeiten.some((a) => !a.unbestaetigt)
        ? `ACHTUNG: ${(ki.auffaelligkeiten.find((a) => !a.unbestaetigt)!.art ?? "Auffälligkeit").replace(/_/g, " ")}`
        : "Hinweis zur Firma (unbestätigt)")
      : null,
    b.hinweis ? (b.hinweis.art === "beschwerde" ? "klingt nach Beschwerde" : "klingt nach Privatkunde") : null,
    offeneAngebote.length ? "offenes Angebot" : null,
    kommend ? `Termin ${berlinMitTag(kommend.beginn)}` : null,
  ].filter(Boolean).join(" · ");

  t.push("Hallo Justin,", "");
  if (opt.art === "nachtrag") {
    const a = ki?.auffaelligkeiten.find((x) => !x.unbestaetigt) ?? ki?.auffaelligkeiten[0];
    const wer = linksEntschaerfen(b.firma.anzeige);
    t.push(a
      ? `Nachtrag zum Lead ${wer} (${nr}): ${a.unbestaetigt ? "Hinweis (unbestätigt, bitte selbst prüfen)" : "ACHTUNG"} — ${a.text}`
      : `Nachtrag zum Lead ${wer} (${nr}): der Hintergrund-Check ist da.`, "");
  } else if (opt.art === "termin") {
    t.push(`${b.kanal === "justin" ? "Neuer Termin über fiaon.com/justin" : "Gesprächs-Buchung im Global-Kalender"}: ${name}${b.firma.brauchbar ? ` (${firmaText})` : ""} — ${b.anruf.text}`);
    t.push(zeichen, "");
  } else {
    t.push(`${opt.art === "weitere" ? "Weitere Anfrage" : "Neu"}: ${berlinMitTag(b.echterEingang ?? b.eingangAm)} · ${[woher, b.quelle.anzeige ? `Anzeige ${b.quelle.anzeige}` : null, nr].filter(Boolean).join(" · ")}`);
    t.push(zeichen, "");
  }
  if (b.istTest) t.push("(Als TEST markierte Anfrage.)", "");
  if (b.hinweis && opt.art !== "nachtrag") {
    const w = [...b.hinweis.beschwerde, ...b.hinweis.privat].slice(0, 6).join(", ");
    const p = b.bestand.privat.filter((x) => x.kategorie !== "global");
    const haupt = p.find((x) => x.bezahlt && x.kategorie === "konto") ?? p.find((x) => x.bezahlt) ?? p[0];
    t.push(`ACHTUNG — klingt nach ${b.hinweis.art === "beschwerde" ? "Privatkunde mit Beschwerde" : "Privatkunde"}${w ? ` (Signale: ${w})` : ""}`
      + `${haupt ? `; Privat-Bestellung ${haupt.ref}${haupt.paket ? ` (${haupt.paket})` : ""}${haupt.bezahlt ? ", bezahlt" : ""}${haupt.betreuer ? `, Betreuung ${haupt.betreuer}` : ""}` : ""}.`
      + (p.length ? " Bitte beim Kundendienst klären, nicht als Business-Lead führen." : " Bitte im Gespräch klären, ob es um eine bestehende Privat-Bestellung geht."), "");
  } else if ((b.signalLeise ?? []).length && opt.art !== "nachtrag") {
    t.push(`Signalwörter in der Nachricht: ${b.signalLeise.join(", ")} — allein kein Hinweis auf eine Beschwerde.`, "");
  }
  if (b.bestand.cockpit?.terminOhneKalender && opt.art !== "nachtrag") {
    t.push(`ACHTUNG: Im Cockpit steht „Termin“, im Kalender steht keiner — die Zeit bei ${b.anruf.wer ?? "der zuständigen Person"} erfragen.`, "");
  }

  if (opt.art !== "nachtrag") {
    t.push("KONTAKT");
    t.push(`${name} · ${firmaText}`);
    if (b.kontakt.telefon) {
      const land2 = b.kontakt.tel.ausland ? `Ausland: ${b.kontakt.tel.landName ?? "unbekanntes Land"}` : b.kontakt.tel.landName ?? "ohne Ländervorwahl";
      t.push(`Telefon: ${b.kontakt.telefonLesbar} (${land2})${b.kontakt.tel.pruefen ? ` — ? bitte prüfen: ${b.kontakt.tel.pruefen}; eingetragen war „${linksEntschaerfen(b.kontakt.tel.eingetragen ?? "")}“` : ""}`);
    }
    if (b.kontakt.bekannt) t.push(`Bekannte Nummer (${b.kontakt.bekannt.quelle}): ${b.kontakt.bekannt.lesbar}`);
    if (b.kontakt.email) t.push(`E-Mail: ${b.kontakt.email} (${b.kontakt.wegwerf ? "Wegwerf-Adresse" : b.kontakt.freemail ? "Freemail" : b.kontakt.firmenDomain ? `Firmen-Adresse${b.kontakt.mx === "mx" ? ", Mailserver ✓" : b.kontakt.mx === "keine" ? ", KEIN Mailserver" : ""}` : "Adresse"})`);
    if (b.register.vertreterTreffer) t.push(`Laut Register: ${b.register.vertreterTreffer} ✓`);
    else if (b.register.vertreter?.length) t.push(`Vertretung laut Register: ${b.register.vertreter.join(", ")} — die anfragende Person steht nicht darunter`);
    t.push("");
    t.push("ANTWORTEN");
    if (b.paketwunsch) t.push(`– Paketwunsch: ${linksEntschaerfen(b.paketwunsch)}`);
    for (const a of b.antworten) t.push(`– ${antwortZeile(a)}`);
    if (b.nachricht) {
      const n = b.nachricht.replace(/\s+/g, " ").trim();
      t.push(`– Nachricht: „${linksEntschaerfen(n.length > 600 ? `${n.slice(0, 600).replace(/\s+\S*$/, "")} …` : n)}“${n.length > 600 ? " (ganze Nachricht im Cockpit)" : ""}`);
    }
    if (b.wunschzeit) t.push(`– Wunschzeit: ${linksEntschaerfen(b.wunschzeit)}`);
    if (!b.paketwunsch && !b.antworten.length && !b.nachricht && !b.wunschzeit) t.push(b.kanal === "website" ? "– Website-Formular ohne Auswahlfragen" : "– keine Auswahlfragen");
    t.push(`→ Einschätzung: ${TEMPERATUR_WORT[b.temperatur.wert]} — ${linksEntschaerfen(b.temperatur.grund)}`);
    t.push("");
    t.push("CHECK");
    t.push(`${FAKT_ZEICHEN[b.fakten.firma]} Firma gefunden: ${FAKT_WORT[b.fakten.firma]} — ${linksEntschaerfen(b.fakten.firmaText)}`);
    t.push(`${FAKT_ZEICHEN[b.fakten.mail]} Mail passt zur Firma: ${FAKT_WORT[b.fakten.mail]} — ${b.fakten.mailText}`);
    t.push(`${b.kontakt.tel.pruefen ? "?" : b.kontakt.tel.ausland ? "!" : "✓"} Telefon-Land: ${b.fakten.telefonText}`);
    if (b.register.status === "eindeutig" && b.register.zweck) t.push(`  Gegenstand laut Register: ${linksEntschaerfen(b.register.zweck)}`);
    t.push("");
  }

  t.push("HINTERGRUND (KI-Websuche, jede Aussage mit Quelle)");
  if (ki) t.push(...kiAbschnitt(ki, quellen, b));
  else {
    const s = String(opt.kiStatus ?? "");
    const grund = s === "keine_firma" || s === "gebremst" ? `keiner — ${opt.kiGrund ?? "kein Beleg für eine Firma"}` : kiStatusZeile(s, opt.kiGrund);
    t.push(`– ${grund}`);
  }
  t.push("");

  if (opt.art !== "nachtrag") {
    t.push("BESTAND");
    const best: string[] = [];
    for (const p of b.bestand.privat) {
      const was = p.kategorie === "global" ? "Global-Bestellung" : p.kategorie === "auskunft" ? "Privat-Zusatz (Bonitätsauskunft)" : "Privat-Bestellung";
      best.push(`${was} ${p.ref}${p.paket ? ` (${p.paket})` : ""}${p.am ? ` vom ${berlinKurz(p.am).slice(0, 6)}` : ""}: ${p.bezahlt ? "bezahlt" : "nicht bezahlt"}${p.archiviert ? ", archiviert" : ""}${p.betreuer ? ` · Betreuung ${p.betreuer}` : ""}`);
    }
    if (b.bestand.globalKunde) best.push("ist schon Global-Kunde");
    for (const g of b.bestand.angebote) best.push(`Global-Angebot ${g.ref}: ${g.status}${g.gueltigBis ? `, gültig bis ${g.gueltigBis.split("-").reverse().join(".")}` : ""}${g.auftrag ? `, Auftrag ${g.auftrag}` : ""}`);
    // Vorher und nachher getrennt — eine Meta-Anfrage zwei Minuten nach der Website-Anfrage ist keine „frühere“.
    const eingangMs = new Date(b.eingangAm).getTime();
    const vorher = b.bestand.anfragen.filter((x) => new Date(x.am).getTime() < eingangMs);
    const danach = b.bestand.anfragen.filter((x) => new Date(x.am).getTime() >= eingangMs);
    if (vorher.length) best.push(`frühere Anfragen: ${vorher.map((x) => `#${x.id} (${berlinKurz(x.am)})`).join(", ")}`);
    if (danach.length) best.push(`danach noch angefragt: ${danach.map((x) => `#${x.id} (${berlinKurz(x.am)})`).join(", ")}`);
    for (const x of b.bestand.termine) best.push(`${x.kommend ? "Termin" : "Früherer Termin"}${x.agent ? ` bei ${x.agent}` : ""}: ${berlinMitTag(x.beginn)} (${x.quelleText}, ${x.status})`);
    if (b.bestand.supportTermine) best.push(`${b.bestand.supportTermine} Support-Termin${b.bestand.supportTermine === 1 ? "" : "e"} als Bestandskunde`);
    if (b.bestand.cockpit?.letzte) best.push(`Cockpit zuletzt: ${b.bestand.cockpit.letzte}`);
    if (!best.length) best.push("Erster Kontakt: keine Bestellung, kein Global-Angebot, keine frühere Anfrage.");
    for (const s of best) t.push(`– ${s}`);
    t.push("");
    t.push("ANRUF");
    t.push(b.anruf.text + (b.anruf.auftrag && opt.art !== "termin" && b.anruf.offen ? ` (${b.anruf.auftrag})` : ""));
    if (opt.leadMail && opt.art !== "termin") t.push(opt.leadMail);
    if (opt.selbstUrl && b.anruf.offen && opt.art !== "termin") t.push(`Rufst du selbst an? Der Knopf „Ich rufe selbst an“ schließt den Auftrag an ${b.anruf.wer ?? "das Team"} — dann klingelt es nicht doppelt.`);
    t.push("");
  }

  if (quellen.length) {
    t.push("QUELLEN");
    quellen.forEach((q, i) => t.push(`[${i + 1}] ${q}`));
    t.push("");
  }
  if (b.kanal === "meta" && opt.art !== "nachtrag" && (b.quelle.formular || b.quelle.kampagne)) {
    t.push(`Quelle: ${[b.quelle.formular ? `Formular „${b.quelle.formular}“` : null, b.quelle.kampagne ? `Kampagne ${b.quelle.kampagne}` : null].filter(Boolean).join(" · ")}`);
  }
  t.push("Aus öffentlichen Firmenquellen und den eigenen Angaben — eine Lesehilfe für deinen Anruf, keine Entscheidung.");

  const knoepfe: DossierMail["knoepfe"] = [];
  if (b.cockpitUrl) knoepfe.push({ text: "Im Firmen-Cockpit öffnen", url: b.cockpitUrl });
  if (opt.selbstUrl && b.anruf.offen && (opt.art === "neu" || opt.art === "weitere")) knoepfe.push({ text: "Ich rufe selbst an", url: opt.selbstUrl, leise: true });
  // Der Knopf wählt die bereinigte Nummer — oder die bekannte, wenn die eingetragene fraglich ist (Justin-Sicht).
  const wahl = b.kontakt.tel.pruefen && b.kontakt.bekannt ? { e164: b.kontakt.bekannt.e164, lesbar: b.kontakt.bekannt.lesbar } : b.kontakt.tel.e164 ? { e164: b.kontakt.tel.e164, lesbar: b.kontakt.telefonLesbar } : null;
  if (wahl && opt.art !== "nachtrag") knoepfe.push({ text: `Anrufen: ${wahl.lesbar}`, url: `tel:${wahl.e164}`, leise: true });
  const links = [b.cockpitUrl, opt.selbstUrl, ...quellen].filter((u): u is string => !!u);
  return { betreff, text: t.join("\n"), knoepfe, links };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER FADEN — alle Meldungen zu einem Lead in EINEM Mail-Faden
// ═══════════════════════════════════════════════════════════════════════════
export interface Faden { stamm: string | null; kopfzeilen: Record<string, string> | null; erste: boolean }

/**
 * Der Faden einer Firma. Nachbesserung (Gutachten Technik 05.11.2026): Er hängt an „gesendet“ (mail_basis_am), nicht an
 * einer Message-ID — liefert Brevo keine, gilt der Stamm trotzdem; die Kopfzeilen kommen nur aus vorhandenen IDs.
 */
export async function fadenLesen(firmaId: number | null, lauf: Lauf = sqlPool): Promise<Faden> {
  if (!firmaId) return { stamm: null, kopfzeilen: null, erste: true };
  const zeilen = (await lauf`
    SELECT faden_betreff, mail_basis_id, mail_ki_id FROM fiaon_lead_dossier
     WHERE firma_id = ${firmaId} AND mail_basis_am IS NOT NULL
     ORDER BY mail_basis_am ASC LIMIT 20`.catch(() => [])) as any[];
  // E-476 Scheibe 3: „Termin steht“ (D2) und die Anruf-Karte (D3) gehören zum selben Faden — auch, wenn es (noch) kein
  // Dossier gab (Cockpit-Knopf bei einer Firma ohne Anfrage). Ohne Tabelle (vor dem ersten Lead-Weg-Lauf): nur die Dossiers.
  const lw = (await lauf`
    SELECT faden_betreff, d2_id, d3_id FROM fiaon_lead_gespraech
     WHERE firma_id = ${firmaId} AND (d2_am IS NOT NULL OR d3_am IS NOT NULL) AND faden_betreff IS NOT NULL
     ORDER BY COALESCE(d2_am, d3_am) ASC LIMIT 10`.catch(() => [])) as any[];
  if (!zeilen.length && !lw.length) return { stamm: null, kopfzeilen: null, erste: true };
  const ids = [...zeilen.flatMap((z) => [z.mail_basis_id, z.mail_ki_id]), ...lw.flatMap((z) => [z.d2_id, z.d3_id])]
    .filter((x): x is string => !!x && /^<[^<>\s]+>$/.test(String(x)));
  const stamm = String(zeilen.find((z) => z.faden_betreff)?.faden_betreff ?? lw.find((z) => z.faden_betreff)?.faden_betreff ?? "") || null;
  if (!ids.length) return { stamm, kopfzeilen: null, erste: false };
  return { stamm, kopfzeilen: { "In-Reply-To": ids[ids.length - 1], References: ids.slice(-10).join(" ") }, erste: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANSTOSS, VERARBEITEN, LAUF
// ═══════════════════════════════════════════════════════════════════════════
async function zeileAnlegen(a: DossierAnstoss, lauf: Lauf): Promise<number | null> {
  const h = a.hinweis ?? null;
  const [neu] = (await lauf`
    INSERT INTO fiaon_lead_dossier (anlass, anlass_id, anfrage_id, termin_id, firma_id, person_id, kanal, antworten, hinweis)
    VALUES (${a.anlass}, ${a.anlassId}, ${a.anlass === "anfrage" ? a.anlassId : null}, ${a.anlass === "termin" ? a.anlassId : null},
            ${a.firmaId ?? null}, ${a.personId ?? null}, ${h?.kanal ?? null},
            ${h?.antworten?.length ? lauf.json(h.antworten as any) : null}, ${h ? lauf.json({ ...h, antworten: undefined } as any) : null})
    ON CONFLICT (anlass, anlass_id) DO NOTHING
    RETURNING id`) as any[];
  if (neu?.id) return Number(neu.id);
  const [da] = (await lauf`SELECT id FROM fiaon_lead_dossier WHERE anlass = ${a.anlass} AND anlass_id = ${a.anlassId}`) as any[];
  return da ? Number(da.id) : null;
}

const jsonObjekt = (v: unknown): any => {
  let o: any = v;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  return o && typeof o === "object" ? o : null;
};

function zeileZuAnstoss(z: any): DossierAnstoss {
  const h = jsonObjekt(z.hinweis);
  const antworten = (() => { const o = jsonObjekt(z.antworten); return Array.isArray(o) ? o : undefined; })();
  return {
    anlass: z.anlass, anlassId: Number(z.anlass_id), firmaId: z.firma_id ? Number(z.firma_id) : null, personId: z.person_id ? Number(z.person_id) : null,
    hinweis: h || antworten ? { kanal: (h?.kanal ?? "website") as LeadKanal, ...(h ?? {}), antworten } : null,
  };
}

/** Was die KI bekommt (Gutachten Sicherheit 05.11.2026): ohne die Namen anderer Vertreter, ohne Website-Freitext. */
export function kiEingabe(b: DossierBasis): HintergrundEingabe {
  const firma = b.firma.brauchbar ? b.firma.formular : b.register.name ?? b.impressum.firmaName ?? null;
  const domain = b.kontakt.firmenDomain ?? (b.register.website ? (() => { try { return new URL(/^https?:/.test(String(b.register.website)) ? String(b.register.website) : `https://${b.register.website}`).hostname.replace(/^www\./, ""); } catch { return null; } })() : null);
  const register = b.register.status === "eindeutig"
    ? [b.register.name, b.register.rechtsform, b.register.register, b.register.ort, b.register.aktiv].filter(Boolean).join(" · ")
    : `${b.register.status}${b.register.grund ? ` (${b.register.grund})` : ""}`;
  const impressum = b.impressum.status === "gelesen"
    ? [b.impressum.url, b.impressum.firmaName, b.impressum.registernummer, b.impressum.ustId ? `USt-IdNr. ${b.impressum.ustId}` : null, b.impressum.ort, b.impressum.nenntFirma ? "nennt die Firma" : null].filter(Boolean).join(" · ")
    : b.impressum.grund;
  return {
    firma, domain, land: b.register.land ?? (b.kontakt.tel.land && ["DE", "AT", "CH"].includes(b.kontakt.tel.land) ? b.kontakt.tel.land : null),
    register, anfragenderImRegister: b.register.vertreterPasst ?? null, impressum,
    antworten: b.kanal === "meta" ? b.antworten : [],
    person: b.kontakt.name || null,
    // Nur zum Maskieren vor den Wänden — geht nicht an die KI.
    namen: [b.kontakt.name, ...(b.register.vertreter ?? []).map((v) => v.replace(/\s*\(.*\)\s*$/, ""))].filter(Boolean) as string[],
  };
}

/**
 * Ein KI-Versuch: erst die Lage (ohne Aufruf), dann die Sperre „ki“ (höchstens EIN Check gleichzeitig im ganzen Betrieb,
 * Gutachten Sicherheit 05.11.2026) — wer sie nicht bekommt, „folgt“. Der Check bucht seine Kosten, bevor die Sperre frei
 * wird; der nächste liest den Tagesstand also mit diesen Kosten.
 */
export async function kiVersuchen(b: DossierBasis, einst: DossierEinstellungen, lauf: Lauf = sqlPool): Promise<HintergrundAusgang> {
  const opt = { an: einst.kiAn, deckelUsd: einst.kiDeckelUsd, stundeMax: einst.kiStundeMax };
  const lage = await kiLage(opt);
  if (!lage.frei) return { ok: false, status: lage.status, grund: lage.grund, gerufen: false };
  // Die Sperre hält länger als die Frist: nach der KI liest der Check noch bis zu sechs Seiten nach.
  const wer = await sperreNehmen("ki", einst.kiFristS + 120, lauf);
  if (!wer) return { ok: false, status: "folgt", grund: "ein anderer Hintergrund-Check läuft gerade", gerufen: false };
  try {
    return await hintergrundPruefen(kiEingabe(b), { ...opt, fristMs: einst.kiFristS * 1000 });
  } finally {
    await sperreFrei("ki", wer, lauf);
  }
}

/** Ein frisches KI-Ergebnis derselben Firma (≤ 7 Tage) aus einer anderen Zeile — oder null. Die Rolle nur für dieselbe Person (T7). */
async function kiDerFirma(firmaId: number, ohneId: number, person: string, lauf: Lauf): Promise<{ ki: HintergrundErgebnis; status: "fertig" | "leer" } | null> {
  const [r] = (await lauf`
    SELECT ki, ki_status FROM fiaon_lead_dossier
     WHERE firma_id = ${firmaId} AND id <> ${ohneId} AND ki_status IN ('fertig', 'leer') AND ki IS NOT NULL
       AND ki_am > NOW() - INTERVAL '7 days'
     ORDER BY ki_am DESC LIMIT 1`.catch(() => [])) as any[];
  if (!r) return null;
  const o = jsonObjekt(r.ki);
  if (!o) return null;
  const ki = o as HintergrundErgebnis;
  // Fragt eine zweite Person derselben Firma an, erbt sie nicht die Rolle des ersten Anfragenden (Gutachten Technik).
  if (ki.personRolle && (ki.fuerPerson ?? "") !== namenForm(person)) ki.personRolle = null;
  return { ki, status: r.ki_status === "fertig" ? "fertig" : "leer" };
}

/** Ist diese Anfrage ein Doppel (gleiche Adresse, gleicher Text, ≤ 10 Minuten nach einer früheren)? Dann keine eigene Mail. */
async function doppelVon(anfrageId: number | null, lauf: Lauf): Promise<number | null> {
  if (!anfrageId) return null;
  const [o] = (await lauf`
    SELECT o.id FROM fiaon_anfragen o, fiaon_anfragen a
     WHERE a.id = ${anfrageId} AND o.art = 'global' AND o.id < a.id AND COALESCE(a.email, '') <> ''
       AND LOWER(COALESCE(o.email, '')) = LOWER(a.email) AND COALESCE(o.text, '') = COALESCE(a.text, '')
       AND o.created_at > a.created_at - INTERVAL '10 minutes'
     ORDER BY o.id DESC LIMIT 1`.catch(() => [])) as any[];
  return o ? Number(o.id) : null;
}

const KI_OFFEN = ["folgt", "pausiert", "frist", "unvollstaendig", "fehler", "anbieter", "deckel"];
/** Wann der KI-Nachtrag wieder nachsieht — ohne Aufruf zählt kein Versuch (Gutachten Technik + Justin-Sicht). */
function kiWarteMinuten(status: string, gerufen: boolean): number {
  if (gerufen) return 3;
  if (status === "deckel") return 60;
  if (status === "folgt") return 2;
  return 15;
}

type VerarbeitenErgebnis = "gesendet" | "fehler" | "endgueltig" | "uebersprungen" | "doppelt";

/** Eine Zeile beanspruchen und als EINE Mail an Justin schicken. Wirft nie. */
async function verarbeiten(id: number, opt: { kiJetzt: boolean }, lauf: Lauf = sqlPool): Promise<VerarbeitenErgebnis> {
  const [z] = (await lauf`
    UPDATE fiaon_lead_dossier SET status = 'laeuft', laeuft_seit = NOW(), versuche = versuche + 1, updated_at = NOW()
     WHERE id = ${id} AND versuche < 3
       AND (naechster_versuch_am IS NULL OR naechster_versuch_am <= NOW())
       AND (status IN ('offen', 'fehler') OR (status = 'laeuft' AND laeuft_seit < NOW() - INTERVAL '10 minutes'))
    RETURNING *`.catch(() => [])) as any[];
  if (!z) return "uebersprungen";
  let sperre: { schluessel: string; wer: string } | null = null;
  try {
    const einst = await dossierEinstellungen(lauf);
    const b = await leadDossierBasis(zeileZuAnstoss(z), { lauf });
    await lauf`
      UPDATE fiaon_lead_dossier SET basis = ${lauf.json(b as any)}, antworten = ${lauf.json(b.antworten as any)},
             firma_id = COALESCE(firma_id, ${b.firmaId}::int), person_id = COALESCE(person_id, ${b.personIds[0] ?? null}::int),
             kanal = ${b.kanal}, temperatur = ${b.temperatur.wert}, eingang_am = ${b.echterEingang ?? b.eingangAm}, updated_at = NOW()
       WHERE id = ${id}`;
    // Doppelklick: gleiche Adresse, gleicher Text, ≤ 10 Minuten — keine zweite Mail, keine zweite Websuche.
    const doppel = z.anlass === "anfrage" ? await doppelVon(b.anfrageId, lauf) : null;
    if (doppel) {
      await lauf`UPDATE fiaon_lead_dossier SET status = 'doppelt', grund = ${`gleiche Anfrage wie #${doppel} (≤ 10 Minuten) — keine eigene Mail`}, laeuft_seit = NULL, updated_at = NOW() WHERE id = ${id}`;
      return "doppelt";
    }
    // Je Firma nacheinander: Faden lesen, KI, Versand (Gutachten Technik + Justin-Sicht 05.11.2026).
    const sperrSchluessel = b.firmaId ? `firma:${b.firmaId}` : `mail:${b.kontakt.email || `zeile-${id}`}`;
    const wer = await sperreNehmen(sperrSchluessel, einst.kiFristS + 240, lauf);
    if (!wer) {
      await lauf`
        UPDATE fiaon_lead_dossier SET status = 'offen', versuche = GREATEST(versuche - 1, 0), laeuft_seit = NULL,
               naechster_versuch_am = NOW() + INTERVAL '1 minute', grund = 'wartet: zu dieser Firma läuft gerade eine andere Meldung', updated_at = NOW()
         WHERE id = ${id}`;
      return "uebersprungen";
    }
    sperre = { schluessel: sperrSchluessel, wer };

    // Der KI-Check: inline, wenn er darf — sonst kommt die Basis allein, der Lauf holt ihn nach. Ein Ergebnis aus einem
    // früheren Versuch (Versand scheiterte danach) wird wiederverwendet: dieselbe Websuche zahlt man nicht zweimal.
    let ki: HintergrundErgebnis | null = null;
    let kiStatus: string; let kiGrund: string | null = null;
    const frueher = jsonObjekt(z.ki) as HintergrundErgebnis | null;
    const firmaKi = !frueher && b.firmaId ? await kiDerFirma(b.firmaId, id, b.kontakt.name, lauf) : null;
    if (frueher && (z.ki_status === "fertig" || z.ki_status === "leer")) { ki = frueher; kiStatus = z.ki_status; }
    else if (firmaKi) {
      ki = firmaKi.ki; kiStatus = firmaKi.status;
      await lauf`UPDATE fiaon_lead_dossier SET ki = ${lauf.json(ki as any)}, ki_status = ${kiStatus}, ki_grund = 'aus einem früheren Dossier dieser Firma', ki_am = NOW(), updated_at = NOW() WHERE id = ${id}`;
    }
    else if (!b.kiErlaubt.erlaubt) { kiStatus = "keine_firma"; kiGrund = b.kiErlaubt.grund; }
    else if (!einst.kiAn) { kiStatus = "aus"; }
    else if (b.kiBremse) { kiStatus = "gebremst"; kiGrund = b.kiBremse; }
    else if (!opt.kiJetzt) { kiStatus = "folgt"; kiGrund = null; }
    else {
      const aus = await kiVersuchen(b, einst, lauf);
      const gerufen = aus.ok || aus.gerufen;
      const kiKosten = aus.ok ? aus.ergebnis.kostenCents : (aus.kostenCents ?? 0);
      if (aus.ok) { ki = aus.ergebnis; kiStatus = hatNeues(aus.ergebnis) ? "fertig" : "leer"; }
      else { kiStatus = aus.status; kiGrund = aus.grund; }
      // Sofort festhalten — vor dem Versand (Kosten und Ergebnis gehen nie verloren). Ein Versuch zählt nur mit Aufruf.
      await lauf`
        UPDATE fiaon_lead_dossier SET ki = ${ki ? lauf.json(ki as any) : null}, ki_status = ${kiStatus}, ki_grund = ${kiGrund},
               ki_versuche = ki_versuche + ${gerufen ? 1 : 0}, ki_kosten_cents = COALESCE(ki_kosten_cents, 0) + ${kiKosten},
               ki_am = CASE WHEN ${!!ki} THEN NOW() ELSE ki_am END,
               ki_naechster_am = NOW() + ${kiWarteMinuten(kiStatus, gerufen)}::int * INTERVAL '1 minute', updated_at = NOW()
         WHERE id = ${id}`;
    }
    const faden = await fadenLesen(b.firmaId, lauf);
    const art: DossierArt = z.anlass === "termin" ? "termin" : faden.erste ? "neu" : "weitere";
    const selbstUrl = z.anlass === "anfrage" ? selbstLink(id) : null;
    const zeigeKi = ki && (kiStatus === "fertig" || kiStatus === "leer") ? ki : null;
    // E-476 Scheibe 4: was der Lead von Justin bekommt (Willkommens-Mail aus js@) — ein Satz unter ANRUF. Wirft nie.
    const leadMail = z.anlass === "anfrage"
      ? await import("./fiaon-global-lead-post").then((m) => m.leadMailHinweis(b.anfrageId, lauf)).catch(() => null)
      : null;
    const mail = leadDossierMail(b, zeigeKi, { art, stamm: faden.stamm, erste: faden.erste, kiStatus, kiGrund, selbstUrl, leadMail });
    const versand = await mailSenden({
      an: einst.anAdresse, name: "Justin", betreff: mail.betreff, text: mail.text, knoepfe: mail.knoepfe,
      kopfzeilen: faden.kopfzeilen ?? undefined, antwortAn: { email: einst.anAdresse, name: "Justin" }, verlinken: mail.links, abschnitteFett: true,
    });
    if (!versand.ok) throw new Error(`Versand: ${versand.grund ?? "unbekannt"}`);
    const stamm = faden.stamm || stammFuer(b);
    const kiOffen = KI_OFFEN.includes(kiStatus);
    await lauf`
      UPDATE fiaon_lead_dossier SET status = 'gesendet', grund = NULL, laeuft_seit = NULL, naechster_versuch_am = NULL,
             mail_basis_am = NOW(), mail_basis_id = ${versand.messageId}, faden_betreff = ${stamm},
             ki_status = ${kiStatus}, ki_grund = ${kiGrund}, updated_at = NOW()
       WHERE id = ${id}`;
    if (versand.ohneKopfzeilen) console.warn(`[LEAD-DOSSIER] #${id}: Brevo nahm die Faden-Kopfzeilen nicht — gesendet ohne (der Betreff hält den Faden).`);
    if (b.firmaId) {
      const kurz = `Lead-Dossier an Justin: Firma ${b.fakten.firma}, Mail ${b.fakten.mail}, Telefon ${b.kontakt.tel.text}, ${TEMPERATUR_WORT[b.temperatur.wert]}`
        + (ki && kiStatus === "fertig" ? ` · Hintergrund: ${ki.kurz?.text ?? ki.branche?.text ?? "belegt"}` : kiOffen ? " · Hintergrund-Check folgt" : "");
      await lauf`
        INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
        VALUES (${b.firmaId}, NULL, 'System', 'global', 'dossier', ${kurz.slice(0, 600)})`.catch(() => {});
    }
    void import("./fiaon-system-alarme").then((m) => m.alarmVorbei(ALARM, "Dossier wieder gesendet", lauf)).catch(() => {});
    console.log(`[LEAD-DOSSIER] #${id} (${z.anlass} ${z.anlass_id}) an Justin gesendet — KI ${kiStatus}`);
    return "gesendet";
  } catch (err) {
    const grund = String((err as Error)?.message ?? err).slice(0, 300);
    const versuche = Number(z.versuche) || 1;
    const endgueltig = versuche >= 3;
    console.error(`[LEAD-DOSSIER] #${id} (${z.anlass} ${z.anlass_id}) nicht gesendet (Versuch ${versuche}/3):`, grund);
    // Wartezeit 2/15/60 Minuten — eine kurze Störung kostet kein Dossier mehr (Gutachten Technik 05.11.2026).
    await lauf`
      UPDATE fiaon_lead_dossier SET status = 'fehler', grund = ${grund}, laeuft_seit = NULL,
             naechster_versuch_am = NOW() + ${naechsterVersuchMinuten(versuche)}::int * INTERVAL '1 minute', updated_at = NOW()
       WHERE id = ${id}`.catch(() => {});
    if (endgueltig) {
      const { alarmMelden } = await import("./fiaon-system-alarme");
      await alarmMelden(ALARM, {
        quelle: "lead-dossier", titel: "Lead-Dossier: eine Mail an Justin ging nach drei Versuchen nicht raus",
        text: `${z.anlass === "anfrage" ? `Anfrage #${z.anlass_id}` : `Termin #${z.anlass_id}`}: ${grund}`, stufe: "rot",
        link: "/chef/s/lead-motor", anhaengen: true,
      }, lauf).catch(() => ({ neu: false }));
    }
    return endgueltig ? "endgueltig" : "fehler";
  } finally {
    if (sperre) await sperreFrei(sperre.schluessel, sperre.wer, lauf);
  }
}

/** Prüfstand (und nur er): eine Zeile anlegen bzw. verarbeiten wie der Lauf — ohne CRONS_AN. */
export const dossierZeileAnlegen = (a: DossierAnstoss, lauf: Lauf = sqlPool) => zeileAnlegen(a, lauf);
export const dossierZeileVerarbeiten = (id: number, kiJetzt: boolean, lauf: Lauf = sqlPool) => verarbeiten(id, { kiJetzt }, lauf);

/**
 * Der Anstoß nach einem Eingang — angestoßen, NIE abgewartet (der Eingang darf daran nicht scheitern). Nur im Betrieb
 * (CRONS_AN): Ein lokaler Prüflauf über globalAnfrageAnnehmen verschickt nichts.
 */
export function leadDossierAnstossen(a: DossierAnstoss): void {
  if (!CRONS_AN) return;
  void (async () => {
    try {
      const einst = await dossierEinstellungen();
      if (!einst.an) return;
      await leadDossierSchema();
      const ab = await zaehlbeginnSichern();
      // Gutachten Technik 05.11.2026: „Rückstand nachholen“ und alte Meta-Leads kommen nicht einzeln (still).
      if (a.hinweis && !einzelDossierFaellig({ eingangAm: new Date(), ab, echterEingang: a.hinweis.metaErstellt ?? null, weg: a.hinweis.weg ?? null })) return;
      const id = await zeileAnlegen(a, sqlPool);
      if (!id) return;
      await verarbeiten(id, { kiJetzt: true });
    } catch (err) {
      console.error(`[LEAD-DOSSIER] Anstoß ${a.anlass} #${a.anlassId}:`, String((err as Error)?.message ?? err).slice(0, 300));
    }
  })();
}

/**
 * Der KI-Nachtrag zu einer schon gesendeten Zeile — EIN Aufruf; eine Mail nur, wenn er Neues bringt. Nachbesserung
 * (Gutachten Technik + Justin-Sicht 05.11.2026): Die Lage wird VOR dem Anspruch gelesen. Ist die KI nicht frei (Pause,
 * Claude-Rückweg, Deckel, 30 Minuten nach der Pause, ein anderer Check läuft), zählt nichts und es ist keine „Arbeit“
 * (keine Historienzeile alle 2 Minuten) — nur der nächste Blick wird gesetzt. `true` = gearbeitet.
 */
async function kiNachholen(z: any, lauf: Lauf): Promise<boolean> {
  const einst = await dossierEinstellungen(lauf);
  let geparst: DossierBasis | null = jsonObjekt(z.basis) as DossierBasis | null;
  if (!geparst || !geparst.kontakt) {
    await lauf`UPDATE fiaon_lead_dossier SET ki_status = 'fehler', ki_grund = 'keine Basis gespeichert', ki_versuche = 3, updated_at = NOW() WHERE id = ${z.id}`.catch(() => {});
    return true;
  }
  let b: DossierBasis = geparst;
  // Dieselbe Firma schon geprüft? Dann übernehmen (kein Aufruf).
  const firmaKi = b.firmaId ? await kiDerFirma(b.firmaId, Number(z.id), b.kontakt.name, lauf) : null;
  if (firmaKi) {
    await lauf`UPDATE fiaon_lead_dossier SET ki = ${lauf.json(firmaKi.ki as any)}, ki_status = ${firmaKi.status}, ki_grund = 'aus einem früheren Dossier dieser Firma', ki_am = NOW(), updated_at = NOW() WHERE id = ${z.id}`.catch(() => {});
    return true;
  }
  const lage = await kiLage({ an: einst.kiAn, deckelUsd: einst.kiDeckelUsd, stundeMax: einst.kiStundeMax });
  if (!lage.frei) {
    // Nichts zählt, keine Historienzeile — nur der nächste Blick. Bei Not-Aus bleibt der alte Zustand stehen.
    await lauf`
      UPDATE fiaon_lead_dossier SET ki_status = CASE WHEN ${lage.status} = 'aus' THEN ki_status ELSE ${lage.status} END,
             ki_grund = ${lage.grund}, ki_naechster_am = NOW() + ${kiWarteMinuten(lage.status, false)}::int * INTERVAL '1 minute'
       WHERE id = ${z.id} AND ki_status = ${z.ki_status}`.catch(() => {});
    return false;
  }
  const [frei] = (await lauf`
    UPDATE fiaon_lead_dossier SET ki_status = 'laeuft', updated_at = NOW()
     WHERE id = ${z.id} AND ki_status = ${z.ki_status} AND ki_versuche = ${Number(z.ki_versuche) || 0} RETURNING id`.catch(() => [])) as any[];
  if (!frei) return false;
  const sperrSchluessel = b.firmaId ? `firma:${b.firmaId}` : `mail:${b.kontakt.email || `zeile-${z.id}`}`;
  const wer = await sperreNehmen(sperrSchluessel, einst.kiFristS + 240, lauf);
  if (!wer) {
    await lauf`UPDATE fiaon_lead_dossier SET ki_status = ${z.ki_status}, ki_naechster_am = NOW() + INTERVAL '2 minutes' WHERE id = ${z.id}`.catch(() => {});
    return false;
  }
  try {
    const aus = await kiVersuchen(b, einst, lauf);
    const gerufen = aus.ok || aus.gerufen;
    const kosten = aus.ok ? aus.ergebnis.kostenCents : (aus.kostenCents ?? 0);
    if (!aus.ok) {
      await lauf`
        UPDATE fiaon_lead_dossier SET ki_status = ${aus.status}, ki_grund = ${aus.grund}, ki_versuche = ki_versuche + ${gerufen ? 1 : 0},
               ki_kosten_cents = COALESCE(ki_kosten_cents, 0) + ${kosten},
               ki_naechster_am = NOW() + ${kiWarteMinuten(aus.status, gerufen)}::int * INTERVAL '1 minute', updated_at = NOW()
         WHERE id = ${z.id}`.catch(() => {});
      return gerufen;
    }
    const neu = hatNeues(aus.ergebnis);
    let mailId: string | null = null;
    if (neu) {
      // Frische Kurzfassung (Cockpit-Stand, Anruf) — die Prüfung selbst nicht noch einmal.
      try { b = { ...b, anruf: (await leadDossierBasis(zeileZuAnstoss(z), { lauf, netz: false })).anruf }; } catch { /* alte Basis reicht */ }
      const faden = await fadenLesen(b.firmaId, lauf);
      const mail = leadDossierMail(b, aus.ergebnis, { art: "nachtrag", stamm: faden.stamm ?? z.faden_betreff });
      const v = await mailSenden({
        an: einst.anAdresse, name: "Justin", betreff: mail.betreff, text: mail.text, knoepfe: mail.knoepfe,
        kopfzeilen: faden.kopfzeilen ?? undefined, antwortAn: { email: einst.anAdresse, name: "Justin" }, verlinken: mail.links, abschnitteFett: true,
      });
      mailId = v.ok ? (v.messageId ?? "") : null;
      if (!v.ok) console.error(`[LEAD-DOSSIER] Nachtrag #${z.id} nicht gesendet:`, v.grund);
    }
    await lauf`
      UPDATE fiaon_lead_dossier SET ki = ${lauf.json(aus.ergebnis as any)}, ki_status = ${neu ? "fertig" : "leer"}, ki_grund = NULL, ki_am = NOW(),
             ki_versuche = ki_versuche + 1, ki_kosten_cents = COALESCE(ki_kosten_cents, 0) + ${kosten}, ki_naechster_am = NULL,
             mail_ki_am = CASE WHEN ${mailId !== null} THEN NOW() ELSE mail_ki_am END, mail_ki_id = COALESCE(NULLIF(${mailId ?? ""}, ''), mail_ki_id), updated_at = NOW()
       WHERE id = ${z.id}`.catch(() => {});
    if (b.firmaId) {
      const satz = neu ? `Hintergrund-Check nachgereicht: ${aus.ergebnis.kurz?.text ?? aus.ergebnis.branche?.text ?? "belegte Fakten"}${aus.ergebnis.auffaelligkeiten.length ? ` · ${aus.ergebnis.auffaelligkeiten.length} Auffälligkeit(en)` : ""}`
        : "Hintergrund-Check: nichts Verlässliches gefunden";
      await lauf`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES (${b.firmaId}, NULL, 'System', 'global', 'dossier', ${satz.slice(0, 600)})`.catch(() => {});
    }
    return true;
  } finally {
    await sperreFrei(sperrSchluessel, wer, lauf);
  }
}

let letzterPuls = 0;
let letzteAufbewahrung = 0;
/**
 * Der Lauf lead_dossier (alle 2 Minuten, nurMitErgebnis + Stundenpuls): Sammel-Mail (höchstens dreimal), fehlende
 * Zeilen ab dem Zählbeginn, Fehlversuche nach ihrer Wartezeit, der KI-Nachtrag (EIN Aufruf je Takt), „entfallen“ nach
 * 48 h, die Aufbewahrungsfrist. `true` = eine Historienzeile. Ein endgültig gescheitertes Dossier lässt den Lauf mit
 * Fehler enden — die Lauf-Historie zeigt ihn, der System-Alarm steht im Lagezimmer.
 */
export async function leadDossierLauf(lauf: Lauf = sqlPool): Promise<boolean> {
  const einst = await dossierEinstellungen(lauf);
  let gearbeitet = 0;
  const endgueltig: string[] = [];
  if (einst.an) {
    await leadDossierSchema(lauf);
    const ab = await zaehlbeginnSichern(lauf);
    if (einst.sammelAn) {
      const s = await altbestandSammelmail({ lauf, ab });
      if (s.gesendet || s.versucht) gearbeitet += 1;
    }
    // 0. Aufbewahrung (Gutachten Sicherheit): basis/ki nach 180 Tagen leeren, wenn kein Kunde daraus wurde — einmal je Stunde.
    if (Date.now() - letzteAufbewahrung > 60 * 60_000) {
      letzteAufbewahrung = Date.now();
      const geleert = (await lauf`
        UPDATE fiaon_lead_dossier d SET basis = NULL, ki = NULL, antworten = NULL, hinweis = NULL, faden_betreff = NULL,
               grund = 'nach 180 Tagen geleert (kein Kunde)', updated_at = NOW()
         WHERE d.created_at < NOW() - INTERVAL '180 days'
           AND (d.basis IS NOT NULL OR d.ki IS NOT NULL OR d.antworten IS NOT NULL OR d.hinweis IS NOT NULL)
           AND NOT EXISTS (SELECT 1 FROM fiaon_firmen_leads f WHERE f.id = d.firma_id AND f.status = 'kunde')
        RETURNING d.id`.catch(() => [])) as any[];
      if (geleert.length) { gearbeitet += 1; console.log(`[LEAD-DOSSIER] ${geleert.length} Dossier(s) nach 180 Tagen geleert.`); }
    }
    // 1. Anfragen ab dem Zählbeginn ohne Zeile (höchstens drei Tage alt; Meta: der echte Eingang, nie „Rückstand“).
    const fehlende = (await lauf`
      SELECT a.id, a.created_at, m.erstellt_am AS meta_erstellt, m.weg AS meta_weg FROM fiaon_anfragen a
        LEFT JOIN LATERAL (SELECT erstellt_am, weg FROM fiaon_meta_leads WHERE global_anfrage_id = a.id ORDER BY gesehen_am LIMIT 1) m ON TRUE
       WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE)
         AND a.created_at >= ${ab}::timestamptz AND a.created_at > NOW() - INTERVAL '3 days'
         AND NOT EXISTS (SELECT 1 FROM fiaon_lead_dossier d WHERE d.anlass = 'anfrage' AND d.anlass_id = a.id)
       ORDER BY a.id LIMIT 5`) as any[];
    for (const f of fehlende) {
      if (einzelDossierFaellig({ eingangAm: f.created_at, ab, echterEingang: f.meta_erstellt ?? null, weg: f.meta_weg ?? null })) {
        await zeileAnlegen({ anlass: "anfrage", anlassId: Number(f.id) }, lauf);
      }
    }
    // 2. Global-Buchungen ab dem Zählbeginn ohne Zeile (Gutachten 0, Mangel 3: wer selbst bucht, bekommt auch ein Dossier).
    //    E-476 Scheibe 3: nicht, wenn die Buchung an einer Anfrage hängt — deren Dossier gibt es schon, Justin bekommt
    //    „Termin steht“ (D2) im selben Faden.
    await import("./fiaon-lead-weg").then((m) => m.leadWegSchema(lauf)).catch(() => {});
    const buchungen = (await lauf`
      SELECT t.id FROM fiaon_termine t
       WHERE t.quelle = 'global' AND COALESCE(t.herkunft, '') = 'global_seite'
         AND t.created_at >= ${ab}::timestamptz AND t.created_at > NOW() - INTERVAL '3 days'
         AND NOT EXISTS (SELECT 1 FROM fiaon_lead_dossier d WHERE d.anlass = 'termin' AND d.anlass_id = t.id)
         AND NOT EXISTS (SELECT 1 FROM fiaon_lead_gespraech g WHERE g.termin_id = t.id AND g.anfrage_id IS NOT NULL)
       ORDER BY t.id LIMIT 5`.catch(() => [])) as any[];
    for (const t of buchungen) await zeileAnlegen({ anlass: "termin", anlassId: Number(t.id) }, lauf);
    // 3. Offene, fehlgeschlagene (nach ihrer Wartezeit) und hängende Zeilen — höchstens drei je Takt. Höchstens EIN
    //    KI-Aufruf je Takt (Gutachten 0, Mangel 12): Die erste Zeile darf ihn inline machen, die anderen bekommen „folgt“.
    let kiFrei = einst.kiAn;
    const offen = (await lauf`
      SELECT id FROM fiaon_lead_dossier
       WHERE versuche < 3 AND created_at > NOW() - INTERVAL '3 days'
         AND (naechster_versuch_am IS NULL OR naechster_versuch_am <= NOW())
         AND (status IN ('offen', 'fehler') OR (status = 'laeuft' AND laeuft_seit < NOW() - INTERVAL '10 minutes'))
       ORDER BY id LIMIT 3`) as any[];
    for (const o of offen) {
      const r = await verarbeiten(Number(o.id), { kiJetzt: kiFrei }, lauf);
      if (r === "gesendet" || r === "fehler" || r === "endgueltig" || r === "doppelt") { gearbeitet++; kiFrei = false; }
      if (r === "endgueltig") endgueltig.push(`#${o.id}`);
    }
    // 4. Der KI-Nachtrag — gesendete Zeilen bis 48 h. Warten auf die KI (Pause, Rückweg, Deckel, folgt) hat keine
    //    Versuchsgrenze, nur den nächsten Blick (ki_naechster_am); echte Fehlversuche höchstens drei.
    if (kiFrei) {
      const [k] = (await lauf`
        SELECT * FROM fiaon_lead_dossier
         WHERE status = 'gesendet' AND created_at > NOW() - INTERVAL '48 hours'
           AND (ki_naechster_am IS NULL OR ki_naechster_am <= NOW())
           AND ((ki_status IN ('folgt', 'pausiert', 'anbieter', 'deckel') AND updated_at < NOW() - INTERVAL '1 minute')
             OR (ki_status IN ('frist', 'unvollstaendig', 'fehler') AND ki_versuche < 3 AND updated_at < NOW() - INTERVAL '3 minutes')
             OR (ki_status = 'laeuft' AND updated_at < NOW() - INTERVAL '10 minutes'))
         ORDER BY id LIMIT 1`) as any[];
      if (k && (await kiNachholen(k, lauf))) gearbeitet++;
    }
    // 5. Nach 48 h ohne Ergebnis: „entfallen“ mit einer Zeile im Cockpit (Gutachten Justin-Sicht).
    const entfallen = (await lauf`
      UPDATE fiaon_lead_dossier SET ki_status = 'entfallen', ki_grund = 'KI 48 Stunden nicht verfügbar', ki_naechster_am = NULL, updated_at = NOW()
       WHERE status = 'gesendet' AND created_at <= NOW() - INTERVAL '48 hours' AND created_at > NOW() - INTERVAL '10 days'
         AND ki_status IN ('folgt', 'pausiert', 'anbieter', 'deckel', 'frist', 'unvollstaendig', 'fehler', 'laeuft')
      RETURNING id, firma_id`.catch(() => [])) as any[];
    for (const e of entfallen) {
      if (e.firma_id) await lauf`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES (${e.firma_id}, NULL, 'System', 'global', 'dossier', 'Hintergrund-Check entfallen (KI 48 Stunden nicht verfügbar)')`.catch(() => {});
    }
    if (entfallen.length) gearbeitet++;
  }
  if (endgueltig.length) throw new Error(`Lead-Dossier ${endgueltig.join(", ")} nach drei Versuchen nicht gesendet — Alarm im Lagezimmer.`);
  if (gearbeitet > 0) { letzterPuls = Date.now(); return true; }
  if (Date.now() - letzterPuls >= 60 * 60_000) { letzterPuls = Date.now(); return true; }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ALTBESTAND — EINE Sammel-Mail statt einer Flut (abschaltbar)
// ═══════════════════════════════════════════════════════════════════════════
/** Reihenfolge der Karten: ohne jeden Kontakt und heiß zuerst, „hat Termin“ zuletzt (Gutachten Justin-Sicht). Rein. */
export function sammelRang(b: DossierBasis): number {
  if (b.bestand.termine.some((t) => t.kommend)) return 9;
  const ohneKontakt = !b.bestand.cockpit?.letzte && !/angerufen/.test(b.anruf.text);
  const temp = b.temperatur.wert === "heiss" ? 0 : b.temperatur.wert === "warm" ? 1 : 2;
  return (ohneKontakt ? 0 : 3) + temp;
}

/** Die Sammel-Mail: je offenem Alt-Lead eine Kurzkarte (ohne Register, ohne KI). Rein. */
export function sammelMailText(kartenRoh: DossierBasis[], jetzt: Date = new Date()): { betreff: string; text: string } {
  const karten = kartenRoh.map((b, i) => ({ b, i })).sort((x, y) => sammelRang(x.b) - sammelRang(y.b) || x.i - y.i).map((x) => x.b);
  const t: string[] = ["Hallo Justin,", "", `ab heute bekommst du zu jedem neuen Business-Lead eine eigene Mail mit allen Angaben und einem kurzen Check. Hier einmal die ${karten.length} offenen Leads davor — ohne Kontakt und heiß zuerst, Leads mit Termin am Ende:`, ""];
  for (const b of karten) {
    t.push(`■ ${linksEntschaerfen(b.firma.anzeige)} — ${TEMPERATUR_WORT[b.temperatur.wert]} (${b.anfrageId ? `#${b.anfrageId}, ` : ""}${berlinKurz(b.echterEingang ?? b.eingangAm)}, ${b.kanal === "meta" ? "Meta" : "Website"})`);
    t.push(`  ${linksEntschaerfen(b.kontakt.name)}${b.kontakt.telefon ? ` · Telefon: ${b.kontakt.telefonLesbar} (${b.kontakt.tel.landName ?? "ohne Ländervorwahl"})` : ""} · ${b.kontakt.email}${b.kontakt.freemail ? " (Freemail)" : ""}`);
    const antw = [b.paketwunsch ? `Paket: ${linksEntschaerfen(b.paketwunsch)}` : null, ...b.antworten.map((a) => a.antwort)].filter(Boolean);
    if (antw.length) t.push(`  ${antw.join(" · ")}`);
    if (b.nachricht) t.push(`  Nachricht: „${linksEntschaerfen(b.nachricht.replace(/\s+/g, " ").slice(0, 160))}${b.nachricht.length > 160 ? " …" : ""}“`);
    if (b.hinweis) t.push(`  ACHTUNG: klingt nach Privatkunde${b.hinweis.art === "beschwerde" ? " mit Beschwerde" : ""}${b.hinweis.zahlend ? " (zahlende Privat-Bestellung)" : ""}`);
    if (b.bestand.cockpit?.terminOhneKalender) t.push(`  ACHTUNG: Cockpit sagt „Termin“, im Kalender steht keiner — Zeit bei ${b.anruf.wer ?? "der zuständigen Person"} erfragen`);
    for (const x of b.bestand.termine.filter((x) => x.kommend)) t.push(`  Termin${x.agent ? ` bei ${x.agent}` : ""}: ${berlinMitTag(x.beginn)} (${x.quelleText})`);
    for (const g of b.bestand.angebote) t.push(`  Global-Angebot ${g.ref}: ${g.status}${g.gueltigBis ? `, gültig bis ${g.gueltigBis.split("-").reverse().join(".")}` : ""}`);
    const priv = b.bestand.privat.filter((p) => p.kategorie !== "global");
    if (priv.length) t.push(`  Privat-Bestand: ${priv.map((p) => `${p.ref}${p.paket ? ` (${p.paket})` : ""} ${p.bezahlt ? "bezahlt" : "offen"}`).join(", ")}`);
    const stand = [b.bestand.cockpit?.status ? `Cockpit: ${b.bestand.cockpit.status}` : null, b.anruf.auftrag, b.bestand.cockpit?.letzte ? `zuletzt ${b.bestand.cockpit.letzte}` : null].filter(Boolean).join(" · ");
    if (stand) t.push(`  ${stand}`);
    if (b.cockpitUrl) t.push(`  ${b.cockpitUrl}`);
    t.push("");
  }
  t.push("An die Leads selbst ging dabei nichts. Neue Leads kommen ab jetzt einzeln, je Lead in einem eigenen Mail-Faden.");
  const z = berlinZeit(jetzt);
  return { betreff: `Lead-Dossier: ${karten.length} offene Business-Leads vor dem Start (${z.datum})`, text: t.join("\n") };
}

/**
 * Die EINE Sammel-Mail für offene Alt-Leads (vor dem Zählbeginn, höchstens 14 Tage, nicht „kein Interesse“/Test) —
 * einmal, atomar über den Merker lead_dossier_sammel_am. Nachbesserung (Gutachten Technik 05.11.2026): höchstens drei
 * Versuche mit Wartezeit (15/30 Min.), danach still — das Steuerpult zeigt es, der Knopf sendet von Hand. Die Alt-Leads
 * bekommen eine Zeile „sammel“ (nie einzeln).
 */
export async function altbestandSammelmail(opt: { lauf?: Lauf; ab: string; erzwingen?: boolean; an?: string | null }): Promise<{ gesendet: boolean; versucht?: boolean; anzahl: number; grund?: string }> {
  const lauf = opt.lauf ?? sqlPool;
  const einst = await dossierEinstellungen(lauf);
  let merkerAlt: string | null = null;
  let fehlversuche = 0;
  if (!opt.erzwingen) {
    await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${S.sammelAm}, '', NOW()) ON CONFLICT (key) DO NOTHING`;
    const [m] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${S.sammelAm}`) as any[];
    const alt = String(m?.value ?? "");
    const st = sammelStandLesen(alt);
    if (st.gesendetAm) return { gesendet: false, anzahl: 0, grund: "schon gesendet" };
    if (st.nichtsAm) return { gesendet: false, anzahl: 0, grund: "keine offenen Alt-Leads (schon geprüft)" };
    if (st.laeuftSeit && Date.now() - Date.parse(st.laeuftSeit) < 10 * 60_000) return { gesendet: false, anzahl: 0, grund: "läuft gerade" };
    fehlversuche = st.fehlversuche + (st.laeuftSeit ? 1 : 0);
    if (fehlversuche >= 3) return { gesendet: false, anzahl: 0, grund: "drei Versuche gescheitert — nur noch von Hand" };
    if (st.letzterVersuch && Date.now() - Date.parse(st.letzterVersuch) < fehlversuche * 15 * 60_000) return { gesendet: false, anzahl: 0, grund: "wartet auf den nächsten Versuch" };
    // Einmal, atomar: der Merker wechselt nur vom gelesenen Stand — wer ihn nicht bekommt, sendet nicht.
    const [frei] = (await lauf`
      UPDATE fiaon_settings SET value = ${`laeuft:${new Date().toISOString()}`}, updated_at = NOW()
       WHERE key = ${S.sammelAm} AND COALESCE(value, '') = ${alt} RETURNING key`) as any[];
    if (!frei) return { gesendet: false, anzahl: 0, grund: "schon in Arbeit" };
    merkerAlt = alt;
  }
  const alt = (await lauf`
    SELECT a.id, a.created_at FROM fiaon_anfragen a
     WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE)
       AND a.created_at < ${opt.ab}::timestamptz AND a.created_at > NOW() - INTERVAL '14 days'
       AND NOT EXISTS (SELECT 1 FROM fiaon_firmen_leads f WHERE LOWER(COALESCE(f.email, '')) = LOWER(COALESCE(a.email, '')) AND f.status IN ('kein_interesse', 'ungueltig', 'antrag', 'kunde'))
       AND (${!!opt.erzwingen} OR NOT EXISTS (SELECT 1 FROM fiaon_lead_dossier d WHERE d.anlass = 'anfrage' AND d.anlass_id = a.id))
     ORDER BY a.id LIMIT 40`) as any[];
  const karten: DossierBasis[] = [];
  for (const a of alt) {
    if (!sammelKandidat({ eingangAm: a.created_at, ab: opt.ab })) continue;
    try { karten.push(await leadDossierBasis({ anlass: "anfrage", anlassId: Number(a.id) }, { lauf, netz: false })); } catch { /* eine Karte fehlt, die anderen kommen */ }
  }
  if (!karten.length) {
    // Nichts zu senden ist auch ein Abschluss — der Merker sagt „nichts:<Zeit>“ (sonst fragte jeder Takt erneut, und das
    // Steuerpult zeigte „gesendet“, obwohl nichts ging).
    if (merkerAlt !== null) await lauf`UPDATE fiaon_settings SET value = ${`nichts:${new Date().toISOString()}`}, updated_at = NOW() WHERE key = ${S.sammelAm}`.catch(() => {});
    return { gesendet: false, anzahl: 0, grund: "keine offenen Alt-Leads" };
  }
  const m = sammelMailText(karten);
  const links = karten.map((b) => b.cockpitUrl).filter((u): u is string => !!u);
  const v = await mailSenden({ an: opt.an || einst.anAdresse, name: "Justin", betreff: m.betreff, text: m.text, antwortAn: { email: einst.anAdresse, name: "Justin" }, verlinken: links });
  if (!v.ok) {
    // Merker auf „fehler:<n>“ — höchstens drei Versuche, dazwischen Wartezeit (kein Löschen).
    if (merkerAlt !== null) await lauf`UPDATE fiaon_settings SET value = ${`fehler:${fehlversuche + 1}:${new Date().toISOString()}`}, updated_at = NOW() WHERE key = ${S.sammelAm}`.catch(() => {});
    return { gesendet: false, versucht: true, anzahl: karten.length, grund: v.grund };
  }
  if (merkerAlt !== null) await lauf`UPDATE fiaon_settings SET value = ${new Date().toISOString()}, updated_at = NOW() WHERE key = ${S.sammelAm}`.catch(() => {});
  for (const b of karten) {
    await lauf`
      INSERT INTO fiaon_lead_dossier (anlass, anlass_id, anfrage_id, firma_id, kanal, status, grund, basis, temperatur, eingang_am, mail_basis_am, mail_basis_id)
      VALUES ('anfrage', ${b.anlassId}, ${b.anfrageId}, ${b.firmaId}, ${b.kanal}, 'sammel', 'in der Sammel-Mail', ${lauf.json(b as any)}, ${b.temperatur.wert}, ${b.echterEingang ?? b.eingangAm}, NULL, NULL)
      ON CONFLICT (anlass, anlass_id) DO NOTHING`.catch(() => {});
  }
  return { gesendet: true, anzahl: karten.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// VORSCHAU — NUR RENDERN, NIE SENDEN (Lead-Motor-Steuerpult und scripts/lead-dossier-vorschau.ts)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Das Dossier zu einer echten Anfrage, wie es rausginge — ohne Versand, ohne KI, ohne Schreiben (kein Cache, kein
 * Credit-Zähler, keine Zeile). `netz` = Register/Impressum/DNS mitlesen (kostet Register-Credits, nur lesend).
 */
export async function leadDossierVorschau(anfrageId: number, opt: { lauf?: Lauf; netz?: boolean; jetzt?: Date; schreiben?: boolean; ki?: HintergrundErgebnis | null; kiStatus?: string | null; kiGrund?: string | null } = {}): Promise<DossierMail & { basis: DossierBasis; html: string }> {
  const lauf = opt.lauf ?? sqlPool;
  // schreiben: true nur im Steuerpult (Firmensuche-Cache und Credit-Zähler wie im Betrieb) — das Skript gegen die
  // Produktion liest nur (Vorgabe false).
  const b = await leadDossierBasis({ anlass: "anfrage", anlassId: anfrageId }, { lauf, netz: opt.netz !== false, schreiben: opt.schreiben === true, jetzt: opt.jetzt });
  const mail = leadDossierMail(b, opt.ki ?? null, { art: "neu", kiStatus: opt.kiStatus ?? (opt.ki ? null : "vorschau"), kiGrund: opt.kiGrund ?? null });
  const { rahmen } = await import("./fiaon-brevo");
  const html = rahmen(mail.betreff, mail.text, false, { knoepfe: mail.knoepfe, verlinken: mail.links, abschnitteFett: true });
  return { ...mail, basis: b, html };
}

/** Für das Steuerpult: Schalter, Zahlen, die letzten Dossiers. */
export async function leadDossierStand(lauf: Lauf = sqlPool): Promise<any> {
  const einst = await dossierEinstellungen(lauf);
  await leadDossierSchema(lauf).catch(() => {});
  const zeilen = (await lauf`
    SELECT d.id, d.anlass, d.anlass_id, d.kanal, d.status, d.grund, d.temperatur, d.ki_status, d.ki_grund, d.ki_kosten_cents,
           d.mail_basis_am, d.mail_ki_am, d.created_at, d.versuche, d.basis->'firma'->>'anzeige' AS name
      FROM fiaon_lead_dossier d ORDER BY d.id DESC LIMIT 15`.catch(() => [])) as any[];
  const { kostenHeute } = await import("./fiaon-postmeister-schema");
  const kiHeute = await kostenHeute("lead-dossier").catch(() => 0);
  const [cr] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${registerMonatSchluessel(berlinZeit().iso)}`.catch(() => [])) as any[];
  return {
    einstellungen: einst,
    kiHeuteUsd: Math.round(kiHeute * 100) / 100,
    register: { verbraucht: Number(cr?.value) || 0, budget: registerBudget({ monat: einst.registerMonat, reserve: einst.registerReserve }), monat: einst.registerMonat, reserve: einst.registerReserve },
    letzte: zeilen.map((z) => ({
      id: Number(z.id), anlass: z.anlass, anlassId: Number(z.anlass_id), kanal: z.kanal, status: z.status, grund: z.grund, temperatur: z.temperatur,
      kiStatus: z.ki_status, kiGrund: z.ki_grund, kiKostenCents: Number(z.ki_kosten_cents) || 0, gesendetAm: z.mail_basis_am, kiAm: z.mail_ki_am,
      am: z.created_at, versuche: Number(z.versuche), name: z.name ?? null,
    })),
  };
}

/**
 * Prüfversand an Justin: das Dossier einer echten Anfrage (ohne Zeile), Betreff mit „Prüfversand“. Mit `mitKi` (Gutachten
 * Justin-Sicht 05.11.2026) ein ECHTER Hintergrund-Check — unter Not-Aus, Deckel und Sperre, Kosten gebucht —, damit Justin
 * den KI-Teil vor dem ersten echten Lead abnehmen kann. Das Ergebnis steht nur in dieser Mail.
 */
export async function leadDossierPruefversand(anfrageId: number, opt: { mitKi?: boolean; fadenTest?: boolean } = {}): Promise<{ ok: boolean; grund?: string; kiStatus?: string; faden?: "angenommen" | "abgelehnt" | "ohne_id" | null }> {
  const einst = await dossierEinstellungen();
  let ki: HintergrundErgebnis | null = null; let kiStatus: string | null = null; let kiGrund: string | null = null;
  if (opt.mitKi) {
    await leadDossierSchema();
    const b = await leadDossierBasis({ anlass: "anfrage", anlassId: anfrageId }, { netz: true, schreiben: true });
    if (!b.kiErlaubt.erlaubt) { kiStatus = "keine_firma"; kiGrund = b.kiErlaubt.grund; }
    else if (!einst.kiAn) { kiStatus = "aus"; }
    else {
      const aus = await kiVersuchen(b, einst);
      if (aus.ok) { ki = aus.ergebnis; kiStatus = hatNeues(ki) ? "fertig" : "leer"; } else { kiStatus = aus.status; kiGrund = aus.grund; }
    }
  }
  const v = await leadDossierVorschau(anfrageId, { netz: true, schreiben: true, ki, kiStatus: opt.mitKi ? kiStatus : null, kiGrund });
  const betreff = `Prüfversand · ${v.betreff}`;
  const erg = await mailSenden({ an: einst.anAdresse, name: "Justin", betreff, text: v.text, knoepfe: v.knoepfe, verlinken: v.links, abschnitteFett: true, antwortAn: { email: einst.anAdresse, name: "Justin" } });
  if (!erg.ok) return { ok: false, grund: erg.grund };
  // Der Faden-Test (Gutachten Technik 05.11.2026, vor dem Scharfschalten): eine kurze zweite Mail mit In-Reply-To auf die
  // erste. Nimmt Brevo die Kopfzeilen, hängt sie in Gmail unter dem Prüfversand; sonst geht sie ohne raus — das Ergebnis
  // steht im Steuerpult und im Protokoll.
  let faden: "angenommen" | "abgelehnt" | "ohne_id" | null = null;
  if (opt.fadenTest !== false) {
    if (!erg.messageId || !/^<[^<>\s]+>$/.test(erg.messageId)) faden = "ohne_id";
    else {
      const t = await mailSenden({
        an: einst.anAdresse, name: "Justin", betreff: `Re: ${betreff}`,
        text: "Hallo Justin,\n\nFaden-Test: Diese kurze Mail muss in deinem Postfach unter dem Prüfversand hängen. So hängen später alle Meldungen zu einem Lead in einem Faden.",
        kopfzeilen: { "In-Reply-To": erg.messageId, References: erg.messageId }, antwortAn: { email: einst.anAdresse, name: "Justin" },
      });
      faden = t.ok ? (t.ohneKopfzeilen ? "abgelehnt" : "angenommen") : null;
      console.log(`[LEAD-DOSSIER] Prüfversand-Faden-Test: Kopfzeilen ${faden ?? `nicht gesendet (${t.grund})`}`);
    }
  }
  return { ok: true, kiStatus: kiStatus ?? undefined, faden };
}

// ═══════════════════════════════════════════════════════════════════════════
// /justin — die Termin-Meldung kennt den Global-Lead (fiaon-termin-meldung.ts)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Gehört die Person eines /justin-Termins zu einer offenen Global-Anfrage (Mail ODER Telefon, letzte 60 Tage)? Dann
 * Kurzfassung (Firma, Antworten, Fakten aus dem Dossier) und der Faden des Leads. Nur Lesen, schnell (die Buchung wartet
 * darauf) — kein Register, keine KI. null = kein Global-Lead.
 */
export async function globalLeadZuTermin(terminId: number, lauf: Lauf = sqlPool): Promise<{ firmaId: number | null; anfrageId: number; kurz: string; faden: Faden; stamm: string } | null> {
  const [t] = (await lauf`
    SELECT LOWER(COALESCE(p.primary_email, '')) AS email, COALESCE(p.primary_phone, '') AS telefon
      FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id WHERE t.id = ${terminId}`.catch(() => [])) as any[];
  if (!t) return null;
  const k9 = key9(String(t.telefon));
  const [a] = (await lauf`
    SELECT id FROM fiaon_anfragen
     WHERE art = 'global' AND NOT COALESCE(ist_test, FALSE) AND created_at > NOW() - INTERVAL '60 days'
       AND ((${t.email} <> '' AND LOWER(COALESCE(email, '')) = ${t.email})
         OR (${k9} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(telefon, ''), '\\D', '', 'g'), 9) = ${k9}))
     ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (!a) return null;
  let b: DossierBasis | null = null;
  const [d] = (await lauf`SELECT basis FROM fiaon_lead_dossier WHERE anlass = 'anfrage' AND anlass_id = ${a.id} AND basis IS NOT NULL`.catch(() => [])) as any[];
  if (d?.basis) b = jsonObjekt(d.basis) as DossierBasis | null;
  if (!b || !b.kontakt) b = await leadDossierBasis({ anlass: "anfrage", anlassId: Number(a.id) }, { lauf, netz: false, schreiben: false }).catch(() => null);
  if (!b) return null;
  const faden = await fadenLesen(b.firmaId, lauf);
  const kurz = [
    `Business-Lead (FIAON Global, Anfrage #${b.anfrageId}): ${linksEntschaerfen(b.firma.anzeige)} — ${TEMPERATUR_WORT[b.temperatur.wert]} (${linksEntschaerfen(b.temperatur.grund)})`,
    b.paketwunsch ? `– Paketwunsch: ${linksEntschaerfen(b.paketwunsch)}` : null,
    ...b.antworten.map((x) => `– ${antwortZeile(x)}`),
    b.nachricht ? `– Nachricht: „${linksEntschaerfen(b.nachricht.replace(/\s+/g, " ").slice(0, 240))}“` : null,
    `Check: Firma ${FAKT_WORT[b.fakten.firma]} · Mail ${FAKT_WORT[b.fakten.mail]} · ${b.fakten.telefonText}`,
    b.cockpitUrl ? `Firmen-Cockpit: ${b.cockpitUrl}` : null,
  ].filter(Boolean).join("\n");
  return { firmaId: b.firmaId, anfrageId: Number(a.id), kurz, faden, stamm: faden.stamm || stammFuer(b) };
}

/**
 * Die Absage eines /justin-Termins eines Global-Leads im Faden des Leads (Gutachten Justin-Sicht 05.11.2026): Die Zeile
 * der Buchungsmeldung (anlass „termin“) kennt die Firma — daraus Stamm und Kopfzeilen. null = kein Faden.
 */
export async function leadFadenZuTermin(terminId: number, lauf: Lauf = sqlPool): Promise<{ faden: Faden; stamm: string } | null> {
  let [z] = (await lauf`SELECT firma_id, faden_betreff FROM fiaon_lead_dossier WHERE anlass = 'termin' AND anlass_id = ${terminId}`.catch(() => [])) as any[];
  // E-476 Scheibe 3: ein Lead-Gespräch (Link, Kalender, Cockpit, /justin-Weiche) kennt seine Firma aus fiaon_lead_gespraech.
  if (!z?.firma_id) [z] = (await lauf`SELECT firma_id, faden_betreff FROM fiaon_lead_gespraech WHERE termin_id = ${terminId}`.catch(() => [])) as any[];
  if (!z?.firma_id) return null;
  const faden = await fadenLesen(Number(z.firma_id), lauf);
  const stamm = faden.stamm || (z.faden_betreff ? String(z.faden_betreff) : null);
  return stamm ? { faden, stamm } : null;
}
