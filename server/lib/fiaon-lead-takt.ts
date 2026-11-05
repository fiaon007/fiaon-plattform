// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — EIN STAND JE LEAD, DANIELS TAKT, ÜBERSICHT 18:30, WÄCHTER (E-476 Scheibe 5, 05.11.2026)
//
// Justin (05.11.2026, „4× A … Mach alles fix und fertig“). Plan Lead-Weg 2.0, Scheibe 5, mit den Gutachten-Pflichten.
//
// ── DER BEFUND (Plan, 04.11.) ─────────────────────────────────────────────────
// Der Stand eines Leads stand an drei Stellen, die nicht zusammenpassten (Anfrage „neu“, Auftrag „offen“, Firma „termin“ ohne
// Termin). Die Lead-Meldungen gingen an ein privates Postfach und wurden spät bearbeitet. Niemand erfuhr, wenn ein Lead
// wartete; Justin sah abends nicht, was am Tag passiert war; ein leerer Kalender bei laufender Werbung fiel niemandem auf.
//
// ── WAS HIER STEHT ─────────────────────────────────────────────────────────
//   · T1 — Daniels Lead-Meldung an die Adresse „Lead-Meldungen an“ (Entscheidung 3A, Vorgabe: die Visitenkarte der
//     zuständigen Person, heute Daniels Firmenadresse) statt der Auftrag-Mail an die Login-Adresse (die entfällt für
//     Business-Leads: AuftragEin.meldung „eigene“). Angestoßen im Eingang (nie abgewartet), der Lauf holt nach.
//   · Die Erinnerungsleiter 15/60/120 Dienstminuten (Mo–Fr 9–18 Uhr): Daniel, eine Zeile an Justin im Faden des Leads,
//     der Rückruf als Aufgabe an die Vertretung, der Zusage-Wächter. Je Stufe einmal, nur in der Dienstzeit.
//   · Die Übersicht 18:30 an Justin und an die Lead-Meldungen-Adresse (werktags, atomarer Tagesmerker).
//   · Die Wächter im Lagezimmer (System-Alarme): Kalender leer bei laufender Werbung, Lead ohne Dossier, Lead-Mail
//     gescheitert oder nicht zugestellt. „Meta-Webhook still“ steht in fiaon-meta-leads.ts (bekannter Zustand, einmal).
//   · Der EINE Stand (leadStandSetzen — im Cockpit als globalLeadStandSetzen): Die Anfrage folgt dem Cockpit, der
//     Anruf-Auftrag schließt sich, bleibt offen oder geht wieder auf. Dazu die Stand-Leiste des Cockpits und die einmalige
//     Ableitung des Altbestands (nur auf Knopf, mit Justins Go).
//
// Schema: Migration 131 + dieselbe DDL hier (leadTaktSchema) — nie im Eingang. Mails nur im Betrieb (CRONS_AN) oder über
// die Prüfstand-Attrappe. Repo öffentlich: keine Kundendaten im Code.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { CRONS_AN } from "./fiaon-crons";
import { absoluteUrl } from "../fiaon-base-url";
import { berlinZeitpunkt } from "./fiaon-time";
import {
  LEAD_TAKT_SCHLUESSEL as S, LEAD_TAKT_VORGABE as V, schalterLesen, meldeZielFuerAuftrag, anfrageStandAus, auftragNachEreignis,
  firmaStandKorrektur, STAND_ABSCHLUSS, ANFRAGE_STAND_WORT, type LeadStandEreignis,
} from "@shared/fiaon-lead-takt";
import { LEAD_GESPRAECH_HERKUENFTE } from "@shared/fiaon-lead-weg";
import {
  berlinZeit, landAusTelefon, telefonLesbar, leadAnzeigeName, mailDomainAus, istFreemail, firmenDomain, paketwunschAus,
  leadTemperatur, linksEntschaerfen, einzelDossierFaellig, ANRUF_ERGEBNIS_TEXT, TEMPERATUR_WORT,
  type LeadAntwort, type LeadTemperatur,
} from "@shared/fiaon-global-lead";
import { isoPlus, wunschzeitErkennen } from "@shared/fiaon-global-lead-texte";
import {
  t1Mail, erinnerungMail, justinEskalationMail, vertretungAuftragText, eskalationPlanen, uebersichtFaellig, uebersichtMail,
  kalenderWaechter, dienstMinuten, imDienst, feiertagDE, antwortenKurz, tagUhr, uhr, erinnerungSammelMail, justinSammelMail, t1NachtragMail,
  type TaktMail, type UebersichtDaten, type UebersichtLead, type TelefonTeil, type EskStufe, type SammelZeile,
} from "./fiaon-lead-takt-regeln";
import type { EigeneMail } from "./fiaon-brevo";

type Lauf = typeof sqlPool;

const jsonObjekt = (v: unknown): any => {
  let o: any = v;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  return o && typeof o === "object" ? o : null;
};
const d = (v: unknown): Date | null => (v ? new Date(v as any) : null);

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA (gleich Migration 131) — nie im Eingangs-Pfad
// ═══════════════════════════════════════════════════════════════════════════
let schemaBereit: Promise<void> | null = null;
export function leadTaktSchema(lauf: Lauf = sqlPool): Promise<void> {
  if (!schemaBereit) {
    schemaBereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_lead_takt (
          anfrage_id INTEGER PRIMARY KEY,
          firma_id INTEGER,
          eingang_am TIMESTAMPTZ NOT NULL,
          t1_am TIMESTAMPTZ,
          t1_an TEXT,
          t1_id TEXT,
          t1_betreff TEXT,
          t1_status TEXT,
          t1_grund TEXT,
          t1_versuche INTEGER NOT NULL DEFAULT 0,
          t1_laeuft TIMESTAMPTZ,
          geoeffnet_am TIMESTAMPTZ,
          geoeffnet_von TEXT,
          e15_am TIMESTAMPTZ,
          e60_am TIMESTAMPTZ,
          e120_am TIMESTAMPTZ,
          vertretung_am TIMESTAMPTZ,
          vertretung_name TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      // Nachbesserung (Gutachten Sicherheit, Mangel 6): schriftlich abgesagt — die Erinnerungsleiter schweigt.
      await lauf`ALTER TABLE fiaon_lead_takt ADD COLUMN IF NOT EXISTS abgesagt_am TIMESTAMPTZ`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_takt_firma_idx ON fiaon_lead_takt (firma_id) WHERE firma_id IS NOT NULL`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_takt_eingang_idx ON fiaon_lead_takt (eingang_am)`;
    })().catch((e) => { schemaBereit = null; throw e; });
  }
  return schemaBereit;
}

/** Alle Tabellen, die der Takt liest (Dossier, Lead-Weg, Lead-Post, Takt) — im Lauf und im Steuerpult, nie im Eingang. */
async function tabellenBereit(lauf: Lauf): Promise<void> {
  await leadTaktSchema(lauf);
  await import("./fiaon-lead-weg").then((m) => m.leadWegSchema(lauf)).catch(() => {});
  await import("./fiaon-global-lead-post").then((m) => m.leadPostSchema(lauf)).catch(() => {});
  await import("./fiaon-lead-dossier").then((m) => m.leadDossierSchema(lauf)).catch(() => {});
}
/** Für das Cockpit (Anruf-Ergebnis, Stand-Leiste) — eine Mitarbeiter-Handlung, kein Eingang. Wirft nie. */
export async function leadTaktBereit(lauf: Lauf = sqlPool): Promise<void> {
  await tabellenBereit(lauf).catch((e) => console.error("[LEAD-TAKT] Tabellen:", String((e as Error)?.message ?? e).slice(0, 160)));
}

// ═══════════════════════════════════════════════════════════════════════════
// EINSTELLUNGEN — Takt und Übersicht Vorgabe AN (Entscheidung 3A: interne Meldungen, keine Kundenmail)
// ═══════════════════════════════════════════════════════════════════════════
export interface TaktEinstellungen {
  /** Die Erinnerungen 15/60/120 (Vorgabe AN). */
  taktAn: boolean;
  /** Die Lead-Meldung T1 (Vorgabe AN) — getrennt von den Erinnerungen (Gutachten Technik Mangel 2, Betreiber Mangel 9). */
  meldungT1An: boolean;
  uebersichtAn: boolean; ab: string | null; meldungAnRoh: string | null; uebersichtTag: string | null; webhookStill: string | null;
}

export async function taktEinstellungen(lauf: Lauf = sqlPool): Promise<TaktEinstellungen> {
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key = ANY(${Object.values(S) as unknown as string[]})`.catch(() => [])) as any[];
  const w = new Map<string, string>(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  const ab = String(w.get(S.ab) ?? "").trim();
  return {
    taktAn: schalterLesen(w.get(S.taktAn), true), meldungT1An: schalterLesen(w.get(S.meldungT1An), true), uebersichtAn: schalterLesen(w.get(S.uebersichtAn), true),
    ab: ab && Number.isFinite(Date.parse(ab)) ? ab : null, meldungAnRoh: w.get(S.meldungAn) ?? null,
    uebersichtTag: w.get(S.uebersichtTag) ?? null, webhookStill: w.get(S.webhookStill) || null,
  };
}

async function einstellungSetzen(key: string, wert: string, lauf: Lauf): Promise<void> {
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

/**
 * Ein Schalter im Lead-Motor. Nachbesserung (Gutachten Betreiber, Mangel 9 b): Lead-Meldung oder Erinnerungen EIN setzen den
 * Zählbeginn IMMER auf jetzt — Leads aus der Aus-Zeit bekommen keine nachgeholte Meldung und keine Erinnerung auf einmal.
 */
export async function taktSchalten(welcher: "meldung" | "takt" | "uebersicht", an: boolean, lauf: Lauf = sqlPool): Promise<TaktEinstellungen> {
  await einstellungSetzen(welcher === "meldung" ? S.meldungT1An : welcher === "takt" ? S.taktAn : S.uebersichtAn, an ? "1" : "0", lauf);
  if ((welcher === "takt" || welcher === "meldung") && an) await einstellungSetzen(S.ab, new Date().toISOString(), lauf);
  return taktEinstellungen(lauf);
}

/**
 * Der Zählbeginn: einmal gesetzt (Migration 131 beim Deploy, sonst der erste Lauf — atomar). Leads davor bekommen weder T1
 * noch Erinnerung. Nachbesserung (Gutachten Technik, Mangel 3): Setzt ihn der Anstoß eines Eingangs (`frueher` = sein Eingang),
 * gilt der FRÜHERE der beiden Zeitpunkte — der erste Lead nach dem Deploy ist nie „Altbestand“.
 */
export async function zaehlbeginnSichern(lauf: Lauf = sqlPool, frueher?: Date | null): Promise<string> {
  const beginn = new Date(Math.min(Date.now(), frueher && Number.isFinite(frueher.getTime()) ? frueher.getTime() - 1000 : Date.now())).toISOString();
  await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${S.ab}, ${beginn}, NOW()) ON CONFLICT (key) DO NOTHING`;
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${S.ab}`) as any[];
  const v = String(r?.value ?? "");
  if (Number.isFinite(Date.parse(v))) return v;
  // Ein leerer Wert (von Hand gelöscht) gilt wie „fehlt“ — der Takt beginnt jetzt (bzw. mit dem auslösenden Eingang).
  await lauf`UPDATE fiaon_settings SET value = ${beginn}, updated_at = NOW() WHERE key = ${S.ab} AND COALESCE(value, '') = ${v}`;
  return beginn;
}

// ═══════════════════════════════════════════════════════════════════════════
// „LEAD-MELDUNGEN AN“ (Entscheidung 3A)
// ═══════════════════════════════════════════════════════════════════════════
async function gruenderId(): Promise<number> {
  try { return await (await import("../routes/fiaon-gruender-termin")).gruenderAgentId(); } catch { return 0; }
}

export interface MeldeZiel {
  an: string; quelle: "einstellung" | "visitenkarte" | "vorgabe" | "anmeldung" | "team"; karte: string | null;
  fuerAgentId: number | null; fuerName: string | null; fuerVorname: string | null;
  /** Der Auftrag liegt bei jemand anderem als der zuständigen Person, und die Meldung geht ans Team-Postfach. */
  fremd: boolean;
}

/**
 * Wohin Daniels Lead-Meldungen gehen — für die zuständige Person „Lead-Meldungen an“; liegt der Auftrag bei jemand anderem
 * (Vertretung, Abwesenheit, Umhängen), an DESSEN Firmenadresse (Visitenkarte, sonst eine @fiaon.com-Anmeldung), sonst ans
 * Team-Postfach — nie an ein privates Postfach (Gutachten Technik Mangel 2, Sicherheit Mangel 10).
 */
export async function leadMeldungZiel(lauf: Lauf = sqlPool, agentId?: number | null): Promise<MeldeZiel> {
  const einst = await taktEinstellungen(lauf);
  const z = await import("./fiaon-global-termin").then((m) => m.globalZustaendig()).catch(() => null);
  let fuer: { id: number; name: string; vorname: string; email: string | null } | null = null;
  if (agentId) {
    const [a] = (await lauf`SELECT id, name, email, COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1)) AS vorname FROM fiaon_agents WHERE id = ${agentId}`.catch(() => [])) as any[];
    if (a) fuer = { id: Number(a.id), name: String(a.name || ""), vorname: String(a.vorname || a.name || ""), email: a.email ? String(a.email) : null };
  }
  if (!fuer && z) fuer = { id: z.id, name: z.name, vorname: z.vorname, email: z.email ?? null };
  const w = meldeZielFuerAuftrag({ einstellung: einst.meldungAnRoh, zustaendigId: z?.id ?? fuer?.id ?? null, auftragAgentId: fuer?.id ?? null, loginEmail: fuer?.email ?? null });
  return { an: w.an, quelle: w.quelle, karte: w.karte, fremd: w.fremd && w.quelle === "team", fuerAgentId: fuer?.id ?? null, fuerName: fuer?.name ?? null, fuerVorname: fuer?.vorname ?? null };
}

/**
 * Für andere Aufträge zu Business-Leads (Antwort an Justin, „Ergebnis bei Justin erfragen“, Erstgespräch im Team-Modus):
 * die Mail „Neuer Auftrag für dich“ an die Lead-Meldungen-Adresse statt an die Login-Adresse — nur, wenn der Auftrag bei
 * der zuständigen Person landet (AuftragEin.meldung in fiaon-betreiber-todo.ts). Wirft nie.
 */
export async function leadAuftragMeldung(lauf: Lauf = sqlPool): Promise<{ an: string; fuerAgentId: number } | null> {
  try {
    const z = await leadMeldungZiel(lauf);
    return z.fuerAgentId ? { an: z.an, fuerAgentId: z.fuerAgentId } : null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERSAND (Prüfstand-Haken) — Mails an Daniel und Justin über Brevo (eigeneMailSenden)
// ═══════════════════════════════════════════════════════════════════════════
type Versand = (m: EigeneMail) => Promise<{ ok: boolean; messageId: string | null; grund?: string; ohneKopfzeilen?: boolean }>;
let versandAttrappe: Versand | null = null;
/** Prüfstand: den Versand ersetzen (null = Brevo über eigeneMailSenden). */
export function leadTaktVersandSetzen(f: Versand | null): void { versandAttrappe = f; }
function versandErlaubt(): boolean { return CRONS_AN || !!versandAttrappe; }
async function mailSenden(m: EigeneMail): Promise<{ ok: boolean; messageId: string | null; grund?: string; ohneKopfzeilen?: boolean }> {
  if (versandAttrappe) return versandAttrappe(m);
  const { eigeneMailSenden } = await import("./fiaon-brevo");
  return eigeneMailSenden(m);
}
async function justinAdresse(lauf: Lauf): Promise<string> {
  const { dossierEinstellungen } = await import("./fiaon-lead-dossier");
  return (await dossierEinstellungen(lauf)).anAdresse;
}
function alsMail(m: TaktMail, an: string, name: string, antwortAn: string, kopfzeilen?: Record<string, string> | null): EigeneMail {
  return { an, name, betreff: m.betreff, text: m.text, knoepfe: m.knoepfe, verlinken: m.links, abschnitteFett: true, antwortAn: { email: antwortAn, name: "Justin" }, ...(kopfzeilen ? { kopfzeilen } : {}) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE EINES LEADS — ein Lesen für T1, Erinnerung, Stand, Stand-Leiste, Übersicht
// ═══════════════════════════════════════════════════════════════════════════
export interface TaktLage {
  anfrageId: number; firmaId: number | null; personId: number | null;
  name: string; firmaRoh: string; email: string; telefon: string; status: string; istTest: boolean; kanal: "meta" | "website";
  eingangAm: Date; antworten: LeadAntwort[]; nachricht: string | null; paketwunsch: string | null; temperatur: LeadTemperatur | null;
  auftrag: { id: number; status: string; gelesen: boolean; agentId: number | null; agentName: string | null } | null;
  rueckruf: { id: number; status: string } | null;
  takt: any | null;
  w: { status: string | null; am: Date | null; grund: string | null; versuche: number } | null;
  anrufeN: number; ersterAnruf: Date | null; letzterAnruf: { ergebnis: string; am: Date; wer: string | null } | null;
  termin: { id: number; beginn: Date; status: string; bei: string | null } | null;
  terminGebucht: boolean; gefuehrt: boolean;
  firmaStatus: string | null; firmaQuelle: string | null;
  dossierId: number | null; vermerk: string | null;
  /** Nachbesserung E-476: Justin ruft selbst an (Knopf im Dossier, Gutachten Betreiber Mangel 2). */
  selbst: Date | null;
  /** „Wann erreichen wir Sie am besten?“ und Englisch (Gutachten Betreiber, Mangel 3). */
  wunschzeit: string | null; englisch: boolean;
  /** „keine Mails“ (anrufen erlaubt) und die schriftliche Absage (kein Anruf mehr) — Gutachten Sicherheit, Mangel 6. */
  keineMails: boolean; abgesagt: boolean;
}

/** Die Firma (Cockpit) zu einer Anfrage: aus Lead-Weg/Takt/Gespräch, sonst über die Person oder die Mail. */
async function firmaZurAnfrage(a: { id: number; email: string; personId: number | null }, lauf: Lauf): Promise<{ id: number; status: string | null; quelle: string | null; personId: number | null } | null> {
  const [bek] = (await lauf`
    SELECT COALESCE(
      (SELECT firma_id FROM fiaon_lead_weg WHERE anfrage_id = ${a.id}),
      (SELECT firma_id FROM fiaon_lead_takt WHERE anfrage_id = ${a.id}),
      (SELECT firma_id FROM fiaon_lead_gespraech WHERE anfrage_id = ${a.id} AND firma_id IS NOT NULL ORDER BY created_at DESC LIMIT 1)) AS id`.catch(() => [])) as any[];
  const [f] = (await lauf`
    SELECT id, status, quelle, person_id FROM fiaon_firmen_leads
     WHERE id = ${bek?.id ? Number(bek.id) : 0}
        OR (${a.personId}::int IS NOT NULL AND person_id = ${a.personId}::int)
        OR (${a.email} <> '' AND LOWER(COALESCE(email, '')) = ${a.email})
     ORDER BY (id = ${bek?.id ? Number(bek.id) : 0}) DESC, COALESCE(person_id = ${a.personId}::int, FALSE) DESC, id ASC LIMIT 1`.catch(() => [])) as any[];
  return f ? { id: Number(f.id), status: f.status ? String(f.status) : null, quelle: f.quelle ? String(f.quelle) : null, personId: f.person_id ? Number(f.person_id) : null } : null;
}

export async function taktLageLesen(anfrageId: number, lauf: Lauf = sqlPool): Promise<TaktLage | null> {
  const [a] = (await lauf`
    SELECT a.id, a.name, a.email, a.firma, a.telefon, a.text, a.ip, a.person_id, a.created_at, COALESCE(a.status, 'neu') AS status,
           COALESCE(a.ist_test, FALSE) AS ist_test,
           (SELECT meta_lead_id FROM fiaon_meta_leads m WHERE m.global_anfrage_id = a.id LIMIT 1) AS meta_lead_id
      FROM fiaon_anfragen a WHERE a.id = ${anfrageId} AND a.art = 'global'`.catch(async () => (await lauf`
    SELECT a.id, a.name, a.email, a.firma, a.telefon, a.text, a.ip, a.person_id, a.created_at, COALESCE(a.status, 'neu') AS status,
           COALESCE(a.ist_test, FALSE) AS ist_test, NULL AS meta_lead_id
      FROM fiaon_anfragen a WHERE a.id = ${anfrageId} AND a.art = 'global'`))) as any[];
  if (!a) return null;
  const email = String(a.email ?? "").trim().toLowerCase();
  const personId = a.person_id ? Number(a.person_id) : null;
  const text = String(a.text ?? "");
  const meta = a.ip === "meta-sofortformular" || !!a.meta_lead_id;
  const leer = text.indexOf("\n\n");
  const kopf = leer >= 0 ? text.slice(0, leer) : text;
  const rumpf = leer >= 0 ? text.slice(leer + 2).trim() : "";
  const eingangAm = new Date(a.created_at);
  const firma = await firmaZurAnfrage({ id: anfrageId, email, personId }, lauf);
  const antworten = await import("./fiaon-global-lead-post").then((m) => m.antwortenDerAnfrage(anfrageId, lauf)).catch(() => [] as LeadAntwort[]);
  const paketwunsch = paketwunschAus(kopf);
  const [dd] = (await lauf`SELECT id, temperatur, basis->'hinweis' AS hinweis, selbst_am FROM fiaon_lead_dossier WHERE anlass = 'anfrage' AND anlass_id = ${anfrageId} LIMIT 1`.catch(() => [])) as any[];
  const tempGespeichert = dd?.temperatur && ["heiss", "warm", "kalt", "offen"].includes(String(dd.temperatur)) ? (String(dd.temperatur) as LeadTemperatur) : null;
  const temperatur = tempGespeichert ?? leadTemperatur(antworten, meta ? "meta" : "website", { paketwunsch }).wert;
  const auftraege = (await lauf`
    SELECT id, schluessel, status, agent_gelesen_am, zustaendig_agent_id, zustaendig_name FROM fiaon_betreiber_todos
     WHERE schluessel = ANY(${[`global-anfrage:${anfrageId}`, `global-rueckruf:${anfrageId}`]})`.catch(() => [])) as any[];
  const au = auftraege.find((x) => x.schluessel === `global-anfrage:${anfrageId}`);
  const rr = auftraege.find((x) => x.schluessel === `global-rueckruf:${anfrageId}`);
  const [takt] = (await lauf`SELECT * FROM fiaon_lead_takt WHERE anfrage_id = ${anfrageId}`.catch(() => [])) as any[];
  const [w] = (await lauf`SELECT willkommen_status, willkommen_am, willkommen_grund, willkommen_versuche, abgemeldet_am FROM fiaon_lead_weg WHERE anfrage_id = ${anfrageId}`.catch(() => [])) as any[];
  const [an] = firma ? ((await lauf`
    SELECT COUNT(*)::int AS n, MIN(created_at) AS erster,
           (ARRAY_AGG(ergebnis ORDER BY created_at DESC))[1] AS ergebnis, MAX(created_at) AS am,
           (ARRAY_AGG(agent_name ORDER BY created_at DESC))[1] AS wer
      FROM fiaon_firmen_log WHERE firma_id = ${firma.id} AND art = 'anruf' AND created_at > ${eingangAm}::timestamptz - INTERVAL '5 minutes'`.catch(() => [])) as any[]) : [];
  // Der Termin: ein Lead-Gespräch an dieser Anfrage oder Firma — sonst ein Global-/Gründer-Termin der Person (auch aus der
  // Zeit vor E-476, ohne Zeile in fiaon_lead_gespraech). „Gebucht“ zählt ohne Zeitgrenze: Ein vergangenes Gespräch ohne
  // Ergebnis bleibt „Termin“, bis das Ergebnis eingetragen ist (dafür gibt es die Aufgabe „Ergebnis fehlt“).
  // Nachbesserung (Gutachten Betreiber, Mangel 1): auch über die Mail ODER die letzten neun Ziffern der Nummer von Anfrage und
  // Firma — eine /justin-Buchung vor E-476 legte eine eigene Privat-Person an, Firma und Anfrage tragen dann keine person_id.
  const pid = firma?.personId ?? personId;
  const [fk] = firma ? ((await lauf`SELECT LOWER(COALESCE(email, '')) AS email, COALESCE(telefon, '') AS telefon FROM fiaon_firmen_leads WHERE id = ${firma.id}`.catch(() => [])) as any[]) : [];
  const mails = Array.from(new Set([email, String(fk?.email ?? "")].filter(Boolean)));
  const k9s = Array.from(new Set([String(a.telefon ?? ""), String(fk?.telefon ?? "")].map((t) => { const d9 = t.replace(/\D/g, ""); return d9.length >= 7 ? d9.slice(-9) : ""; }).filter(Boolean)));
  const [tm] = (await lauf`
    SELECT t.id, t.beginn, t.status, ag.name AS bei FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.status IN ('gebucht', 'erledigt', 'verpasst', 'abgesagt')
       AND (t.id IN (SELECT termin_id FROM fiaon_lead_gespraech WHERE anfrage_id = ${anfrageId} OR (${firma?.id ?? 0} > 0 AND firma_id = ${firma?.id ?? 0}))
         OR (t.quelle IN ('global', 'gruender') AND t.created_at > ${eingangAm}::timestamptz - INTERVAL '30 days'
             AND ((${pid}::int IS NOT NULL AND t.person_id = ${pid}::int)
               OR t.person_id IN (SELECT p.id FROM fiaon_persons p
                                   WHERE LOWER(COALESCE(p.primary_email, '')) = ANY(${mails.length ? mails : ["-"]})
                                      OR RIGHT(REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) = ANY(${k9s.length ? k9s : ["-"]})))))
     ORDER BY (t.status = 'gebucht') DESC, t.beginn DESC LIMIT 1`.catch(() => [])) as any[];
  const hinweis = jsonObjekt(dd?.hinweis);
  return {
    anfrageId, firmaId: firma?.id ?? null, personId: pid ?? null,
    name: String(a.name ?? "").trim(), firmaRoh: String(a.firma ?? "").trim(), email, telefon: String(a.telefon ?? "").trim(),
    status: String(a.status), istTest: !!a.ist_test, kanal: meta ? "meta" : "website", eingangAm, antworten,
    nachricht: meta ? null : rumpf ? rumpf.slice(0, 1500) : null, paketwunsch, temperatur,
    auftrag: au ? { id: Number(au.id), status: String(au.status), gelesen: !!au.agent_gelesen_am, agentId: au.zustaendig_agent_id ? Number(au.zustaendig_agent_id) : null, agentName: au.zustaendig_name ? String(au.zustaendig_name) : null } : null,
    rueckruf: rr ? { id: Number(rr.id), status: String(rr.status) } : null,
    takt: takt ?? null,
    w: w ? { status: w.willkommen_status ?? null, am: d(w.willkommen_am), grund: w.willkommen_grund ?? null, versuche: Number(w.willkommen_versuche) || 0 } : null,
    anrufeN: Number(an?.n) || 0, ersterAnruf: d(an?.erster),
    letzterAnruf: an?.am ? { ergebnis: String(an.ergebnis ?? ""), am: new Date(an.am), wer: an.wer ? String(an.wer) : null } : null,
    termin: tm ? { id: Number(tm.id), beginn: new Date(tm.beginn), status: String(tm.status), bei: tm.bei ? String(tm.bei) : null } : null,
    terminGebucht: tm?.status === "gebucht", gefuehrt: tm?.status === "erledigt",
    firmaStatus: firma?.status ?? null, firmaQuelle: firma?.quelle ?? null,
    dossierId: dd?.id ? Number(dd.id) : null,
    vermerk: hinweis?.art === "beschwerde" ? "Die Nachricht klingt nach Beschwerde — bitte vorsichtig." : hinweis ? "Klingt nach Privatkunde — bitte im Gespräch klären." : null,
    selbst: d(dd?.selbst_am),
    wunschzeit: (/^Wunschzeit:\s*(.+)$/m.exec(kopf)?.[1] ?? "").trim() || null,
    englisch: /^Sprache:\s*Englisch/m.test(text),
    keineMails: !!w?.abgemeldet_am, abgesagt: !!takt?.abgesagt_am,
  };
}

/** Hat jemand reagiert (für 15/60)? Auftrag oder Cockpit geöffnet, Anruf, Termin, Auftrag zu, Abschluss im Cockpit. */
export function hatReagiert(l: TaktLage): boolean {
  return hatAngerufen(l) || !!l.auftrag?.gelesen || !!l.takt?.geoeffnet_am;
}
/** Ist ein Anruf eingetragen (für den Zusage-Wächter)? Oder ein Termin, ein geschlossener Auftrag, ein Abschluss. */
export function hatAngerufen(l: TaktLage): boolean {
  return l.anrufeN > 0 || l.terminGebucht || l.gefuehrt || l.auftrag?.status === "erledigt" || !l.auftrag || !!l.selbst || l.abgesagt
    || (!!l.firmaStatus && (STAND_ABSCHLUSS as readonly string[]).includes(l.firmaStatus)) || ["termin", "privat", ...STAND_ABSCHLUSS].includes(l.status);
}

function telefonTeil(roh: string): TelefonTeil {
  const t = landAusTelefon(roh);
  return { lesbar: telefonLesbar(t, roh) || roh, e164: t.e164 ?? null, land: t.landName ?? null };
}

function cockpitUrl(l: Pick<TaktLage, "firmaId">): string {
  return absoluteUrl(l.firmaId ? `/agent/firmen?firma=${l.firmaId}` : "/agent/firmen");
}

/** Was der Lead schon von Justin bekommen hat — ein Satz für Daniel (dritte Person). */
async function mailVonJustinSatz(l: TaktLage, lauf: Lauf): Promise<string> {
  if (l.w?.am) return `Justin hat ihm um ${uhr(l.w.am)} Uhr aus js@ geschrieben — mit seinem persönlichen Terminlink und dem Satz, dass du dich meldest.`;
  if (l.w?.status === "ausgelassen") return `Er bekommt keine Mail von Justin (${linksEntschaerfen(String(l.w.grund ?? "").slice(0, 120))}).`;
  const post = await import("./fiaon-global-lead-post").then((m) => m.leadPostEinstellungen(lauf)).catch(() => null);
  if (!post?.willkommenAn) return "Er hat noch keine Mail von uns — Justins Lead-Mails sind ausgeschaltet. Du bist sein erster Kontakt.";
  return `Justins Mail (js@, mit seinem Terminlink) geht nach ${post.ruheMin} Minuten Ruhe hinaus, wenn er bis dahin nicht gebucht hat — darin steht, dass du dich meldest.`;
}

async function cockpitZeile(firmaId: number | null, ergebnis: string, notiz: string, lauf: Lauf): Promise<void> {
  if (!firmaId) return;
  await lauf`
    INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
    VALUES (${firmaId}, NULL, 'System', 'global', ${ergebnis}, ${notiz.slice(0, 2000)})`.catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
// T1 — DIE LEAD-MELDUNG AN DANIEL
// ═══════════════════════════════════════════════════════════════════════════
export type T1Ergebnis = "gesendet" | "nicht_noetig" | "aus" | "fehler" | "uebersprungen";

async function t1Merken(anfrageId: number, status: string, grund: string, lauf: Lauf): Promise<void> {
  await lauf`UPDATE fiaon_lead_takt SET t1_status = ${status}, t1_grund = ${grund.slice(0, 300)}, t1_laeuft = NULL, updated_at = NOW()
              WHERE anfrage_id = ${anfrageId} AND COALESCE(t1_status, '') <> 'gesendet'`.catch(() => {});
}

/** Ein kurzer Nachtrag im Faden der Lead-Meldung T1 an die Meldeadresse — wirft nie, nur im Betrieb/mit Attrappe. */
async function t1Nachtrag(l: TaktLage, art: "selbst" | "gebucht" | "abgesagt" | "zweiter", lauf: Lauf, extra: { wann?: string | null; zweiteAnfrage?: number | null } = {}): Promise<void> {
  try {
    if (!versandErlaubt() || !l.takt?.t1_am) return;
    const ziel = await leadMeldungZiel(lauf, l.auftrag?.agentId ?? null);
    const m = t1NachtragMail({ art, anzeige: leadAnzeigeName(l.firmaRoh, l.name), wer: ziel.fremd ? "Team" : ziel.fuerVorname || "Team", t1Betreff: l.takt.t1_betreff ? String(l.takt.t1_betreff) : null, wann: extra.wann ?? null, zweiteAnfrage: extra.zweiteAnfrage ?? null, cockpitUrl: cockpitUrl(l) });
    const kopf = l.takt.t1_id && /^<[^<>\s]+>$/.test(String(l.takt.t1_id)) ? { "In-Reply-To": String(l.takt.t1_id), References: String(l.takt.t1_id) } : null;
    const v = await mailSenden(alsMail(m, ziel.an, ziel.fuerName ?? "Team", await justinAdresse(lauf), kopf));
    if (!v.ok) console.error(`[LEAD-TAKT] Nachtrag (${art}) zu #${l.anfrageId} nicht gesendet: ${v.grund}`);
  } catch (e) {
    console.error(`[LEAD-TAKT] Nachtrag (${art}) zu #${l.anfrageId}:`, String((e as Error)?.message ?? e).slice(0, 160));
  }
}

/**
 * Die Lead-Meldung T1 zu einer Anfrage — alle Regeln, dann EIN Versuch (atomar beansprucht, höchstens drei). Nur für
 * Business-Leads ab dem Zählbeginn, mit offenem Anruf-Auftrag (hat er schon gebucht, ist nichts zu tun). Nachbesserung
 * 05.11.2026: eigener Schalter (getrennt von den Erinnerungen), der Zählbeginn nie nach dem auslösenden Eingang, ein zweiter
 * Eingang desselben Leads bekommt keine zweite Meldung, Tagesdeckel gegen eine Flut. Wirft nie.
 */
export async function t1Senden(anfrageId: number, opt: { jetzt?: Date; lauf?: Lauf } = {}): Promise<{ ergebnis: T1Ergebnis; grund: string | null }> {
  const lauf = opt.lauf ?? sqlPool;
  const jetzt = opt.jetzt ?? new Date();
  try {
    if (!versandErlaubt()) return { ergebnis: "aus", grund: "kein Betrieb (CRONS aus)" };
    const einst = await taktEinstellungen(lauf);
    if (!einst.meldungT1An) return { ergebnis: "aus", grund: "die Lead-Meldung ist ausgeschaltet (die Auftrag-Mail geht an die Firmenadresse)" };
    await leadTaktSchema(lauf);
    const l = await taktLageLesen(anfrageId, lauf);
    if (!l) return { ergebnis: "nicht_noetig", grund: "keine Global-Anfrage" };
    // Gutachten Technik, Mangel 3: fehlt der Zählbeginn noch, gilt der Eingang DIESES Leads — er ist nie „Altbestand“.
    const ab = await zaehlbeginnSichern(lauf, l.eingangAm);
    if (l.eingangAm.getTime() < Date.parse(ab)) return { ergebnis: "nicht_noetig", grund: "vor dem Zählbeginn (Altbestand)" };
    if (jetzt.getTime() - l.eingangAm.getTime() > V.hoechstensTage * 86_400_000) return { ergebnis: "nicht_noetig", grund: `älter als ${V.hoechstensTage} Tage` };
    await lauf`
      INSERT INTO fiaon_lead_takt (anfrage_id, firma_id, eingang_am) VALUES (${anfrageId}, ${l.firmaId}, ${l.eingangAm})
      ON CONFLICT (anfrage_id) DO UPDATE SET firma_id = COALESCE(fiaon_lead_takt.firma_id, EXCLUDED.firma_id)`;
    const [z] = (await lauf`SELECT t1_status, t1_versuche FROM fiaon_lead_takt WHERE anfrage_id = ${anfrageId}`) as any[];
    if (z?.t1_status === "gesendet" || z?.t1_status === "nicht_noetig") return { ergebnis: "uebersprungen", grund: `schon ${z.t1_status}` };
    if (Number(z?.t1_versuche) >= V.t1Versuche) return { ergebnis: "fehler", grund: "drei Versuche" };
    if (l.istTest) { await t1Merken(anfrageId, "nicht_noetig", "Test-Anfrage", lauf); return { ergebnis: "nicht_noetig", grund: "Test-Anfrage" }; }
    if (l.status === "privat") { await t1Merken(anfrageId, "nicht_noetig", "Privat-Weg (kein Business-Lead)", lauf); return { ergebnis: "nicht_noetig", grund: "Privat-Weg" }; }
    if (!l.auftrag) { await t1Merken(anfrageId, "nicht_noetig", "kein Anruf-Auftrag (er hatte schon gebucht)", lauf); return { ergebnis: "nicht_noetig", grund: "kein Anruf-Auftrag" }; }
    if (l.auftrag.status === "erledigt") { await t1Merken(anfrageId, "nicht_noetig", "der Anruf-Auftrag ist schon zu (gebucht oder Justin ruft selbst an)", lauf); return { ergebnis: "nicht_noetig", grund: "Auftrag schon zu" }; }

    // ── Zweiter Eingang desselben Leads (Gutachten Betreiber, Mangel 6): gleiche Mail oder Nummer, T1 in den letzten 24 Stunden ──
    const k9 = (() => { const d9 = l.telefon.replace(/\D/g, ""); return d9.length >= 7 ? d9.slice(-9) : ""; })();
    const [erster] = (await lauf`
      SELECT tk.anfrage_id FROM fiaon_lead_takt tk JOIN fiaon_anfragen b ON b.id = tk.anfrage_id
       WHERE tk.anfrage_id <> ${anfrageId} AND tk.t1_status = 'gesendet' AND tk.t1_am > ${jetzt}::timestamptz - INTERVAL '24 hours'
         AND ((${l.email} <> '' AND LOWER(COALESCE(b.email, '')) = ${l.email})
           OR (${k9} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(b.telefon, ''), '\\D', '', 'g'), 9) = ${k9}))
       ORDER BY tk.t1_am LIMIT 1`.catch(() => [])) as any[];
    if (erster?.anfrage_id) {
      const ersteId = Number(erster.anfrage_id);
      await t1Merken(anfrageId, "nicht_noetig", `zweiter Eingang zu Anfrage #${ersteId}`, lauf);
      const { auftragErledigen } = await import("./fiaon-auftraege");
      await auftragErledigen(l.auftrag.id, {
        art: "auto", von: "System", autorArt: "system",
        ergebnis: `Zweiter Eingang desselben Leads — es gilt der Auftrag zu Anfrage #${ersteId} (ein Anruf genügt).`, ereignis: "zweiter Eingang",
      }, lauf).catch(() => false);
      const ersteLage = await taktLageLesen(ersteId, lauf).catch(() => null);
      if (ersteLage) await t1Nachtrag(ersteLage, "zweiter", lauf, { zweiteAnfrage: anfrageId });
      await cockpitZeile(l.firmaId, "lead_meldung", `Zweiter Eingang desselben Leads (zu Anfrage #${ersteId}) — keine zweite Lead-Meldung, ein Anruf genügt.`, lauf);
      return { ergebnis: "nicht_noetig", grund: `zweiter Eingang zu Anfrage #${ersteId}` };
    }

    // ── Tagesdeckel (Gutachten Sicherheit, Mangel 2): eine Flut erfundener Anfragen flutet nie das Team-Postfach ──
    const tagBeginn = berlinZeitpunkt(berlinZeit(jetzt).iso, 0);
    const [heute] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_lead_takt WHERE t1_am >= ${tagBeginn}`.catch(() => [{ n: 0 }])) as any[];
    if (Number(heute?.n) >= V.t1MaxTag) {
      const { alarmMelden } = await import("./fiaon-system-alarme");
      await alarmMelden("lead-takt:flut", {
        quelle: "lead-takt", stufe: "rot", link: "/chef/s/lead-motor", endetNachStunden: 24,
        titel: "Lead-Wächter: ungewöhnlich viele neue Leads — Lead-Meldungen angehalten",
        text: `Heute gingen schon ${V.t1MaxTag} Lead-Meldungen an das Team (Tagesdeckel). Weitere Aufträge stehen im Portal. Bitte prüfen, ob die Anfragen echt sind (Formular-Flut?).`,
      }, lauf).catch(() => ({ neu: false }));
      return { ergebnis: "uebersprungen", grund: `Tagesdeckel (${V.t1MaxTag} Lead-Meldungen heute)` };
    }

    const ziel = await leadMeldungZiel(lauf, l.auftrag.agentId);
    const t1 = t1Mail({
      anfrageId, anzeige: leadAnzeigeName(l.firmaRoh, l.name), name: l.name, kanal: l.kanal, eingangAm: l.eingangAm, antworten: l.antworten,
      nachricht: l.nachricht, paketwunsch: l.paketwunsch, temperatur: l.temperatur, telefon: telefonTeil(l.telefon), email: l.email,
      mailArt: firmenDomain(l.email) ? "firma" : istFreemail(mailDomainAus(l.email)) ? "freemail" : "unklar",
      mailVonJustin: await mailVonJustinSatz(l, lauf), vermerk: l.vermerk, cockpitUrl: cockpitUrl(l),
      wer: ziel.fremd ? "Team" : ziel.fuerVorname || "Team", wunschzeit: l.wunschzeit, englisch: l.englisch, keineMails: l.keineMails,
      auftragBei: ziel.fremd ? ziel.fuerName : null,
    }, jetzt);
    const [frei] = (await lauf`
      UPDATE fiaon_lead_takt SET t1_laeuft = NOW(), t1_versuche = t1_versuche + 1, t1_status = 'laeuft', updated_at = NOW()
       WHERE anfrage_id = ${anfrageId} AND COALESCE(t1_status, '') NOT IN ('gesendet', 'nicht_noetig') AND t1_versuche < ${V.t1Versuche}
         AND (t1_laeuft IS NULL OR t1_laeuft < NOW() - INTERVAL '10 minutes')
      RETURNING anfrage_id`) as any[];
    if (!frei) return { ergebnis: "uebersprungen", grund: "ein anderer Lauf sendet gerade" };
    const v = await mailSenden(alsMail(t1, ziel.an, ziel.fuerName ?? "Team", await justinAdresse(lauf)));
    if (!v.ok) {
      await lauf`UPDATE fiaon_lead_takt SET t1_status = 'fehler', t1_grund = ${String(v.grund ?? "Versand fehlgeschlagen").slice(0, 300)}, t1_laeuft = NULL, updated_at = NOW() WHERE anfrage_id = ${anfrageId}`.catch(() => {});
      console.error(`[LEAD-TAKT] T1 zu Anfrage #${anfrageId} nicht gesendet: ${v.grund}`);
      return { ergebnis: "fehler", grund: v.grund ?? "Versand fehlgeschlagen" };
    }
    await lauf`
      UPDATE fiaon_lead_takt SET t1_am = NOW(), t1_an = ${ziel.an}, t1_id = ${v.messageId}, t1_betreff = ${t1.betreff}, t1_status = 'gesendet',
             t1_grund = NULL, t1_laeuft = NULL, updated_at = NOW()
       WHERE anfrage_id = ${anfrageId}`;
    await cockpitZeile(l.firmaId, "lead_meldung", `Lead-Meldung an ${ziel.fremd ? "das Team-Postfach" : ziel.fuerVorname ?? "das Team"} (${ziel.an}) — mit den Antworten im Klartext und „bitte ${l.wunschzeit ? "zu seiner Wunschzeit" : anrufWannKurz(jetzt)} anrufen“.`, lauf);
    console.log(`[LEAD-TAKT] T1 zu Anfrage #${anfrageId} an ${ziel.an}`);
    return { ergebnis: "gesendet", grund: null };
  } catch (err) {
    const grund = String((err as Error)?.message ?? err).slice(0, 200);
    console.error(`[LEAD-TAKT] T1 #${anfrageId}:`, grund);
    await lauf`UPDATE fiaon_lead_takt SET t1_status = 'fehler', t1_grund = ${grund}, t1_laeuft = NULL, updated_at = NOW() WHERE anfrage_id = ${anfrageId} AND COALESCE(t1_status, '') <> 'gesendet'`.catch(() => {});
    return { ergebnis: "fehler", grund };
  }
}

function anrufWannKurz(jetzt: Date): string {
  return imDienst(jetzt) ? "jetzt" : "ab dem nächsten Werktag um 9 Uhr";
}

/** Der Anstoß nach einem Eingang — angestoßen, NIE abgewartet (der Eingang darf daran nicht scheitern). Nur im Betrieb. */
export function leadTaktAnstossen(anfrageId: number): void {
  if (!CRONS_AN) return;
  void (async () => {
    try { await t1Senden(anfrageId); } catch (err) { console.error(`[LEAD-TAKT] Anstoß #${anfrageId}:`, String((err as Error)?.message ?? err).slice(0, 200)); }
  })();
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ERINNERUNGSLEITER 15 / 60 / 120 (nur Mo–Fr 9–18 Uhr, je Stufe einmal)
// ═══════════════════════════════════════════════════════════════════════════
const STUFE_SPALTE: Readonly<Record<EskStufe, string>> = { e15: "e15_am", e60: "e60_am", e120: "e120_am" };

async function stufeBeanspruchen(anfrageId: number, stufe: EskStufe, lauf: Lauf): Promise<boolean> {
  const spalte = STUFE_SPALTE[stufe];
  const r = (await lauf.unsafe(`UPDATE fiaon_lead_takt SET ${spalte} = NOW(), updated_at = NOW() WHERE anfrage_id = $1 AND ${spalte} IS NULL RETURNING anfrage_id`, [anfrageId]).catch(() => [])) as any[];
  return r.length > 0;
}
async function stufeZurueck(anfrageId: number, stufe: EskStufe, lauf: Lauf): Promise<void> {
  await lauf.unsafe(`UPDATE fiaon_lead_takt SET ${STUFE_SPALTE[stufe]} = NULL WHERE anfrage_id = $1`, [anfrageId]).catch(() => {});
}

/** Der Rückruf als Aufgabe an die Vertretung — einmal je Lead (atomar). Gibt den Namen zurück oder null. */
async function vertretungRueckruf(l: TaktLage, stufe: "e60" | "e120", minuten: number, wer: string, lauf: Lauf): Promise<string | null> {
  const { globalVertretung } = await import("./fiaon-global-gespraech");
  const v = await globalVertretung().catch(() => null);
  if (!v || (l.auftrag?.agentId && v.id === l.auftrag.agentId)) return null;
  const [frei] = (await lauf`UPDATE fiaon_lead_takt SET vertretung_am = NOW(), vertretung_name = ${v.name}, updated_at = NOW() WHERE anfrage_id = ${l.anfrageId} AND vertretung_am IS NULL RETURNING anfrage_id`.catch(() => [])) as any[];
  if (!frei) return l.takt?.vertretung_name ? String(l.takt.vertretung_name) : null;
  const t = vertretungAuftragText({ anfrageId: l.anfrageId, anzeige: leadAnzeigeName(l.firmaRoh, l.name), eingangAm: l.eingangAm, minuten, wer, stufe, telefon: l.telefon, email: l.email });
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const { berlinToday } = await import("./fiaon-time");
    // Auch die Vertretung bekommt Lead-Daten nur an eine Firmenadresse (Entscheidung 3A, Gutachten Sicherheit Mangel 10):
    // ihre Visitenkarte, sonst eine @fiaon.com-Anmeldung, sonst geht die Meldung ans Team-Postfach (zuweisungZiel) — nie privat.
    const { visitenkarteFuerAgent } = await import("@shared/fiaon-visitenkarte");
    const karte = visitenkarteFuerAgent(v.id);
    const team = await leadMeldungZiel(lauf).catch(() => null);
    await auftragFuerKunden({
      personId: null, ref: null, titel: t.titel, text: t.text, faelligAm: berlinToday(), dringend: true,
      schluessel: `global-rueckruf:${l.anfrageId}`, bereich: "sonstiges", quelle: "global", autorName: "FIAON Global",
      link: cockpitUrl(l).replace(/^https?:\/\/[^/]+/, ""), agentId: v.id, vorrang: true,
      anlageText: `Business-Lead wartet seit ${minuten} Minuten — Rückruf als Vertretung (E-476).`,
      meldung: karte?.email ? { an: karte.email, fuerAgentId: v.id } : team ? { an: team.an, fuerAgentId: -1 } : "eigene",
    });
    await cockpitZeile(l.firmaId, "erinnerung", `${v.name} hat den Rückruf als Aufgabe (Vertretung) — der Lead wartete seit ${minuten} Minuten.`, lauf);
    return v.name;
  } catch (e) {
    console.error(`[LEAD-TAKT] Rückruf an die Vertretung zu #${l.anfrageId}:`, String((e as Error)?.message ?? e).slice(0, 160));
    await lauf`UPDATE fiaon_lead_takt SET vertretung_am = NULL, vertretung_name = NULL WHERE anfrage_id = ${l.anfrageId}`.catch(() => {});
    return null;
  }
}

async function zustaendigAbwesend(agentId: number | null, jetzt: Date): Promise<boolean> {
  if (!agentId) return false;
  try {
    const abw = await import("./fiaon-abwesenheit");
    return abw.istAbwesend(await abw.abwesenheitJetzt(sqlPool, jetzt), agentId, jetzt);
  } catch { return false; }
}

/**
 * Prüft die Leads der letzten drei Tage und sendet, was fällig ist. Gibt die Zahl der Meldungen zurück. Wirft nie je Lead.
 * Nachbesserung 05.11.2026 (Gutachten Betreiber Mangel 3/5, Technik Mangel 8, Sicherheit Mangel 6):
 *   · die JÜNGSTEN Leads zuerst (sonst fielen bei vielen Leads gerade die neuen aus dem Fenster);
 *   · nur ab dem Zählbeginn, nie nach einer schriftlichen Absage, ab SEINER Wunschzeit (Rückruf statt Termin);
 *   · gebündelt: mehrere Erinnerungen in einem Takt = EINE Mail an Daniel, mehrere 60-Minuten-Zeilen = EINE Mail an Justin
 *     (die Nacht-Leads um 9:15 kommen als eine Mail);
 *   · ist die zuständige Person laut Abwesenheit nicht da, bekommt sie keine 15-Minuten-Mail (die Vertretung den Rückruf);
 *   · ohne Vertretung ein gelber Hinweis im Lagezimmer — keine Aufforderung an Justin.
 */
export async function eskalationenPruefen(jetzt: Date = new Date(), lauf: Lauf = sqlPool): Promise<number> {
  if (!versandErlaubt()) return 0;
  const einst = await taktEinstellungen(lauf);
  if (!einst.taktAn || !imDienst(jetzt)) return 0;
  await leadTaktSchema(lauf);
  const ab = einst.ab ?? new Date(0).toISOString();
  const kandidaten = (await lauf`
    SELECT tk.anfrage_id FROM fiaon_lead_takt tk JOIN fiaon_anfragen a ON a.id = tk.anfrage_id
     WHERE tk.eingang_am > ${jetzt}::timestamptz - ${V.hoechstensTage}::int * INTERVAL '1 day' AND tk.eingang_am >= ${ab}::timestamptz
       AND COALESCE(tk.t1_status, '') <> 'nicht_noetig' AND tk.abgesagt_am IS NULL
       AND NOT COALESCE(a.ist_test, FALSE) AND COALESCE(a.status, '') <> 'privat'
       AND (tk.e15_am IS NULL OR tk.e60_am IS NULL OR tk.e120_am IS NULL)
     ORDER BY tk.eingang_am DESC LIMIT 40`.catch(() => [])) as any[];
  type Fall = { l: TaktLage; stufen: Set<EskStufe>; daniel: "e15" | "e120" | null; justin: boolean; minuten: number; vertretung: string | null; ziel: MeldeZiel };
  const faelle: Fall[] = [];
  let ohneVertretung = false;
  for (const k of kandidaten) {
    try {
      const l = await taktLageLesen(Number(k.anfrage_id), lauf);
      if (!l || !l.takt || l.abgesagt) continue;
      // „Wann erreichen wir Sie am besten?“ mit Tag und Uhrzeit: die Uhr läuft erst ab dann (Gutachten Betreiber, Mangel 3).
      const w = l.wunschzeit ? wunschzeitErkennen(l.wunschzeit, l.eingangAm) : null;
      const wunschAb = w ? berlinZeitpunkt(w.tag, Number(w.zeit.slice(0, 2)) * 60 + Number(w.zeit.slice(3, 5))) : null;
      const plan = eskalationPlanen({
        eingang: wunschAb && wunschAb > l.eingangAm ? wunschAb : l.eingangAm, jetzt, reagiert: hatReagiert(l), angerufen: hatAngerufen(l),
        gesendet: { e15: !!l.takt.e15_am, e60: !!l.takt.e60_am, e120: !!l.takt.e120_am },
      });
      if (!plan.markieren.length) continue;
      const geholt = new Set<EskStufe>();
      for (const st of plan.markieren) if (await stufeBeanspruchen(l.anfrageId, st, lauf)) geholt.add(st);
      if (!geholt.size) continue;
      const ziel = await leadMeldungZiel(lauf, l.auftrag?.agentId ?? null);
      const wer = ziel.fremd ? "das Team" : ziel.fuerVorname || "das Team";
      // Erst die Vertretung (dann können die Mails sie nennen): ab 60/120 — oder schon nach 15, wenn die zuständige Person
      // laut Abwesenheit nicht da ist.
      const abwesend = await zustaendigAbwesend(l.auftrag?.agentId ?? ziel.fuerAgentId, jetzt);
      let vertretung: string | null = l.takt.vertretung_name ? String(l.takt.vertretung_name) : null;
      if (!vertretung && (plan.vertretung || (abwesend && geholt.has("e15")))) {
        vertretung = await vertretungRueckruf(l, geholt.has("e120") ? "e120" : "e60", plan.minuten, wer, lauf);
        if (!vertretung) ohneVertretung = true;
      }
      // Abwesend: keine 15-Minuten-Mail an die Person, die nicht da ist (die 120er-Zusage bleibt — sie geht auch an das Team).
      const daniel = plan.daniel && geholt.has(plan.daniel) && !(abwesend && plan.daniel === "e15") ? plan.daniel : null;
      faelle.push({ l, stufen: geholt, daniel, justin: plan.justin && geholt.has("e60"), minuten: plan.minuten, vertretung, ziel });
    } catch (e) {
      console.error(`[LEAD-TAKT] Erinnerung zu #${k.anfrage_id}:`, String((e as Error)?.message ?? e).slice(0, 200));
    }
  }
  if (!faelle.length) return 0;
  let gesendet = 0;
  const antwortAn = await justinAdresse(lauf);
  const zeileVon = (f: Fall): SammelZeile => ({
    anzeige: leadAnzeigeName(f.l.firmaRoh, f.l.name), name: f.l.name, minuten: f.minuten, telefon: telefonTeil(f.l.telefon),
    cockpitUrl: cockpitUrl(f.l), stufe: f.daniel ?? "e60", vertretung: f.vertretung, keineMails: f.l.keineMails,
  });

  // ── An Daniel: je Meldeadresse EINE Mail (ein Lead: im Faden seiner Lead-Meldung; mehrere: gebündelt) ──
  const anDaniel = new Map<string, Fall[]>();
  for (const f of faelle) if (f.daniel) { const k = f.ziel.an; if (!anDaniel.has(k)) anDaniel.set(k, []); anDaniel.get(k)!.push(f); }
  for (const [an, liste] of Array.from(anDaniel.entries())) {
    const erste = liste[0];
    const wer = erste.ziel.fremd ? "Team" : erste.ziel.fuerVorname || "Team";
    let m: TaktMail; let kopf: Record<string, string> | null = null;
    if (liste.length === 1) {
      const f = erste;
      m = erinnerungMail({
        stufe: f.daniel!, anzeige: leadAnzeigeName(f.l.firmaRoh, f.l.name), name: f.l.name, telefon: telefonTeil(f.l.telefon), wer, minuten: f.minuten,
        zusage: !!f.l.w?.am, vertretung: f.vertretung, cockpitUrl: cockpitUrl(f.l), t1Betreff: f.l.takt.t1_betreff ? String(f.l.takt.t1_betreff) : null,
        keineMails: f.l.keineMails,
      });
      kopf = f.l.takt.t1_id && /^<[^<>\s]+>$/.test(String(f.l.takt.t1_id)) ? { "In-Reply-To": String(f.l.takt.t1_id), References: String(f.l.takt.t1_id) } : null;
    } else {
      m = erinnerungSammelMail(liste.map(zeileVon), wer, absoluteUrl("/agent/firmen"));
    }
    const v = await mailSenden(alsMail(m, an, erste.ziel.fuerName ?? "Team", antwortAn, kopf));
    if (v.ok) {
      gesendet++;
      for (const f of liste) {
        await cockpitZeile(f.l.firmaId, "erinnerung", f.daniel === "e15"
          ? `Erinnerung an ${wer}: Lead wartet seit ${f.minuten} Minuten (Dienstzeit).`
          : `Zusage-Wächter: seit ${f.minuten} Minuten (Dienstzeit) kein Anruf eingetragen — Hinweis an ${wer}${f.vertretung ? `, Rückruf an ${f.vertretung}` : ""}.`, lauf);
      }
    } else {
      console.error(`[LEAD-TAKT] Erinnerung an ${an} nicht gesendet: ${v.grund}`);
      for (const f of liste) for (const st of Array.from(f.stufen)) if (st !== "e60") await stufeZurueck(f.l.anfrageId, st, lauf);
    }
  }

  // ── An Justin: EINE Zeile je Takt (ein Lead: im Faden des Leads; mehrere: gebündelt) — keine Aufgabe ──
  const anJustin = faelle.filter((f) => f.justin);
  if (anJustin.length === 1) {
    const f = anJustin[0];
    const { fadenLesen, selbstLink } = await import("./fiaon-lead-dossier");
    const faden = await fadenLesen(f.l.firmaId, lauf).catch(() => ({ stamm: null, kopfzeilen: null, erste: true }));
    const m = justinEskalationMail({
      anzeige: leadAnzeigeName(f.l.firmaRoh, f.l.name), name: f.l.name, eingangAm: f.l.eingangAm, wer: f.ziel.fremd ? "das Team" : f.ziel.fuerVorname || "das Team",
      minuten: f.minuten, vertretung: f.vertretung, telefon: telefonTeil(f.l.telefon), cockpitUrl: cockpitUrl(f.l),
      selbstUrl: f.l.dossierId && f.l.auftrag?.status !== "erledigt" ? selbstLink(f.l.dossierId) : null, stamm: faden.stamm,
    });
    const v = await mailSenden(alsMail(m, antwortAn, "Justin", antwortAn, faden.kopfzeilen));
    if (v.ok) { gesendet++; await cockpitZeile(f.l.firmaId, "erinnerung", `Justin informiert: Lead wartet seit ${f.minuten} Minuten (Dienstzeit)${f.vertretung ? `, ${f.vertretung} hat den Rückruf` : ""}.`, lauf); }
    else { console.error(`[LEAD-TAKT] Zeile an Justin zu #${f.l.anfrageId} nicht gesendet: ${v.grund}`); await stufeZurueck(f.l.anfrageId, "e60", lauf); }
  } else if (anJustin.length > 1) {
    const m = justinSammelMail(anJustin.map(zeileVon), anJustin[0].ziel.fuerVorname || "das Team", absoluteUrl("/agent/firmen"));
    const v = await mailSenden(alsMail(m, antwortAn, "Justin", antwortAn));
    if (v.ok) { gesendet++; for (const f of anJustin) await cockpitZeile(f.l.firmaId, "erinnerung", `Justin informiert (Sammelzeile): Lead wartet seit ${f.minuten} Minuten (Dienstzeit).`, lauf); }
    else { console.error(`[LEAD-TAKT] Sammelzeile an Justin nicht gesendet: ${v.grund}`); for (const f of anJustin) await stufeZurueck(f.l.anfrageId, "e60", lauf); }
  }

  // ── Ohne Vertretung: ein gelber Hinweis im Lagezimmer, keine Aufforderung an Justin (Gutachten Betreiber, Mangel 5) ──
  if (ohneVertretung) {
    const { alarmMelden } = await import("./fiaon-system-alarme");
    await alarmMelden("lead-takt:vertretung", {
      quelle: "lead-takt", stufe: "gelb", link: "/chef/s/rueckholung",
      titel: "Lead-Wächter: keine Vertretung für die Gespräche eingetragen",
      text: "Ein Lead wartete über 60 Minuten, und niemand bekam den Rückruf als Aufgabe — es ist keine Vertretung eingetragen. Einmal im Chefbüro › Rückholung › FIAON Global „Vertretung für die Gespräche“ wählen; dann geht der Hinweis von selbst aus.",
    }, lauf).catch(() => ({ neu: false }));
  }
  return gesendet;
}

/** Die Firma wurde im Cockpit geöffnet — zählt als Reaktion (nicht Justin, nicht die Nur-Ansicht der Leitung). Wirft nie. */
export async function geoeffnetMerken(firmaId: number, agent: { id: number; name: string; ansicht?: boolean } | null | undefined, lauf: Lauf = sqlPool): Promise<void> {
  try {
    if (!agent || agent.ansicht || !firmaId) return;
    if (agent.id === (await gruenderId())) return;
    await lauf`
      UPDATE fiaon_lead_takt SET geoeffnet_am = NOW(), geoeffnet_von = ${agent.name}, updated_at = NOW()
       WHERE firma_id = ${firmaId} AND geoeffnet_am IS NULL AND eingang_am > NOW() - ${V.hoechstensTage}::int * INTERVAL '1 day'`.catch(() => {});
  } catch { /* nur eine Marke */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// DER EINE STAND (im Cockpit: globalLeadStandSetzen)
// ═══════════════════════════════════════════════════════════════════════════
/** Die offene Global-Anfrage einer Firma (60 Tage, kein Test, kein Privat-Weg) — die jüngste. */
export async function anfrageZurFirma(firmaId: number, lauf: Lauf = sqlPool): Promise<number | null> {
  const [f] = (await lauf`SELECT email, telefon, person_id FROM fiaon_firmen_leads WHERE id = ${firmaId}`.catch(() => [])) as any[];
  if (!f) return null;
  const [bek] = (await lauf`
    SELECT anfrage_id FROM (
      SELECT anfrage_id, created_at FROM fiaon_lead_weg WHERE firma_id = ${firmaId}
      UNION ALL SELECT anfrage_id, created_at FROM fiaon_lead_takt WHERE firma_id = ${firmaId}
      UNION ALL SELECT anfrage_id, created_at FROM fiaon_lead_gespraech WHERE firma_id = ${firmaId} AND anfrage_id IS NOT NULL) x
     JOIN fiaon_anfragen a ON a.id = x.anfrage_id
     WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE) AND COALESCE(a.status, '') <> 'privat' AND a.created_at > NOW() - INTERVAL '60 days'
     ORDER BY a.created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (bek?.anfrage_id) return Number(bek.anfrage_id);
  const { offeneAnfrageFuer } = await import("./fiaon-lead-weg");
  return (await offeneAnfrageFuer(f.email, f.telefon, lauf).catch(() => null))?.anfrageId ?? null;
}

/** Ist diese Firma ein Business-Lead (Gutachten 0, Mangel 9)? Quelle „global“, selbst gemeldet, oder eine offene Anfrage. */
export async function istBusinessLead(firma: { id: number; quelle?: string | null; global_am?: unknown }, lauf: Lauf = sqlPool): Promise<{ lead: boolean; anfrageId: number | null }> {
  const anfrageId = await anfrageZurFirma(Number(firma.id), lauf).catch(() => null);
  return { lead: !!anfrageId || String(firma.quelle ?? "") === "global" || !!firma.global_am, anfrageId };
}

/**
 * Hat diese Firma (bzw. ihre Anfrage) einen gebuchten Termin im Kalender? Für die Termin-Regel. Nachbesserung (Gutachten
 * Betreiber, Mangel 1): auch über Mail ODER Nummer von Firma und Anfrage — eine /justin-Buchung vor E-476 hängt an einer
 * eigenen Privat-Person (Firma und Anfrage ohne person_id).
 */
export async function terminGebuchtFuerFirma(firmaId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  const [f] = (await lauf`SELECT person_id, LOWER(COALESCE(email, '')) AS email, COALESCE(telefon, '') AS telefon FROM fiaon_firmen_leads WHERE id = ${firmaId}`.catch(() => [])) as any[];
  const anfrageId = await anfrageZurFirma(firmaId, lauf).catch(() => null);
  const [a] = anfrageId ? ((await lauf`SELECT LOWER(COALESCE(email, '')) AS email, COALESCE(telefon, '') AS telefon FROM fiaon_anfragen WHERE id = ${anfrageId}`.catch(() => [])) as any[]) : [];
  const mails = Array.from(new Set([String(f?.email ?? ""), String(a?.email ?? "")].filter(Boolean)));
  const k9s = Array.from(new Set([String(f?.telefon ?? ""), String(a?.telefon ?? "")].map((t) => { const d9 = t.replace(/\D/g, ""); return d9.length >= 7 ? d9.slice(-9) : ""; }).filter(Boolean)));
  const [t] = (await lauf`
    SELECT 1 AS ja FROM fiaon_termine t
     WHERE t.status = 'gebucht' AND t.beginn > NOW() - INTERVAL '12 hours'
       AND (t.id IN (SELECT termin_id FROM fiaon_lead_gespraech WHERE firma_id = ${firmaId} OR (${anfrageId ?? 0} > 0 AND anfrage_id = ${anfrageId ?? 0}))
         OR (t.quelle IN ('global', 'gruender') AND ((${f?.person_id ?? null}::int IS NOT NULL AND t.person_id = ${f?.person_id ?? null}::int)
           OR t.person_id IN (SELECT p.id FROM fiaon_persons p
                               WHERE LOWER(COALESCE(p.primary_email, '')) = ANY(${mails.length ? mails : ["-"]})
                                  OR RIGHT(REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) = ANY(${k9s.length ? k9s : ["-"]})))))
     LIMIT 1`.catch(() => [])) as any[];
  return !!t;
}

const EREIGNIS_SATZ: Readonly<Record<string, string>> = {
  termin_gebucht: "Termin bei Justin gebucht", termin_abgesagt: "Gespräch abgesagt", gespraech_gefuehrt: "Gespräch geführt",
  gespraech_nicht_zustande: "Gespräch kam nicht zustande", gespraech_kein_interesse: "kein Interesse (nach dem Gespräch)",
  selbst: "Justin ruft selbst an", ableitung: "Stand aus dem Cockpit übernommen",
  schriftlich_abgesagt: "schriftlich abgesagt (kein Interesse) — bitte nicht anrufen",
  weg_mail: "wünscht das Gespräch per E-Mail (Justin schreibt aus js@) — bitte nicht anrufen",
  weg_whatsapp: "spricht auf WhatsApp mit Mara — bitte nicht anrufen",
};

/**
 * Nachbesserung (Gutachten Betreiber, Mangel 6): ALLE offenen Anruf-Aufträge einer Firma (jede ihrer Global-Anfragen der
 * letzten 60 Tage — z. B. Website und Meta-Formular derselben Person zwei Minuten nacheinander), nicht nur der jüngste.
 */
async function auftraegeDerFirma(firmaId: number | null, ohne: number, lauf: Lauf): Promise<{ id: number; status: string; anfrageId: number }[]> {
  if (!firmaId) return [];
  const [f] = (await lauf`SELECT LOWER(COALESCE(email, '')) AS email, COALESCE(telefon, '') AS telefon FROM fiaon_firmen_leads WHERE id = ${firmaId}`.catch(() => [])) as any[];
  const k9 = (() => { const d9 = String(f?.telefon ?? "").replace(/\D/g, ""); return d9.length >= 7 ? d9.slice(-9) : ""; })();
  const zeilen = (await lauf`
    SELECT t.id, t.status, a.id AS anfrage_id FROM fiaon_anfragen a
      JOIN fiaon_betreiber_todos t ON t.schluessel IN ('global-anfrage:' || a.id, 'global-rueckruf:' || a.id, 'global-antwort:' || a.id)
     WHERE a.art = 'global' AND a.id <> ${ohne} AND NOT COALESCE(a.ist_test, FALSE) AND COALESCE(a.status, '') <> 'privat'
       AND a.created_at > NOW() - INTERVAL '60 days' AND t.status <> 'erledigt'
       AND (a.id IN (SELECT anfrage_id FROM fiaon_lead_weg WHERE firma_id = ${firmaId}) OR a.id IN (SELECT anfrage_id FROM fiaon_lead_takt WHERE firma_id = ${firmaId})
         OR (${String(f?.email ?? "")} <> '' AND LOWER(COALESCE(a.email, '')) = ${String(f?.email ?? "")})
         OR (${k9} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(a.telefon, ''), '\\D', '', 'g'), 9) = ${k9}))`.catch(() => [])) as any[];
  return zeilen.map((z) => ({ id: Number(z.id), status: String(z.status), anfrageId: Number(z.anfrage_id) }));
}

export interface StandErgebnis { anfrageId: number | null; anfrageStatus: string | null; auftrag: "geschlossen" | "offen" | "wieder_offen" | "neu" | null }

/**
 * DER EINE STAND (Plan 5.1): nach jedem Ereignis am Lead — Anruf-Ergebnis, Buchung, Cockpit-Knopf, Gesprächsergebnis,
 * Absage — zieht die Anfrage den Stand aus Cockpit, Kalender und Anrufen nach, und der Anruf-Auftrag (und der Rückruf der
 * Vertretung) schließt sich, bleibt offen (Fälligkeit = Wiedervorlage) oder geht wieder auf. Wirft nie.
 */
export async function leadStandSetzen(ein: {
  firmaId?: number | null; anfrageId?: number | null; ereignis: LeadStandEreignis;
  wer?: { id: number | null; name: string } | null; wiedervorlage?: string | null; notiz?: string | null;
}, lauf: Lauf = sqlPool): Promise<StandErgebnis> {
  const leer: StandErgebnis = { anfrageId: null, anfrageStatus: null, auftrag: null };
  try {
    const anfrageId = ein.anfrageId ?? (ein.firmaId ? await anfrageZurFirma(ein.firmaId, lauf) : null);
    if (!anfrageId) return leer;
    const l = await taktLageLesen(anfrageId, lauf);
    if (!l || l.istTest) return leer;
    const wer = ein.wer?.name || "System";
    const stand = anfrageStandAus({ jetzt: l.status, firmaStatus: l.firmaStatus, terminGebucht: l.terminGebucht, angerufen: l.anrufeN > 0, gefuehrt: l.gefuehrt });
    if (stand !== l.status) {
      await lauf`
        UPDATE fiaon_anfragen SET status = ${stand}, bearbeitet_am = NOW(), bearbeitet_von = ${wer}
         WHERE id = ${anfrageId} AND COALESCE(status, '') <> 'privat'`.catch((e) => console.error(`[LEAD-STAND] Anfrage #${anfrageId}:`, String(e).slice(0, 160)));
    }
    const folge = auftragNachEreignis(ein.ereignis);
    let auftrag: StandErgebnis["auftrag"] = null;
    const ergebnisSatz = ein.ereignis.startsWith("anruf:")
      ? `Anruf eingetragen: ${ANRUF_ERGEBNIS_TEXT[ein.ereignis.slice(6)] ?? ein.ereignis.slice(6)} (${wer}, ${tagUhr(new Date())})`
      : `${EREIGNIS_SATZ[ein.ereignis] ?? ein.ereignis} (${wer})`;
    const { auftragErledigen, auftragBeitrag, auftragWiederOeffnen } = await import("./fiaon-auftraege");
    // Der Rückruf-Auftrag aus einer Antwort (global-antwort:<Anfrage>) zieht mit, und die Aufträge weiterer Anfragen derselben Firma.
    const [antwortAuftrag] = (await lauf`SELECT id, status FROM fiaon_betreiber_todos WHERE schluessel = ${`global-antwort:${anfrageId}`}`.catch(() => [])) as any[];
    const weitere = folge === "schliessen" || folge === "offen_lassen" ? await auftraegeDerFirma(l.firmaId, anfrageId, lauf) : [];
    const offene = [l.auftrag, l.rueckruf, antwortAuftrag ? { id: Number(antwortAuftrag.id), status: String(antwortAuftrag.status) } : null, ...weitere]
      .filter((x): x is { id: number; status: string } => !!x && x.status !== "erledigt");
    const auftragWarOffen = !!l.auftrag && l.auftrag.status !== "erledigt";
    if (folge === "schliessen") {
      let hauptZu = false;
      for (const a of offene) {
        const zu = await auftragErledigen(a.id, {
          art: "auto", von: wer, autorArt: ein.wer?.id ? "agent" : "system", autorAgentId: ein.wer?.id ?? null,
          ergebnis: `${ergebnisSatz}. Der Auftrag ist damit erfüllt — der Stand steht im Firmen-Cockpit.`, ereignis: "Stand im Firmen-Cockpit",
        }, lauf).catch(() => false);
        if (zu) { auftrag = "geschlossen"; if (l.auftrag && a.id === l.auftrag.id) hauptZu = true; }
      }
      // Nachbesserung (Gutachten Betreiber, Mangel 2): schließt sich der Auftrag von selbst (Justin ruft selbst an, er hat selbst
      // gebucht), bekommt die Meldeadresse einen Nachtrag im Faden der Lead-Meldung — sonst ruft Daniel trotzdem an.
      const vonDaniel = !!ein.wer?.id && !!l.auftrag?.agentId && ein.wer.id === l.auftrag.agentId;
      if (hauptZu && auftragWarOffen && !vonDaniel && (ein.ereignis === "selbst" || ein.ereignis === "termin_gebucht")) {
        const neu = ein.ereignis === "termin_gebucht" ? await taktLageLesen(anfrageId, lauf).catch(() => null) : null;
        await t1Nachtrag(l, ein.ereignis === "selbst" ? "selbst" : "gebucht", lauf, { wann: neu?.termin ? tagUhr(neu.termin.beginn) : null });
      }
    } else if (folge === "offen_lassen") {
      for (const a of offene) {
        await auftragBeitrag(a.id, { autorArt: ein.wer?.id ? "agent" : "system", autorName: wer, autorAgentId: ein.wer?.id ?? null, art: "kommentar",
          text: `${ergebnisSatz}${ein.wiedervorlage ? ` — nächster Versuch ${ein.wiedervorlage.split("-").reverse().join(".")} (Wiedervorlage im Cockpit)` : ""}.` }, lauf).catch(() => false);
        if (ein.wiedervorlage) await lauf`UPDATE fiaon_betreiber_todos SET faellig_am = ${ein.wiedervorlage}::date, updated_at = NOW() WHERE id = ${a.id} AND status <> 'erledigt'`.catch(() => {});
        auftrag = "offen";
      }
    } else if (folge === "wieder_oeffnen") {
      const grund = ein.ereignis === "termin_abgesagt" ? "Das Gespräch bei Justin wurde abgesagt — bitte anrufen und neu vereinbaren" : "Justin hat ihn zum Gespräch nicht erreicht — bitte heute anrufen und neu eintragen";
      if (l.auftrag && l.auftrag.status === "erledigt") {
        if (await auftragWiederOeffnen(l.auftrag.id, grund, { neu: true }, lauf).catch(() => false)) {
          await lauf`UPDATE fiaon_betreiber_todos SET faellig_am = (NOW() AT TIME ZONE 'Europe/Berlin')::date WHERE id = ${l.auftrag.id}`.catch(() => {});
          auftrag = "wieder_offen";
          // Nachbesserung (Gutachten Betreiber, Mangel 8): der wieder offene Auftrag meldet sich — ein kurzer Nachtrag im Faden
          // der Lead-Meldung an die Meldeadresse (vorher erfuhr Daniel es erst im Portal oder um 18:30).
          await t1Nachtrag(l, "abgesagt", lauf, { wann: l.termin ? tagUhr(l.termin.beginn) : null });
        }
      } else if (l.auftrag) {
        await auftragBeitrag(l.auftrag.id, { autorArt: "system", autorName: "System", art: "kommentar", text: `${grund}.` }, lauf).catch(() => false);
        auftrag = "offen";
      } else {
        // Er hatte direkt gebucht (kein Anruf-Auftrag) — jetzt braucht es einen: an die zuständige Person, Meldung an die
        // Lead-Meldungen-Adresse (Entscheidung 3A).
        try {
          const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
          const { globalZustaendig } = await import("./fiaon-global-termin");
          const { berlinToday } = await import("./fiaon-time");
          const z = await globalZustaendig().catch(() => null);
          await auftragFuerKunden({
            personId: null, ref: null, titel: `FIAON Global: ${leadAnzeigeName(l.firmaRoh, l.name)} — bitte neu vereinbaren`,
            text: [`${grund}.`, `Telefon: ${l.telefon || "—"} · E-Mail: ${l.email || "—"}`, "Bei Interesse im Cockpit „Termin bei Justin eintragen“."].join("\n"),
            faelligAm: berlinToday(), dringend: true, schluessel: `global-anfrage:${anfrageId}`, bereich: "sonstiges", quelle: "global",
            autorName: "FIAON Global", link: cockpitUrl(l).replace(/^https?:\/\/[^/]+/, ""), agentId: z?.id ?? null,
            meldung: await leadAuftragMeldung(lauf), anlageText: "Lead-Gespräch abgesagt oder nicht zustande — neu vereinbaren (E-476).",
          });
          auftrag = "neu";
        } catch (e) { console.error(`[LEAD-STAND] Auftrag zu #${anfrageId}:`, String((e as Error)?.message ?? e).slice(0, 160)); }
      }
    }
    return { anfrageId, anfrageStatus: stand, auftrag };
  } catch (err) {
    console.error("[LEAD-STAND]", String((err as Error)?.message ?? err).slice(0, 200));
    return leer;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE STAND-LEISTE IM COCKPIT
// ═══════════════════════════════════════════════════════════════════════════
export interface StandSchritt { key: "eingang" | "mail" | "anruf" | "termin"; text: string; ton: "gut" | "warte" | "still" | "rot" }
export interface LeadStandAnsicht {
  anfrageId: number; status: string; statusWort: string; schritte: StandSchritt[]; jetzt: string; wartetMin: number | null;
  terminGebucht: boolean; pflichtNotiz: boolean;
}

/** Die Stand-Leiste einer Firma — null, wenn sie kein Business-Lead mit Anfrage ist (Kaltakquise: keine Leiste). */
export async function leadStandAnsicht(firmaId: number, lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<LeadStandAnsicht | null> {
  const anfrageId = await anfrageZurFirma(firmaId, lauf).catch(() => null);
  if (!anfrageId) return null;
  const l = await taktLageLesen(anfrageId, lauf);
  if (!l) return null;
  const stand = anfrageStandAus({ jetzt: l.status, firmaStatus: l.firmaStatus, terminGebucht: l.terminGebucht, angerufen: l.anrufeN > 0, gefuehrt: l.gefuehrt });
  const schritte: StandSchritt[] = [];
  schritte.push({ key: "eingang", text: `Anfrage #${anfrageId} · ${tagUhr(l.eingangAm)} · ${l.kanal === "meta" ? "Meta" : "Website"}`, ton: "gut" });
  const w = l.w;
  // Nachbesserung (Gutachten Betreiber, Mangel 10): „Mail von Justin folgt“ nur, wenn die Lead-Mails wirklich an sind.
  const post = !w?.am && !w?.status ? await import("./fiaon-global-lead-post").then((m) => m.leadPostEinstellungen(lauf)).catch(() => null) : null;
  schritte.push(w?.am ? { key: "mail", text: `Mail von Justin ✓ ${uhr(w.am)}`, ton: "gut" }
    : w?.status === "ausgelassen" ? { key: "mail", text: "keine Mail von Justin", ton: "still" }
    : w?.status === "fehler" ? { key: "mail", text: "Mail von Justin gescheitert", ton: "rot" }
    : post && !post.willkommenAn ? { key: "mail", text: "keine Mail von Justin (Lead-Mails aus) — du bist der erste Kontakt", ton: "still" }
    : { key: "mail", text: "Mail von Justin folgt", ton: "warte" });
  schritte.push(l.anrufeN === 0 ? { key: "anruf", text: "noch kein Anruf", ton: "warte" }
    : { key: "anruf", text: `${l.anrufeN === 1 ? "1 Anruf" : `${l.anrufeN} Anrufe`} · zuletzt ${ANRUF_ERGEBNIS_TEXT[l.letzterAnruf!.ergebnis] ?? l.letzterAnruf!.ergebnis}`, ton: /^erreicht_/.test(l.letzterAnruf!.ergebnis) ? "gut" : "still" });
  if (l.termin) {
    const bei = l.termin.bei ? ` bei ${l.termin.bei.split(" ")[0]}` : "";
    schritte.push(l.termin.status === "gebucht" ? { key: "termin", text: `Termin ${tagUhr(l.termin.beginn)}${bei}`, ton: "gut" }
      : l.termin.status === "erledigt" ? { key: "termin", text: `Gespräch geführt (${tagUhr(l.termin.beginn)})`, ton: "gut" }
      : l.termin.status === "abgesagt" ? { key: "termin", text: "Gespräch abgesagt", ton: "rot" }
      : { key: "termin", text: "Gespräch kam nicht zustande", ton: "rot" });
  } else schritte.push({ key: "termin", text: "kein Termin", ton: "still" });
  // „wartet seit … Min.“ zählt Dienstminuten, solange niemand angerufen hat (ein geöffneter Auftrag ist noch kein Anruf).
  const wartetMin = !hatAngerufen(l) ? dienstMinuten(l.eingangAm, jetzt) : null;
  let naechster: string;
  if (l.abgesagt) naechster = "Nicht anrufen — schriftlich abgesagt (kein Interesse).";
  else if ((STAND_ABSCHLUSS as readonly string[]).includes(stand)) naechster = `Abgeschlossen: ${ANFRAGE_STAND_WORT[stand]}.`;
  else if (l.terminGebucht) naechster = `${l.termin!.bei ? l.termin!.bei.split(" ")[0] : "Justin"} ruft zum Termin an — für dich nichts zu tun.`;
  else if (l.selbst && l.anrufeN === 0) naechster = "Justin ruft selbst an — für dich nichts zu tun.";
  else if (l.gefuehrt) naechster = "Gespräch geführt — wie es weitergeht, steht in der Wiedervorlage.";
  else if (l.anrufeN === 0) naechster = `Jetzt: anrufen${l.wunschzeit ? ` (Wunschzeit: ${linksEntschaerfen(l.wunschzeit).slice(0, 60)})` : ""}${l.englisch ? " — auf Englisch" : ""}${wartetMin != null && wartetMin > 0 ? ` — wartet seit ${wartetMin} Min. (Dienstzeit)` : ""}.`;
  else if (["nicht_erreicht", "mailbox"].includes(l.letzterAnruf!.ergebnis)) naechster = "Nächster Versuch laut Wiedervorlage — trag jeden Versuch ein.";
  else if (l.letzterAnruf!.ergebnis === "erreicht_interesse") naechster = "Interesse: „Termin bei Justin eintragen“.";
  else naechster = `Stand: ${ANFRAGE_STAND_WORT[stand] ?? stand}.`;
  return { anfrageId, status: stand, statusWort: ANFRAGE_STAND_WORT[stand] ?? stand, schritte, jetzt: naechster, wartetMin, terminGebucht: l.terminGebucht, pflichtNotiz: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ÜBERSICHT 18:30
// ═══════════════════════════════════════════════════════════════════════════
async function uebersichtLeads(von: Date, bis: Date, lauf: Lauf): Promise<{ leads: (UebersichtLead & { erster: Date | null; firmaId: number | null })[]; privat: number }> {
  const zeilen = (await lauf`
    SELECT a.id, COALESCE(a.status, 'neu') AS status, a.name, a.firma, a.created_at, a.ip,
           (SELECT meta_lead_id FROM fiaon_meta_leads m WHERE m.global_anfrage_id = a.id LIMIT 1) AS meta_lead_id
      FROM fiaon_anfragen a
     WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE) AND a.created_at >= ${von} AND a.created_at < ${bis}
     ORDER BY a.created_at`.catch(() => [])) as any[];
  const leads: (UebersichtLead & { erster: Date | null; firmaId: number | null })[] = [];
  let privat = 0;
  for (const z of zeilen) {
    if (z.status === "privat") { privat++; continue; }
    const l = await taktLageLesen(Number(z.id), lauf);
    if (!l) continue;
    const stand = anfrageStandAus({ jetzt: l.status, firmaStatus: l.firmaStatus, terminGebucht: l.terminGebucht, angerufen: l.anrufeN > 0, gefuehrt: l.gefuehrt });
    // Nachbesserung (Gutachten Betreiber, Mangel 6): je Firma EIN Lead — zwei Eingänge derselben Person (Website und Meta)
    // zählen einmal (der jüngere ersetzt den älteren).
    if (l.firmaId) { const i = leads.findIndex((x) => x.firmaId === l.firmaId); if (i >= 0) leads.splice(i, 1); }
    leads.push({
      anfrageId: l.anfrageId, anzeige: leadAnzeigeName(l.firmaRoh, l.name), kanal: l.kanal, eingangAm: l.eingangAm,
      temperatur: l.temperatur, antwortenKurz: antwortenKurz(l.antworten) ?? (l.nachricht ? `Nachricht: „${linksEntschaerfen(l.nachricht.replace(/\s+/g, " ").slice(0, 80))}“` : null),
      mail: { status: l.w?.status ?? null, am: l.w?.am ?? null },
      anrufe: { n: l.anrufeN, letzter: l.letzterAnruf }, termin: l.termin ? { beginn: l.termin.beginn, status: l.termin.status, bei: l.termin.bei } : null,
      stand, eskaliert: l.takt?.e120_am ? "e120" : l.takt?.e60_am ? "e60" : l.takt?.e15_am ? "e15" : null, erster: l.ersterAnruf,
      selbst: !!l.selbst, firmaId: l.firmaId,
    });
  }
  return { leads, privat };
}

/** Alle Zahlen der Übersicht für einen Berliner Tag — nur Lesen. */
export async function uebersichtDatenLesen(tag: string, jetzt: Date, lauf: Lauf = sqlPool): Promise<UebersichtDaten> {
  await tabellenBereit(lauf);
  const von = berlinZeitpunkt(tag, 0);
  const bis = berlinZeitpunkt(isoPlus(tag, 1), 0);
  const morgenBis = berlinZeitpunkt(isoPlus(tag, 2), 0);
  const neu = await uebersichtLeads(von, bis, lauf);
  const frueher = await uebersichtLeads(berlinZeitpunkt(isoPlus(tag, -V.offenTage), 0), von, lauf);
  const { leadOffen } = await import("./fiaon-lead-takt-regeln");
  const heuteFirmen = new Set(neu.leads.map((l) => l.firmaId).filter(Boolean));
  const offen = frueher.leads.filter((l) => leadOffen(l, jetzt) && !(l.firmaId && heuteFirmen.has(l.firmaId)));
  // Anrufe aus dem Cockpit (art „anruf“, nicht fiaon_calls — Plan 5.5) an Business-Leads.
  const [an] = (await lauf`
    SELECT COUNT(*)::int AS eintraege, COUNT(DISTINCT l.firma_id)::int AS leads
      FROM fiaon_firmen_log l JOIN fiaon_firmen_leads f ON f.id = l.firma_id
     WHERE l.art = 'anruf' AND l.created_at >= ${von} AND l.created_at < ${bis}
       AND (f.global_am IS NOT NULL OR COALESCE(f.quelle, '') = 'global')`.catch(() => [])) as any[];
  const herk = LEAD_GESPRAECH_HERKUENFTE as unknown as string[];
  const [tg] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_termine
     WHERE quelle = 'global' AND COALESCE(herkunft, '') = ANY(${herk}) AND created_at >= ${von} AND created_at < ${bis}`.catch(() => [])) as any[];
  // Gespräche bei Justin — über agent_id, nicht über „echte Mitarbeiter“ (sein Konto ist ein Testkonto, Gutachten 0, Mangel 21).
  const gid = await gruenderId();
  // Nachbesserung (Gutachten Betreiber, Mangel 1): auch die Gespräche über /justin (Quelle „gruender“) — mit dem Zeichen „/justin“.
  const gespraeche = (await lauf`
    SELECT t.beginn, t.status, t.quelle, COALESCE(NULLIF(p.company_name, ''), NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.contact_name, 'ohne Namen') AS anzeige
      FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id
     WHERE ((t.quelle = 'global' AND COALESCE(t.herkunft, '') = ANY(${herk})) OR t.quelle = 'gruender') AND t.agent_id = ${gid}
       AND t.status IN ('gebucht', 'erledigt', 'verpasst') AND t.beginn >= ${von} AND t.beginn < ${morgenBis}
     ORDER BY t.beginn`.catch(() => [])) as any[];
  const [tk] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE t1_am >= ${von} AND t1_am < ${bis})::int AS t1,
           COUNT(*) FILTER (WHERE e15_am >= ${von} AND e15_am < ${bis})::int AS e15,
           COUNT(*) FILTER (WHERE e60_am >= ${von} AND e60_am < ${bis})::int AS e60,
           COUNT(*) FILTER (WHERE e120_am >= ${von} AND e120_am < ${bis})::int AS e120
      FROM fiaon_lead_takt`.catch(() => [])) as any[];
  const [nf] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE art = 'n1')::int AS n1, COUNT(*) FILTER (WHERE art = 'n2')::int AS n2, COUNT(*) FILTER (WHERE art = 'n3')::int AS n3
      FROM fiaon_lead_post WHERE richtung = 'aus' AND am >= ${von} AND am < ${bis}`.catch(() => [])) as any[];
  const [st] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_lead_weg WHERE stopp_am >= ${von} AND stopp_am < ${bis}`.catch(() => [])) as any[];
  const [ki] = (await lauf`SELECT COALESCE(SUM(kosten_cents), 0)::float AS c FROM fiaon_ki_nutzung WHERE dienst = 'lead-dossier' AND created_at >= ${von} AND created_at < ${bis}`.catch(() => [])) as any[];
  const dossier = await import("./fiaon-lead-dossier").then((m) => m.dossierEinstellungen(lauf)).catch(() => null);
  const waechter = (await lauf`
    SELECT titel FROM fiaon_system_alarme
     WHERE vorbei_am IS NULL AND (schluessel LIKE 'lead-takt:%' OR schluessel LIKE 'lead-post:%' OR schluessel LIKE 'lead-dossier:%' OR schluessel = 'lead-motor:webhook')
     ORDER BY zuletzt_am DESC LIMIT 6`.catch(() => [])) as any[];
  const minuten = neu.leads.filter((l) => l.erster).map((l) => dienstMinuten(l.eingangAm, l.erster!));
  return {
    tag, jetzt, neu: neu.leads, offen, privatWeg: neu.privat,
    anrufe: { eintraege: Number(an?.eintraege) || 0, leads: Number(an?.leads) || 0 }, termineGebucht: Number(tg?.n) || 0,
    gespraeche: {
      heute: gespraeche.filter((g) => new Date(g.beginn) < bis).map((g) => ({ beginn: new Date(g.beginn), anzeige: String(g.anzeige), status: String(g.status), justinSeite: g.quelle === "gruender" })),
      morgen: gespraeche.filter((g) => new Date(g.beginn) >= bis && g.status === "gebucht").map((g) => ({ beginn: new Date(g.beginn), anzeige: String(g.anzeige), justinSeite: g.quelle === "gruender" })),
    },
    takt: { t1: Number(tk?.t1) || 0, e15: Number(tk?.e15) || 0, e60: Number(tk?.e60) || 0, e120: Number(tk?.e120) || 0,
      ersterAnrufMin: minuten.length ? Math.round(minuten.reduce((s, x) => s + x, 0) / minuten.length) : null },
    nachfass: { n1: Number(nf?.n1) || 0, n2: Number(nf?.n2) || 0, n3: Number(nf?.n3) || 0, gestoppt: Number(st?.n) || 0 },
    ki: { usd: Math.round((Number(ki?.c) || 0)) / 100, deckelUsd: dossier?.kiDeckelUsd ?? 8, an: !!dossier?.kiAn },
    waechter: waechter.map((w) => String(w.titel)), cockpitUrl: absoluteUrl("/agent/firmen"),
  };
}

/** Die Übersicht als Vorschau (nichts gesendet) — für das Steuerpult und den Prüfstand. */
export async function uebersichtVorschau(opt: { tag?: string; fuer?: "justin" | "team"; lauf?: Lauf; jetzt?: Date } = {}): Promise<{ betreff: string; text: string; html: string; leer: boolean }> {
  const lauf = opt.lauf ?? sqlPool;
  const jetzt = opt.jetzt ?? new Date();
  const tag = opt.tag && /^\d{4}-\d{2}-\d{2}$/.test(opt.tag) ? opt.tag : berlinZeit(jetzt).iso;
  const daten = await uebersichtDatenLesen(tag, opt.tag ? berlinZeitpunkt(isoPlus(tag, 1), 0) : jetzt, lauf);
  const ziel = await leadMeldungZiel(lauf).catch(() => null);
  const m = uebersichtMail(daten, opt.fuer === "team" ? { art: "team", vorname: ziel?.fuerVorname ?? "Team" } : { art: "justin" });
  const { rahmen } = await import("./fiaon-brevo");
  return { betreff: m.betreff, text: m.text, html: rahmen(m.betreff, m.text, false, { knoepfe: m.knoepfe, verlinken: m.links, abschnitteFett: true }), leer: m.leer };
}

/**
 * Die Übersicht um 18:30 — einmal je Werktag (atomarer Tagesmerker), an Justin (Dossier-Adresse) und an die Lead-Meldungen-
 * Adresse. Ist nichts passiert und nichts offen, geht keine Mail (der Tag gilt trotzdem als erledigt). Höchstens drei
 * Versuche am Abend. Wirft nie.
 */
export async function uebersichtSenden(opt: { jetzt?: Date; lauf?: Lauf } = {}): Promise<"gesendet" | "leer" | "nicht_faellig" | "aus" | "fehler"> {
  const lauf = opt.lauf ?? sqlPool;
  const jetzt = opt.jetzt ?? new Date();
  try {
    if (!versandErlaubt()) return "aus";
    const einst = await taktEinstellungen(lauf);
    if (!einst.uebersichtAn) return "aus";
    const f = uebersichtFaellig(jetzt, einst.uebersichtTag);
    if (!f.faellig) return "nicht_faellig";
    await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${S.uebersichtTag}, '', NOW()) ON CONFLICT (key) DO NOTHING`;
    const alt = String(einst.uebersichtTag ?? "");
    // Atomar (Gutachten 0, Mangel 11): nur wer den Merker vom gelesenen Stand auf „heute“ dreht, sendet.
    const [frei] = (await lauf`
      UPDATE fiaon_settings SET value = ${f.tag}, updated_at = NOW() WHERE key = ${S.uebersichtTag} AND COALESCE(value, '') = ${alt} RETURNING key`) as any[];
    if (!frei) return "nicht_faellig";
    const daten = await uebersichtDatenLesen(f.tag, jetzt, lauf);
    const justin = uebersichtMail(daten, { art: "justin" });
    if (justin.leer) { console.log(`[LEAD-TAKT] Übersicht ${f.tag}: nichts passiert, nichts offen — keine Mail.`); return "leer"; }
    const an = await justinAdresse(lauf);
    const v = await mailSenden(alsMail(justin, an, "Justin", an));
    if (!v.ok) {
      await lauf`UPDATE fiaon_settings SET value = ${`${f.tag}#f${f.fehlversuche + 1}`}, updated_at = NOW() WHERE key = ${S.uebersichtTag}`.catch(() => {});
      console.error(`[LEAD-TAKT] Übersicht an Justin nicht gesendet (${f.fehlversuche + 1}/3): ${v.grund}`);
      return "fehler";
    }
    const ziel = await leadMeldungZiel(lauf);
    if (ziel.an !== an) {
      const team = uebersichtMail(daten, { art: "team", vorname: ziel.fuerVorname ?? "Team" });
      const vt = await mailSenden(alsMail(team, ziel.an, ziel.fuerName ?? "Team", an));
      if (!vt.ok) console.error(`[LEAD-TAKT] Übersicht an ${ziel.an} nicht gesendet: ${vt.grund}`);
    }
    console.log(`[LEAD-TAKT] Übersicht ${f.tag} an Justin${ziel.an !== an ? ` und ${ziel.an}` : ""}: ${justin.betreff}`);
    return "gesendet";
  } catch (err) {
    console.error("[LEAD-TAKT] Übersicht:", String((err as Error)?.message ?? err).slice(0, 200));
    return "fehler";
  }
}

/** Prüfversand der heutigen Übersicht an Justin (Knopf im Lead-Motor) — ohne Tagesmerker, nur an eine fiaon.com-Adresse. */
export async function uebersichtPruefversand(anRoh: string, lauf: Lauf = sqlPool): Promise<{ ok: boolean; grund?: string; betreff?: string }> {
  const an = String(anRoh || "").trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@fiaon\.com$/.test(an)) return { ok: false, grund: "Prüfversand nur an eine fiaon.com-Adresse" };
  const jetzt = new Date();
  const daten = await uebersichtDatenLesen(berlinZeit(jetzt).iso, jetzt, lauf);
  const m = uebersichtMail(daten, { art: "justin" });
  const v = await mailSenden(alsMail({ ...m, betreff: `Prüfversand · ${m.betreff}` }, an, "Justin", an));
  return v.ok ? { ok: true, betreff: m.betreff } : { ok: false, grund: v.grund ?? "Versand fehlgeschlagen" };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WÄCHTER (System-Alarme im Lagezimmer)
// ═══════════════════════════════════════════════════════════════════════════
const LEAD_MAIL_EVENTS = ["global_termin", "global_termin_erinnerung", "global_termin_kurz", "global_nicht_erreicht", "global_termin_absage", "global_lead_willkommen", "global_lead_nachfass", "global_info"];
let letzteWaechter = 0;

export interface WaechterErgebnis { geprueft: boolean; aktiv: string[]; neu: number; vorbei: number }

/**
 * Drei Wächter, je ein System-Alarm mit festem Schlüssel (er geht von selbst aus, wenn alles wieder gut ist):
 *   lead-takt:kalender   Der Kalender auf fiaon.com zeigt keine Zeit, während die Global-Werbung Geld ausgibt.
 *   lead-takt:dossier    Ein Lead ist seit über 10 Minuten ohne Dossier an Justin.
 *   lead-takt:lead-mail  Eine Lead-Mail ist gescheitert oder kam nicht an (Willkommen, Nachfass, Bestätigung, Erinnerung,
 *                        Lead-Meldung T1; Brevo „blockiert/zurück“; Rückläufer in js@).
 * Höchstens alle 15 Minuten (`immer` = sofort, für Prüfstand und Steuerpult).
 */
export async function leadWaechterPruefen(opt: { jetzt?: Date; lauf?: Lauf; immer?: boolean } = {}): Promise<WaechterErgebnis> {
  const lauf = opt.lauf ?? sqlPool;
  const jetzt = opt.jetzt ?? new Date();
  if (!opt.immer && Date.now() - letzteWaechter < V.waechterMin * 60_000) return { geprueft: false, aktiv: [], neu: 0, vorbei: 0 };
  letzteWaechter = Date.now();
  await tabellenBereit(lauf);
  const { alarmMelden, alarmVorbei } = await import("./fiaon-system-alarme");
  const erg: WaechterErgebnis = { geprueft: true, aktiv: [], neu: 0, vorbei: 0 };
  const melden = async (schluessel: string, an: boolean, titel: string, text: string, stufe: "rot" | "gelb", link: string, vorbeiGrund: string) => {
    if (an) {
      const r = await alarmMelden(schluessel, { quelle: "lead-takt", titel, text, stufe, link }, lauf);
      if (r.neu) erg.neu++;
      erg.aktiv.push(titel);
    } else if (await alarmVorbei(schluessel, vorbeiGrund, lauf)) erg.vorbei++;
  };

  // 1) Kalender leer bei laufender Werbung
  try {
    const { globalAngebotLaden } = await import("./fiaon-global-termin");
    const a = await globalAngebotLaden();
    const heute = berlinZeit(jetzt).iso;
    const gestern = isoPlus(heute, -1);
    const [k] = (await lauf`
      SELECT COALESCE(SUM(ausgaben_cents) FILTER (WHERE tag = ${heute}::date), 0)::int AS heute,
             COALESCE(SUM(ausgaben_cents) FILTER (WHERE tag = ${gestern}::date), 0)::int AS gestern
        FROM fiaon_meta_kosten WHERE ebene = 'kampagne' AND tag >= ${gestern}::date AND COALESCE(name, '') ILIKE 'FIAON Global%'`.catch(() => [])) as any[];
    const u = kalenderWaechter({ tage: a.tage.length, grund: a.grund, person: a.person?.name ?? null, ausgabenGesternCents: Number(k?.gestern) || 0, ausgabenHeuteCents: Number(k?.heute) || 0 });
    await melden("lead-takt:kalender", u.an, "Lead-Wächter: Kalender leer, während die Global-Werbung läuft", u.text, "rot", "/chef/s/rueckholung", a.tage.length ? "der Kalender zeigt wieder freie Zeiten" : "keine Global-Werbung mehr");
  } catch (e) { console.error("[LEAD-TAKT] Wächter Kalender:", String((e as Error)?.message ?? e).slice(0, 160)); }

  // 2) Lead ohne Dossier (> 10 Minuten)
  try {
    const dossier = await import("./fiaon-lead-dossier").then((m) => m.dossierEinstellungen(lauf));
    let ohne: string[] = [];
    if (dossier.an && dossier.ab) {
      const offen = (await lauf`
        SELECT a.id, a.created_at, m.erstellt_am AS meta_erstellt, m.weg AS meta_weg FROM fiaon_anfragen a
          LEFT JOIN LATERAL (SELECT erstellt_am, weg FROM fiaon_meta_leads WHERE global_anfrage_id = a.id ORDER BY gesehen_am LIMIT 1) m ON TRUE
         WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE)
           AND a.created_at >= ${dossier.ab}::timestamptz AND a.created_at > ${jetzt}::timestamptz - INTERVAL '3 days'
           AND a.created_at < ${jetzt}::timestamptz - ${V.ohneDossierMin}::int * INTERVAL '1 minute'
           AND NOT EXISTS (SELECT 1 FROM fiaon_lead_dossier d WHERE d.anlass = 'anfrage' AND d.anlass_id = a.id AND d.status IN ('gesendet', 'doppelt', 'sammel'))
         ORDER BY a.id LIMIT 20`.catch(() => [])) as any[];
      ohne = offen.filter((o) => einzelDossierFaellig({ eingangAm: o.created_at, ab: dossier.ab, echterEingang: o.meta_erstellt ?? null, weg: o.meta_weg ?? null, jetzt })).map((o) => `#${o.id}`);
      const buchungen = (await lauf`
        SELECT t.id FROM fiaon_termine t
         WHERE t.quelle = 'global' AND COALESCE(t.herkunft, '') = 'global_seite'
           AND t.created_at >= ${dossier.ab}::timestamptz AND t.created_at > ${jetzt}::timestamptz - INTERVAL '3 days'
           AND t.created_at < ${jetzt}::timestamptz - ${V.ohneDossierMin}::int * INTERVAL '1 minute'
           AND NOT EXISTS (SELECT 1 FROM fiaon_lead_gespraech g WHERE g.termin_id = t.id AND (g.anfrage_id IS NOT NULL OR g.d2_id IS NOT NULL))
           AND NOT EXISTS (SELECT 1 FROM fiaon_lead_dossier d WHERE d.anlass = 'termin' AND d.anlass_id = t.id AND d.status = 'gesendet')
         LIMIT 10`.catch(() => [])) as any[];
      ohne.push(...buchungen.map((b) => `Buchung ${b.id}`));
    }
    await melden("lead-takt:dossier", ohne.length > 0, `Lead-Wächter: ${ohne.length === 1 ? "ein Lead" : `${ohne.length} Leads`} seit über ${V.ohneDossierMin} Minuten ohne Dossier`,
      `Ohne Mail an Justin: ${ohne.join(", ")}. Bitte im Lead-Motor (Karte „Lead-Dossier“) nachsehen — der Lauf lead_dossier holt nach; steht dort ein Fehler, ist Brevo oder die Datenbank gestört.`,
      "rot", "/chef/s/lead-motor", "alle Leads haben ihr Dossier");
  } catch (e) { console.error("[LEAD-TAKT] Wächter Dossier:", String((e as Error)?.message ?? e).slice(0, 160)); }

  // 3) Lead-Mail gescheitert oder nicht zugestellt (24 Stunden)
  try {
    const zeilen: string[] = [];
    let rot = false;
    const post = await import("./fiaon-global-lead-post").then((m) => m.leadPostEinstellungen(lauf)).catch(() => null);
    const w = (await lauf`
      SELECT w.anfrage_id, w.willkommen_status, w.willkommen_grund, w.willkommen_versuche, w.stopp_grund, w.stopp_am, a.created_at
        FROM fiaon_lead_weg w JOIN fiaon_anfragen a ON a.id = w.anfrage_id
       WHERE (w.willkommen_status = 'fehler' AND w.willkommen_versuche >= 3 AND w.updated_at > ${jetzt}::timestamptz - INTERVAL '24 hours')
          OR (w.willkommen_am IS NULL AND w.willkommen_status IN ('wartet', 'unklar', 'laeuft') AND a.created_at < ${jetzt}::timestamptz - INTERVAL '90 minutes'
              AND a.created_at > ${jetzt}::timestamptz - INTERVAL '3 days')
          OR (w.stopp_grund = 'wand' AND w.stopp_am > ${jetzt}::timestamptz - INTERVAL '24 hours')
       ORDER BY w.anfrage_id LIMIT 10`.catch(() => [])) as any[];
    for (const r of w) {
      if (r.stopp_grund === "wand") { rot = true; zeilen.push(`Anfrage #${r.anfrage_id}: ein Nachfass hielt an der Wortwand an (Fehler im Text — bitte melden).`); }
      else if (r.willkommen_status === "fehler") { rot = true; zeilen.push(`Anfrage #${r.anfrage_id}: Justins Willkommen ging nach drei Versuchen nicht hinaus (${linksEntschaerfen(String(r.willkommen_grund ?? "").slice(0, 100))}).`); }
      else if (post?.willkommenAn) zeilen.push(`Anfrage #${r.anfrage_id}: Justins Willkommen wartet seit über 90 Minuten (${linksEntschaerfen(String(r.willkommen_grund ?? r.willkommen_status).slice(0, 100))}).`);
    }
    const t1 = (await lauf`
      SELECT anfrage_id, t1_grund FROM fiaon_lead_takt
       WHERE t1_status = 'fehler' AND t1_versuche >= ${V.t1Versuche} AND updated_at > ${jetzt}::timestamptz - INTERVAL '24 hours' ORDER BY anfrage_id LIMIT 5`.catch(() => [])) as any[];
    for (const r of t1) { rot = true; zeilen.push(`Anfrage #${r.anfrage_id}: die Lead-Meldung an Daniel ging nach drei Versuchen nicht hinaus (${linksEntschaerfen(String(r.t1_grund ?? "").slice(0, 100))}) — der Auftrag steht im Portal.`); }
    const ml = (await lauf`
      SELECT event, status, zustellung, COUNT(*)::int AS n FROM fiaon_mail_log
       WHERE event = ANY(${LEAD_MAIL_EVENTS}) AND COALESCE(art, 'echt') = 'echt' AND created_at > ${jetzt}::timestamptz - INTERVAL '24 hours'
         AND ((status = 'fehlgeschlagen' AND COALESCE(grund, '') NOT LIKE 'Frequenzbremse:%' AND COALESCE(grund, '') NOT LIKE 'Sperre:%' AND COALESCE(grund, '') NOT LIKE 'Werbesperre%')
           OR zustellung IN ('blockiert', 'gebounct', 'spam'))
       GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 8`.catch(() => [])) as any[];
    for (const r of ml) zeilen.push(`${r.event}: ${r.n}× ${r.status === "fehlgeschlagen" ? "nicht versandt" : `bei Brevo ${r.zustellung}`} (24 h).`);
    const [rl] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_lead_post WHERE art = 'ruecklaeufer' AND am > ${jetzt}::timestamptz - INTERVAL '24 hours'`.catch(() => [])) as any[];
    if (Number(rl?.n) > 0) zeilen.push(`${rl.n}× kam eine Mail von Justin aus js@ unzustellbar zurück (24 h) — Daniel fragt die richtige Adresse im Anruf ab.`);
    await melden("lead-takt:lead-mail", zeilen.length > 0, `Lead-Wächter: ${zeilen.length === 1 ? "eine Lead-Mail" : `${zeilen.length} Lead-Mails`} gescheitert oder nicht zugestellt`,
      zeilen.join("\n"), rot ? "rot" : "gelb", "/chef/s/lead-motor", "keine gescheiterte Lead-Mail mehr (24 h)");
  } catch (e) { console.error("[LEAD-TAKT] Wächter Lead-Mail:", String((e as Error)?.message ?? e).slice(0, 160)); }

  // 4) Nachbesserung (Gutachten Technik, Mangel 4): ein Meta-Lead, der seit über 15 Minuten ohne Anfrage dasteht (verwaiste
  //    Beanspruchung nach einem Neustart) — der Nachhol-Lauf beansprucht ihn neu; steht er trotzdem, hilft „Rückstand nachholen“.
  try {
    const verwaist = (await lauf`
      SELECT m.meta_lead_id FROM fiaon_meta_leads m
       WHERE m.global_anfrage_id IS NULL AND m.lead_id IS NULL AND m.weg IN ('meta_webhook', 'meta_nachhol', 'meta_danke', 'meta_rueckstand')
         AND m.gesehen_am < ${jetzt}::timestamptz - INTERVAL '15 minutes' AND m.gesehen_am > ${jetzt}::timestamptz - INTERVAL '3 days'
         AND EXISTS (SELECT 1 FROM fiaon_meta_formulare f WHERE f.id = m.formular_id AND COALESCE(f.name, '') ILIKE 'FIAON Global%')
       LIMIT 20`.catch(() => [])) as any[];
    await melden("lead-takt:meta-verwaist", verwaist.length > 0, `Lead-Wächter: ${verwaist.length === 1 ? "ein Meta-Lead" : `${verwaist.length} Meta-Leads`} seit über 15 Minuten ohne Anfrage`,
      "Ein Lead aus dem Global-Formular wurde angenommen, aber nie als Anfrage angelegt (Neustart mitten im Eingang). Der Nachhol-Lauf versucht es selbst; steht er nach 15 Minuten noch da: Lead-Motor › „Rückstand nachholen“.",
      "gelb", "/chef/s/lead-motor", "jeder Meta-Lead hat seine Anfrage");
  } catch (e) { console.error("[LEAD-TAKT] Wächter Meta:", String((e as Error)?.message ?? e).slice(0, 160)); }

  // 5) Nachbesserung (Gutachten Sicherheit, Mangel 7): ungewöhnlich viele Kalender-Buchungen in einer Stunde (Termin-Spam?).
  try {
    const [b] = (await lauf`
      SELECT COUNT(*)::int AS n FROM fiaon_termine
       WHERE quelle = 'global' AND COALESCE(herkunft, '') IN ('global_seite', 'global_link') AND created_at > ${jetzt}::timestamptz - INTERVAL '1 hour'`.catch(() => [])) as any[];
    const n = Number(b?.n) || 0;
    await melden("lead-takt:buchungen", n >= V.buchungenJeStunde, `Lead-Wächter: ${n} Kalender-Buchungen in einer Stunde`,
      `Auf fiaon.com wurden in der letzten Stunde ${n} Gespräche gebucht — ungewöhnlich viele. Bitte im Kalender prüfen, ob die Buchungen echt sind (Termin-Spam belegt Justins Zeiten).`,
      "gelb", "/chef/s/lead-motor", "wieder normal viele Buchungen");
  } catch (e) { console.error("[LEAD-TAKT] Wächter Buchungen:", String((e as Error)?.message ?? e).slice(0, 160)); }

  // 6) Die Vertretung ist eingetragen → der gelbe Hinweis „keine Vertretung“ geht aus; der Tagesdeckel-Alarm („Flut“) nach 24 h ohne Deckel.
  try {
    const v = await import("./fiaon-global-gespraech").then((m) => m.globalVertretung()).catch(() => null);
    if (v && (await alarmVorbei("lead-takt:vertretung", "eine Vertretung ist eingetragen", lauf))) erg.vorbei++;
  } catch { /* nur ein Hinweis */ }
  return erg;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LAUF lead_takt (alle 5 Minuten, nurMitErgebnis + Stundenpuls)
// ═══════════════════════════════════════════════════════════════════════════
let letzterPuls = 0;
/**
 * T1 nachholen (falls der Anstoß im Eingang nicht durchkam), die Erinnerungsleiter, die Übersicht um 18:30, die Wächter.
 * `true` = eine Historienzeile (gearbeitet oder Stundenpuls).
 */
export async function leadTaktLauf(jetzt: Date = new Date(), lauf: Lauf = sqlPool): Promise<boolean> {
  await tabellenBereit(lauf);
  let gearbeitet = 0;
  const einst = await taktEinstellungen(lauf);
  // Nachbesserung (Gutachten Technik Mangel 2, Betreiber Mangel 9): die Lead-Meldung hat ihren eigenen Schalter — die
  // Erinnerungen (Takt) können aus sein, ohne dass Daniel die Meldung verliert.
  if (versandErlaubt() && einst.meldungT1An) {
    const ab = await zaehlbeginnSichern(lauf);
    const kandidaten = (await lauf`
      SELECT a.id FROM fiaon_anfragen a LEFT JOIN fiaon_lead_takt tk ON tk.anfrage_id = a.id
       WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE) AND COALESCE(a.status, '') <> 'privat'
         AND a.created_at >= ${ab}::timestamptz AND a.created_at > ${jetzt}::timestamptz - ${V.hoechstensTage}::int * INTERVAL '1 day'
         AND a.created_at < ${jetzt}::timestamptz - INTERVAL '1 minute'
         AND (tk.anfrage_id IS NULL OR (COALESCE(tk.t1_status, '') NOT IN ('gesendet', 'nicht_noetig') AND tk.t1_versuche < ${V.t1Versuche}
              AND (tk.t1_laeuft IS NULL OR tk.t1_laeuft < NOW() - INTERVAL '10 minutes')))
       ORDER BY a.id LIMIT 5`.catch(() => [])) as any[];
    for (const k of kandidaten) {
      const r = await t1Senden(Number(k.id), { jetzt, lauf });
      if (r.ergebnis === "gesendet" || r.ergebnis === "fehler" || r.ergebnis === "nicht_noetig") gearbeitet++;
    }
  }
  if (versandErlaubt() && einst.taktAn) {
    await zaehlbeginnSichern(lauf);
    gearbeitet += await eskalationenPruefen(jetzt, lauf);
  }
  const u = await uebersichtSenden({ jetzt, lauf });
  if (u === "gesendet" || u === "leer" || u === "fehler") gearbeitet++;
  const w = await leadWaechterPruefen({ jetzt, lauf });
  gearbeitet += w.neu + w.vorbei;
  if (gearbeitet > 0) { letzterPuls = Date.now(); return true; }
  if (Date.now() - letzterPuls >= 60 * 60_000) { letzterPuls = Date.now(); return true; }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ALTBESTAND — den Stand der Anfragen EINMAL aus dem Cockpit ableiten (nur auf Knopf, mit Justins Go)
// ═══════════════════════════════════════════════════════════════════════════
export interface AbleitungZeile {
  anfrageId: number; anzeige: string; vorher: string; nachher: string; auftragSchliessen: boolean;
  firma: { vorher: string; nachher: string; grund: string } | null; warum: string;
}

/**
 * Für jede Global-Anfrage seit `ab` (kein Test, kein Privat-Weg): der abgeleitete Stand (anfrageStandAus), „Termin“ ohne
 * Termin im Cockpit → Wiedervorlage heute, ein Anruf-Auftrag, der laut Cockpit erledigt ist (erreicht, Termin, Abschluss) →
 * schließen. `anwenden: false` = nur Vorschau (liest). Mit `anwenden` schreibt es — nur über den Knopf im Lead-Motor.
 */
export async function altbestandAbleiten(opt: { ab: string; anwenden: boolean; wer: string; lauf?: Lauf }): Promise<{ zeilen: AbleitungZeile[]; geaendert: number; geprueft: number }> {
  const lauf = opt.lauf ?? sqlPool;
  await tabellenBereit(lauf);
  const anfragen = (await lauf`
    SELECT id FROM fiaon_anfragen
     WHERE art = 'global' AND NOT COALESCE(ist_test, FALSE) AND COALESCE(status, '') <> 'privat' AND created_at >= ${opt.ab}::timestamptz
     ORDER BY id LIMIT 300`.catch(() => [])) as any[];
  const zeilen: AbleitungZeile[] = [];
  let geaendert = 0;
  for (const r of anfragen) {
    const l = await taktLageLesen(Number(r.id), lauf);
    if (!l) continue;
    const korrektur = firmaStandKorrektur({ firmaStatus: l.firmaStatus, terminGebucht: l.terminGebucht });
    const firmaNachher = korrektur ? korrektur.status : l.firmaStatus;
    const nachher = anfrageStandAus({ jetzt: l.status, firmaStatus: firmaNachher, terminGebucht: l.terminGebucht, angerufen: l.anrufeN > 0, gefuehrt: l.gefuehrt });
    const letzter = l.letzterAnruf?.ergebnis ?? "";
    const erledigt = l.terminGebucht || l.gefuehrt || (!!firmaNachher && (STAND_ABSCHLUSS as readonly string[]).includes(firmaNachher)) || /^erreicht_/.test(letzter) || letzter === "nummer_falsch";
    const auftragSchliessen = !!l.auftrag && l.auftrag.status !== "erledigt" && erledigt;
    if (nachher === l.status && !korrektur && !auftragSchliessen) continue;
    const warum = [
      l.terminGebucht ? `Termin ${tagUhr(l.termin!.beginn)}` : null,
      l.anrufeN ? `${l.anrufeN} Anruf(e), zuletzt ${ANRUF_ERGEBNIS_TEXT[letzter] ?? letzter}` : "kein Anruf",
      l.firmaStatus ? `Cockpit „${l.firmaStatus}“` : null,
    ].filter(Boolean).join(" · ");
    zeilen.push({
      anfrageId: l.anfrageId, anzeige: leadAnzeigeName(l.firmaRoh, l.name), vorher: l.status, nachher, auftragSchliessen,
      firma: korrektur ? { vorher: String(l.firmaStatus), nachher: korrektur.status, grund: korrektur.grund } : null, warum,
    });
    if (!opt.anwenden) continue;
    if (korrektur && l.firmaId) {
      await lauf`UPDATE fiaon_firmen_leads SET status = ${korrektur.status}, wiedervorlage = (NOW() AT TIME ZONE 'Europe/Berlin')::date, updated_at = NOW() WHERE id = ${l.firmaId} AND status = 'termin'`.catch(() => {});
      await cockpitZeile(l.firmaId, "stand", `Stand korrigiert (${opt.wer}): ${korrektur.grund}`, lauf);
    }
    if (nachher !== l.status) {
      await lauf`UPDATE fiaon_anfragen SET status = ${nachher}, bearbeitet_am = NOW(), bearbeitet_von = ${`Ableitung (${opt.wer})`} WHERE id = ${l.anfrageId} AND COALESCE(status, '') <> 'privat'`.catch(() => {});
    }
    if (auftragSchliessen && l.auftrag) {
      const { auftragErledigen } = await import("./fiaon-auftraege");
      await auftragErledigen(l.auftrag.id, {
        art: "verwaltung", von: opt.wer, autorArt: "betreiber",
        ergebnis: `Stand aus dem Firmen-Cockpit übernommen (Altbestand): ${warum}.`, ereignis: "Stand aus dem Cockpit",
      }, lauf).catch(() => false);
    }
    geaendert++;
  }
  return { zeilen, geaendert, geprueft: anfragen.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS STEUERPULT (Lead-Motor › Karte „Daniels Takt & Wächter“)
// ═══════════════════════════════════════════════════════════════════════════
export async function leadTaktStand(lauf: Lauf = sqlPool): Promise<any> {
  await tabellenBereit(lauf);
  const einst = await taktEinstellungen(lauf);
  const ziel = await leadMeldungZiel(lauf).catch(() => null);
  const [z] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE t1_status = 'gesendet' AND t1_am > NOW() - INTERVAL '7 days')::int AS t1,
           COUNT(*) FILTER (WHERE t1_status = 'fehler')::int AS t1_fehler,
           COUNT(*) FILTER (WHERE e15_am > NOW() - INTERVAL '7 days')::int AS e15,
           COUNT(*) FILTER (WHERE e60_am > NOW() - INTERVAL '7 days')::int AS e60,
           COUNT(*) FILTER (WHERE e120_am > NOW() - INTERVAL '7 days')::int AS e120,
           COUNT(*) FILTER (WHERE vertretung_am > NOW() - INTERVAL '7 days')::int AS vertretung
      FROM fiaon_lead_takt`.catch(() => [{}])) as any[];
  const letzte = (await lauf`
    SELECT tk.anfrage_id, a.name, a.firma, tk.eingang_am, tk.t1_status, tk.t1_am, tk.t1_grund, tk.geoeffnet_am, tk.geoeffnet_von,
           tk.e15_am, tk.e60_am, tk.e120_am, tk.vertretung_name
      FROM fiaon_lead_takt tk JOIN fiaon_anfragen a ON a.id = tk.anfrage_id
     ORDER BY tk.eingang_am DESC LIMIT 12`.catch(() => [])) as any[];
  const alarme = (await lauf`
    SELECT schluessel, titel, text, stufe, erstmals_am, zuletzt_am, vorbei_am FROM fiaon_system_alarme
     WHERE (schluessel LIKE 'lead-takt:%' OR schluessel = 'lead-motor:webhook')
       AND (vorbei_am IS NULL OR vorbei_am > NOW() - INTERVAL '24 hours')
     ORDER BY (vorbei_am IS NULL) DESC, zuletzt_am DESC LIMIT 8`.catch(() => [])) as any[];
  return {
    einstellungen: { taktAn: einst.taktAn, meldungT1An: einst.meldungT1An, uebersichtAn: einst.uebersichtAn, ab: einst.ab, uebersichtTag: einst.uebersichtTag, webhookStill: einst.webhookStill },
    meldung: ziel ? { an: ziel.an, quelle: ziel.quelle, karte: ziel.karte, fuer: ziel.fuerName } : null,
    zahlen: z ?? {},
    letzte: letzte.map((r) => ({
      anfrageId: Number(r.anfrage_id), name: leadAnzeigeName(r.firma, r.name), eingangAm: r.eingang_am, t1Status: r.t1_status, t1Am: r.t1_am, t1Grund: r.t1_grund,
      geoeffnetAm: r.geoeffnet_am, geoeffnetVon: r.geoeffnet_von, e15: !!r.e15_am, e60: !!r.e60_am, e120: !!r.e120_am, vertretung: r.vertretung_name ?? null,
    })),
    alarme: alarme.map((a) => ({ schluessel: a.schluessel, titel: a.titel, text: a.text, stufe: a.stufe, seit: a.erstmals_am, zuletzt: a.zuletzt_am, vorbeiAm: a.vorbei_am })),
    vorgaben: { erinnerungMin: V.erinnerungMin, justinMin: V.justinMin, zusageMin: V.zusageMin, dienst: `${V.dienstVon}–${V.dienstBis} Uhr` },
    temperaturWort: TEMPERATUR_WORT,
  };
}
