// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — LEAD-MAILS AUS EINEM GUSS (E-476 Scheibe 4, 05.11.2026)
//
// Justin (05.11.2026, Entscheidung 2A): Dem Lead schreibt JUSTIN — aus js@ mit seiner echten Unterschrift (wie der Mail-Motor
// E-458 aus js@ sendet: radarAbsenderLesen, Gmail, Gesendet-Abgleich). Willkommen sofort (auch nachts), Nachfass N1–N3, die
// Antworten in js@ landen im Cockpit und stoppen das Nachfassen. Mara schreibt Leads nicht.
//
// ── DER BEFUND (Plan Lead-Weg 2.0, 04.11.) ────────────────────────────────────
// Nach dem Formular bekam ein Business-Lead KEINE Mail, obwohl der Danke-Bildschirm „Termin wählen“ versprach. Einzelne
// Leads bekamen eine Handmail, die anderen hörten bis zum ersten Anruf nichts. Antworten an welcome@ hätte Mara wie
// Privatkunden behandelt; Privat-Anliegen über das Global-Formular landeten in der Lead-Liste.
//
// ── DER WEG (jetzt) ─────────────────────────────────────────────────────────
//   Lauf lead_post (2 Minuten, rund um die Uhr, nurMitErgebnis + Stundenpuls):
//     · W Willkommen: neue Global-Anfrage ab dem Zählbeginn, nach 10 Minuten Ruhe, ohne Termin → EINE Mail aus js@ mit
//       seinen Antworten (Sie-Form, ohne Betrag) und dem persönlichen Link (Scheibe 3).
//     · Antworten in js@ (alle 6 Minuten, NUR wenn das Willkommen an ist, nur Anfragen ab dem Zählbeginn, eigener Not-Aus):
//       Cockpit-Zeile, Nachfass-Stopp, EIN Rückruf-Auftrag je Anfrage an die zuständige Person (mit erkannter Wunschzeit) —
//       keiner bei Termin, Kunde, Angebot, offenem Anruf-Auftrag, „bitte nicht anrufen“ oder wenn Justin im Faden selbst
//       schreibt; die Meldung an Justin nur bei der ersten Antwort. „keine Mails“ → Sperre, „kein Interesse“ → auch kein
//       Anruf mehr (schriftliche Absage). Rückläufer → Stopp; schreibt Justin selbst im Faden → Stopp, der Rückruf entfällt.
//     · Gesendet-Abgleich: hängt ein Versand (Netz, Neustart), entscheidet der Gesendet-Ordner — nie ein blinder 2. Versuch.
//   Lauf lead_nachfass (10 Minuten, Mo–Fr 9–18 Uhr): N1 +1, N2 +3, N3 +7 Werktage im selben Faden.
//
// ── DIE REGELN ─────────────────────────────────────────────────────────────
//   · Schalter AUS als Vorgabe (lead_global_willkommen_an, lead_global_nachfass_an); Einschalten setzt den Zählbeginn —
//     KEINE Flut alter Leads. Alte, nie kontaktierte Leads: nur scripts/lead-willkommen-entwuerfe.ts (Gmail-ENTWÜRFE).
//   · Nur im Betrieb (CRONS_AN) oder über die Prüfstand-Attrappe. Kein ARAS, nie.
//   · Vor jeder Mail: Stopp-Regeln (shared/fiaon-global-lead-texte.ts), Mail-Budget (1 am Tag, 5 gesamt), die Tür
//     darfAnEmpfaenger (Werbesperre, unzustellbar, Frequenzbremse), die Wand für Firmenangebots-Kundinnen (E-301), die
//     Platzhalter-Wache und die Wortwand (kein Bank-Satz, keine Zahl, kein „Geschenk“, kein Partnername, Sie-Form).
//   · Jede Lead-Mail steht im Versandprotokoll (fiaon_mail_log, versandweg google) und in fiaon_lead_post.
//   · Schema: Migration 130 + dieselbe DDL hier (leadPostSchema) — nie im Eingang.
// Repo öffentlich: keine Kundendaten im Code.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { CRONS_AN } from "./fiaon-crons";
import { absoluteUrl } from "../fiaon-base-url";
import { berlinZeitpunkt } from "./fiaon-time";
import { istFeiertag } from "@shared/fiaon-feiertage";
import {
  LEAD_POST_SCHLUESSEL as S, LEAD_POST_VORGABE as V, LEAD_POST_EVENT as EV, willkommenText, nachfassText, leadMailKlartext,
  platzhalterWache, leadStoppGrund, leadMailBudget, werktagPlus, istWerktag, imSendefenster, leadAntwortArt,
  wunschzeitErkennen, linkAnzeige, STOPP_TEXT, tagText, fremdeAdressen,
  type LeadMailText, type LeadStoppGrund, type LeadStoppLage, type RufLage, type LeadSprache, type LeadAntwortArt,
} from "@shared/fiaon-global-lead-texte";
import { schalterLesen } from "@shared/fiaon-lead-takt";
import {
  firmaBrauchbar, antwortenAusText, antwortenSortieren, metaBlockAusText, paketwunschAus, berlinZeit, landAusTelefon, mailDomainAus,
  istWegwerf, linksEntschaerfen, leadAnzeigeName, fadenAntwortBetreff, ANRUF_ERGEBNIS_TEXT, type LeadAntwort, type MetaFrageDef,
} from "@shared/fiaon-global-lead";
import { leadWegSchema, leadCodeSichern } from "./fiaon-lead-weg";
import type { GmailNachricht } from "./fiaon-gmail";
import type { EigeneMail } from "./fiaon-brevo";

type Lauf = typeof sqlPool;
export const LEAD_POSTFACH = "js@fiaon.com";

const key9 = (tel: unknown) => { const d = String(tel ?? "").replace(/\D/g, ""); return d.length >= 7 ? d.slice(-9) : ""; };
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonObjekt = (v: unknown): any => {
  let o: any = v;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  return o && typeof o === "object" ? o : null;
};

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA (gleich Migration 130) — nie im Eingangs-Pfad
// ═══════════════════════════════════════════════════════════════════════════
let schemaBereit: Promise<void> | null = null;
export function leadPostSchema(lauf: Lauf = sqlPool): Promise<void> {
  if (!schemaBereit) {
    schemaBereit = (async () => {
      await leadWegSchema(lauf);
      await lauf`
        ALTER TABLE fiaon_lead_weg
          ADD COLUMN IF NOT EXISTS willkommen_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS willkommen_status TEXT,
          ADD COLUMN IF NOT EXISTS willkommen_grund TEXT,
          ADD COLUMN IF NOT EXISTS willkommen_versuche INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS willkommen_laeuft TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS gmail_faden TEXT,
          ADD COLUMN IF NOT EXISTS gmail_erste_id TEXT,
          ADD COLUMN IF NOT EXISTS nachfass_stufe INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS nachfass_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS nachfass_faellig TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS nachfass_laeuft TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS stopp_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS stopp_grund TEXT,
          ADD COLUMN IF NOT EXISTS abgemeldet_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS nachfass_verschoben_am TIMESTAMPTZ`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_weg_nachfass_idx ON fiaon_lead_weg (nachfass_faellig) WHERE nachfass_faellig IS NOT NULL AND stopp_am IS NULL`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_weg_faden_idx ON fiaon_lead_weg (gmail_faden) WHERE gmail_faden IS NOT NULL`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_lead_post (
          id BIGSERIAL PRIMARY KEY,
          anfrage_id INTEGER NOT NULL,
          richtung TEXT NOT NULL,
          art TEXT NOT NULL,
          gmail_id TEXT UNIQUE,
          thread_id TEXT,
          betreff TEXT,
          auszug TEXT,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_post_anfrage_idx ON fiaon_lead_post (anfrage_id, am DESC)`;
    })().catch((e) => { schemaBereit = null; throw e; });
  }
  return schemaBereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// EINSTELLUNGEN — Vorgabe AUS; Einschalten = Zählbeginn JETZT (Altbestand-Schutz)
// ═══════════════════════════════════════════════════════════════════════════
export interface LeadPostEinstellungen {
  willkommenAn: boolean; nachfassAn: boolean; ab: string | null; ruheMin: number;
  /** Nachbesserung E-476: Not-Aus des Antwort-Lesers (Vorgabe AN — er läuft ohnehin nur mit Willkommen und Zählbeginn). */
  antwortenAn: boolean;
  /** Nachbesserung E-476: Tagesdeckel der Willkommens-Mails (Formular-Flut). */
  willkommenMaxTag: number;
}
const istAn = (v: unknown) => /^(1|an|true|ja|on)$/i.test(String(v ?? "").trim());

export async function leadPostEinstellungen(lauf: Lauf = sqlPool): Promise<LeadPostEinstellungen> {
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key = ANY(${[S.willkommenAn, S.nachfassAn, S.ab, S.ruheMin, S.antwortenAn, S.willkommenMaxTag] as unknown as string[]})`.catch(() => [])) as any[];
  const w = new Map<string, string>(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  const ruhe = Math.round(Number(w.get(S.ruheMin)));
  const max = Math.round(Number(w.get(S.willkommenMaxTag)));
  const ab = String(w.get(S.ab) ?? "").trim();
  return {
    willkommenAn: istAn(w.get(S.willkommenAn)), nachfassAn: istAn(w.get(S.nachfassAn)),
    ab: ab && Number.isFinite(Date.parse(ab)) ? ab : null,
    ruheMin: w.has(S.ruheMin) && Number.isFinite(ruhe) && ruhe >= 5 && ruhe <= 120 ? ruhe : V.ruheMin,
    antwortenAn: schalterLesen(w.get(S.antwortenAn), true),
    willkommenMaxTag: w.has(S.willkommenMaxTag) && Number.isFinite(max) && max >= 1 && max <= 200 ? max : V.willkommenMaxTag,
  };
}

async function einstellungSetzen(key: string, wert: string, lauf: Lauf): Promise<void> {
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

/** Schalter setzen. Willkommen EIN setzt den Zählbeginn auf jetzt — Anfragen aus der Aus-Zeit bekommen nie eine automatische Mail. */
export async function leadPostSchalten(welcher: "willkommen" | "nachfass" | "antworten", an: boolean, lauf: Lauf = sqlPool): Promise<LeadPostEinstellungen> {
  await einstellungSetzen(welcher === "willkommen" ? S.willkommenAn : welcher === "nachfass" ? S.nachfassAn : S.antwortenAn, an ? "1" : "0", lauf);
  if (welcher === "willkommen" && an) await einstellungSetzen(S.ab, new Date().toISOString(), lauf);
  return leadPostEinstellungen(lauf);
}

/** Eine Zahl im Lead-Motor (Nachbesserung E-476, Gutachten Betreiber Mangel 9 d): Ruhe in Minuten (5–120), Tagesdeckel (1–200). */
export async function leadPostZahlSetzen(welche: "ruhe" | "max_tag", wert: number, lauf: Lauf = sqlPool): Promise<LeadPostEinstellungen> {
  const n = Math.round(Number(wert));
  const [min, max] = welche === "ruhe" ? [5, 120] : [1, 200];
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Bitte eine Zahl von ${min} bis ${max}.`);
  await einstellungSetzen(welche === "ruhe" ? S.ruheMin : S.willkommenMaxTag, String(n), lauf);
  return leadPostEinstellungen(lauf);
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERSANDWEG — Gmail aus js@ (Prüfstand: Attrappe)
// ═══════════════════════════════════════════════════════════════════════════
export interface LeadAbsender { name: string; signaturHtml: string; signaturText: string; quelle?: string }
export interface LeadGmail {
  senden(postfach: string, inhalt: { vonName: string; an: string; betreff: string; text: string; html: string }): Promise<{ id: string; threadId: string }>;
  antworten(postfach: string, ziel: { id: string; threadId: string; an: string }, inhalt: { vonName: string; text: string; html: string }): Promise<{ id: string; threadId: string }>;
  /** Eine Mail an diese Adresse im Gesendet-Ordner seit `ab` (der Abgleich nach einem unklaren Versand). */
  gesendetSuchen(postfach: string, an: string, ab: Date): Promise<{ id: string; threadId: string } | null>;
  /** Ging in `tage` Tagen schon eine Mail aus js@ oder welcome@ an diese Adresse (Justins Handmail)? */
  schonGeschrieben(an: string, tage: number): Promise<boolean>;
  suchen(postfach: string, q: string, max: number): Promise<{ id: string; threadId: string }[]>;
  lesen(postfach: string, id: string): Promise<GmailNachricht>;
  /** Justins echte Unterschrift — null = Gmail gerade gestört (dann wartet die Mail, nie eine fremde Karte). */
  absender(): Promise<LeadAbsender | null>;
}

let attrappe: Partial<LeadGmail> | null = null;
/** Prüfstand: den Gmail-Weg ersetzen (null = echtes Gmail). */
export function leadPostGmailSetzen(f: Partial<LeadGmail> | null): void { attrappe = f; }

type Meldung = (m: EigeneMail) => Promise<{ ok: boolean; messageId: string | null; grund?: string }>;
let meldungAttrappe: Meldung | null = null;
/** Prüfstand: die Mails an Justin (Brevo) ersetzen. */
export function leadPostMeldungSetzen(f: Meldung | null): void { meldungAttrappe = f; }
async function anJustinSenden(m: EigeneMail): Promise<{ ok: boolean; messageId: string | null; grund?: string }> {
  if (meldungAttrappe) return meldungAttrappe(m);
  const { eigeneMailSenden } = await import("./fiaon-brevo");
  return eigeneMailSenden(m);
}

/** Darf hier überhaupt etwas hinausgehen? Nur im Betrieb — oder über die Attrappe des Prüfstands. */
function versandErlaubt(): boolean { return CRONS_AN || !!attrappe; }

const echtesGmail: LeadGmail = {
  async senden(postfach, inhalt) {
    const { neueMailSendenMitFaden } = await import("./fiaon-gmail");
    // Nachbesserung (Gutachten Sicherheit, Mangel 13): der „Abmelden“-Knopf des Mailprogramms (List-Unsubscribe → js@, Betreff
    // „Stopp“) — wer genervt ist, meldet sich ab statt „Spam“ zu drücken. Der Antwort-Leser erkennt die Abmelde-Mail.
    return neueMailSendenMitFaden(postfach, { ...inhalt, abmelden: postfach });
  },
  async antworten(postfach, ziel, inhalt) {
    const g = await import("./fiaon-gmail");
    const original = await g.nachrichtLesen(postfach, ziel.id);
    const id = await g.antwortSenden(postfach, original, inhalt.text, inhalt.html, null, { vonName: inhalt.vonName, an: ziel.an, abmelden: postfach });
    return { id, threadId: ziel.threadId };
  },
  async gesendetSuchen(postfach, an, ab) {
    const { nachrichtenMitFaden } = await import("./fiaon-gmail");
    const q = `in:sent to:${an.replace(/[\s"()]/g, "")} after:${Math.floor(ab.getTime() / 1000) - 60}`;
    return (await nachrichtenMitFaden(postfach, q, 5)).nachrichten[0] ?? null;
  },
  async schonGeschrieben(an, tage) {
    const { nachrichtenSuchen } = await import("./fiaon-gmail");
    const adr = an.replace(/[\s"()]/g, "");
    for (const p of [LEAD_POSTFACH, "welcome@fiaon.com"]) {
      if ((await nachrichtenSuchen(p, `in:sent to:${adr} newer_than:${tage}d`, 1)).ids.length) return true;
    }
    return false;
  },
  async suchen(postfach, q, max) {
    const { nachrichtenMitFaden } = await import("./fiaon-gmail");
    return (await nachrichtenMitFaden(postfach, q, max)).nachrichten;
  },
  async lesen(postfach, id) {
    const { nachrichtLesen } = await import("./fiaon-gmail");
    return nachrichtLesen(postfach, id);
  },
  async absender() {
    const { radarAbsenderLesen } = await import("./fiaon-radar");
    const r = await radarAbsenderLesen(LEAD_POSTFACH);
    if (r.gestoert || !r.absender) return null;
    return { name: r.absender.name, signaturHtml: r.absender.signaturHtml, signaturText: r.absender.signaturText, quelle: r.absender.quelle };
  },
};
function gmail(): LeadGmail {
  return { ...echtesGmail, ...(attrappe ?? {}) } as LeadGmail;
}
async function gmailBereit(): Promise<boolean> {
  if (attrappe) return true;
  return (await import("./fiaon-gmail")).gmailBereit();
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE MAIL — wie von Hand in Gmail geschrieben (E-458), mit Abmelde-Satz und Pflichtangaben
// ═══════════════════════════════════════════════════════════════════════════
export async function leadMailHtml(m: LeadMailText, signaturHtml: string): Promise<string> {
  const { impressumZeileHtml } = await import("./fiaon-signatur");
  const zeile = (t: string) => `<div>${esc(t)}</div>`;
  const leer = "<div><br></div>";
  const teile: string[] = [zeile(m.anrede), leer];
  for (const b of m.bloecke) {
    if (b.art === "absatz") teile.push(zeile(b.text), leer);
    else if (b.art === "zeilen") teile.push(b.zeilen.map(zeile).join(""), leer);
    else if (b.art === "link") teile.push(zeile(b.text), `<div><a href="${esc(b.url)}">${esc(b.anzeige)}</a></div>`, leer);
    else teile.push(`<div>${esc(b.vor)}<a href="${esc(b.url)}">${esc(b.anzeige)}</a>${esc(b.nach)}</div>`, leer);
  }
  teile.push(zeile(m.gruss));
  return `<div dir="ltr">${teile.join("")}<div><br clear="all"></div><div><br></div><span class="gmail_signature_prefix">-- </span><br>`
    + `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">${signaturHtml}</div>`
    + `<div style="margin-top:14px;font-size:11px;line-height:1.5;color:#9aa0a6;">${esc(m.fussSatz)}</div>${impressumZeileHtml(m.sprache)}</div>`;
}

export async function leadMailText(m: LeadMailText, signaturText: string): Promise<string> {
  const { impressumZeileText } = await import("./fiaon-signatur");
  return [leadMailKlartext(m), "", "-- ", signaturText, "", m.fussSatz, impressumZeileText(m.sprache)].join("\n");
}

/**
 * Die Wand vor JEDER Lead-Mail: Platzhalter-Wache, Wortwand (verboten + Zusage ohne Auftrag), die schärferen Global-Regeln
 * (kein „bis zu“, kein Bankname, keine Frist mit Ziffer …), kein Bank-Satz (E-468), kein Betrag, keine Prozentzahl, kein
 * „Geschenk“, kein Partnername, Sie-Form. Leer = sendbar.
 */
export async function leadMailPruefen(m: LeadMailText): Promise<string[]> {
  const [{ wandPruefen }, { globalWortPruefen }, { radarBankVorbehalt }] = await Promise.all([
    import("@shared/fiaon-wortverbote"), import("@shared/fiaon-global-wortregeln"), import("@shared/fiaon-radar"),
  ]);
  const klar = leadMailKlartext(m);
  const text = `${m.betreff}\n${klar}\n${m.fussSatz}`;
  const funde: string[] = platzhalterWache(klar).map((w) => `Platzhalter-Wache: ${w}`);
  // Die Zusage „ruft Sie an“/„meldet sich“ deckt der Auftrag an die zuständige Person (er entsteht mit der Anfrage).
  for (const f of wandPruefen(text, ["aufgabe_an_betreuer", "notiz_an_betreuer"])) if (f.art !== "floskel") funde.push(`Wortwand: „${f.treffer}“`);
  for (const g of globalWortPruefen(text)) if (g.quelle === "global") funde.push(`Global-Regel: „${g.treffer}“`);
  const bank = radarBankVorbehalt(text);
  if (bank) funde.push(`Bank-Satz: „${bank}“`);
  if (/geschenk|gift\b/i.test(text)) funde.push("„Geschenk“");
  if (/\bnorthwest\b/i.test(text)) funde.push("Partnername");
  if (/\d[\d.,]*\s?(?:\$|€|eur\b|euro\b|usd\b|tsd\b|mio\b)|[$€]\s?\d/i.test(text)) funde.push("Betrag");
  if (/\d+(?:[.,]\d+)?\s?%/.test(text)) funde.push("Prozentzahl");
  if (/\b(?:zins|interest rate)\w*/i.test(text)) funde.push("Zins");
  if (m.sprache === "de" && /\b(du|dich|dir|dein\w*)\b/i.test(text)) funde.push("Du-Form");
  // Die englische Wand (pruef-global-querschnitt): „up to“ ist ein Spitzenwert-Versprechen — auch in „up to the signature“.
  if (m.sprache === "en" && /\bup to\b/i.test(text)) funde.push("„up to“");
  // Nachbesserung (Gutachten Sicherheit, Mangel 4): die Link-Wand — was der Lead tippt (Name, Firma, Wunschzeit), darf nie als
  // fremde Adresse in einer Mail mit Justins Unterschrift stehen. Jede Adresse außer fiaon.com ist ein Fund.
  for (const a of fremdeAdressen(text).slice(0, 3)) funde.push(`fremde Adresse „${a.slice(0, 60)}“`);
  return funde;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE EINES LEADS — ein Lesen für Willkommen, Nachfass, Info-Mail, Vorschau
// ═══════════════════════════════════════════════════════════════════════════
export interface LeadLage {
  anfrageId: number; firmaId: number | null; name: string; email: string; telefon: string; firmaRoh: string; firmaBrauchbar: boolean;
  sprache: LeadSprache; kanal: "meta" | "website"; antworten: LeadAntwort[]; mitNachricht: boolean; paketName: string | null;
  eingangAm: Date; echterEingang: Date | null; metaWeg: string | null; istTest: boolean; status: string; land: string | null;
  oesterreich: boolean; bestandskunde: boolean;
  /** Nachbesserung E-476: der Anschluss der Anfrage (Website; Flut-Regel) und „Wann erreichen wir Sie am besten?“ (Rückruf). */
  ip: string | null; wunschzeit: string | null;
  weg: {
    code: string | null; codeBis: Date | null; willkommenAm: Date | null; willkommenStatus: string | null; willkommenVersuche: number;
    willkommenLaeuft: Date | null; gmailFaden: string | null; gmailErsteId: string | null; nachfassStufe: number; nachfassAm: Date | null;
    nachfassFaellig: Date | null; nachfassLaeuft: Date | null; stoppAm: Date | null; stoppGrund: string | null; abgemeldetAm: Date | null; antwortAm: Date | null;
  } | null;
  stopp: LeadStoppLage;
  zustaendig: { id: number; name: string; weiblich: boolean } | null;
  letzterAnruf: { ergebnis: string; am: Date; wer: string | null } | null;
  budget: { letzte24h: number; gesamt: number };
}

const d = (v: unknown): Date | null => (v ? new Date(v as any) : null);

/**
 * SEINE Antworten zu einer Anfrage — leicht, ohne Tabellen-Anweisung (die Buchung ruft das): aus dem Dossier, sonst aus dem
 * Meta-Block des Anfrage-Texts mit der gespeicherten Formular-Definition. Website-Anfragen haben keine. Wirft nie.
 */
export async function antwortenDerAnfrage(anfrageId: number | null | undefined, lauf: Lauf = sqlPool): Promise<LeadAntwort[]> {
  if (!anfrageId) return [];
  const [dd] = (await lauf`SELECT antworten FROM fiaon_lead_dossier WHERE anlass = 'anfrage' AND anlass_id = ${anfrageId} LIMIT 1`.catch(() => [])) as any[];
  const gespeichert = jsonObjekt(dd?.antworten);
  if (Array.isArray(gespeichert) && gespeichert.length) return gespeichert as LeadAntwort[];
  const [a] = (await lauf`
    SELECT a.text, a.ip, f.fragen FROM fiaon_anfragen a
      LEFT JOIN LATERAL (SELECT formular_id FROM fiaon_meta_leads WHERE global_anfrage_id = a.id ORDER BY gesehen_am LIMIT 1) m ON TRUE
      LEFT JOIN fiaon_meta_formulare f ON f.id = m.formular_id
     WHERE a.id = ${anfrageId} AND a.art = 'global'`.catch(() => [])) as any[];
  const text = String(a?.text ?? "");
  if (!a || (a.ip !== "meta-sofortformular" && !text.includes("Über das Meta-Sofortformular"))) return [];
  const defs = jsonObjekt(a.fragen);
  return antwortenAusText(metaBlockAusText(text), Array.isArray(defs) ? (defs as MetaFrageDef[]) : null);
}

/** SEINE Antworten zu einem Lead-Gespräch (über die Anfrage am Termin) — für die Vortag-Mail. Wirft nie. */
export async function antwortenZumTermin(terminId: number, lauf: Lauf = sqlPool): Promise<LeadAntwort[]> {
  const [g] = (await lauf`SELECT anfrage_id FROM fiaon_lead_gespraech WHERE termin_id = ${terminId} AND anfrage_id IS NOT NULL`.catch(() => [])) as any[];
  return g?.anfrage_id ? antwortenDerAnfrage(Number(g.anfrage_id), lauf) : [];
}

async function gruenderId(): Promise<number> {
  try { return await (await import("../routes/fiaon-gruender-termin")).gruenderAgentId(); } catch { return 0; }
}

/**
 * Alles, was die Lead-Mails über eine Anfrage wissen müssen — nur Lesen. null = keine Global-Anfrage. `jetzt` bestimmt den
 * Berliner Kalendertag des Mail-Budgets („höchstens eine am Tag“ — ein Willkommen um 23 Uhr hält N1 um 10 Uhr nicht auf).
 */
export async function leadLageLesen(anfrageId: number, lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<LeadLage | null> {
  await leadPostSchema(lauf);
  const tagBeginn = berlinZeitpunkt(berlinZeit(jetzt).iso, 0);
  const [a] = (await lauf`
    SELECT a.id, a.name, a.email, a.firma, a.telefon, a.land, a.text, a.ip, a.created_at, COALESCE(a.ist_test, FALSE) AS ist_test,
           COALESCE(a.status, 'neu') AS status,
           m.erstellt_am AS meta_erstellt, m.weg AS meta_weg, m.meta_lead_id, f.fragen AS formular_fragen,
           (SELECT antworten FROM fiaon_lead_dossier dd WHERE dd.anlass = 'anfrage' AND dd.anlass_id = a.id LIMIT 1) AS dossier_antworten
      FROM fiaon_anfragen a
      LEFT JOIN LATERAL (SELECT meta_lead_id, formular_id, erstellt_am, weg FROM fiaon_meta_leads WHERE global_anfrage_id = a.id ORDER BY gesehen_am LIMIT 1) m ON TRUE
      LEFT JOIN fiaon_meta_formulare f ON f.id = m.formular_id
     WHERE a.id = ${anfrageId} AND a.art = 'global'`.catch(async () => (await lauf`
    SELECT a.id, a.name, a.email, a.firma, a.telefon, a.land, a.text, a.ip, a.created_at, COALESCE(a.ist_test, FALSE) AS ist_test,
           COALESCE(a.status, 'neu') AS status, NULL AS meta_erstellt, NULL AS meta_weg, NULL AS meta_lead_id, NULL AS formular_fragen, NULL AS dossier_antworten
      FROM fiaon_anfragen a WHERE a.id = ${anfrageId} AND a.art = 'global'`))) as any[];
  if (!a) return null;
  const email = String(a.email ?? "").trim().toLowerCase();
  const telefon = String(a.telefon ?? "").trim();
  const name = String(a.name ?? "").trim();
  const firmaRoh = String(a.firma ?? "").trim();
  const text = String(a.text ?? "");
  const meta = a.ip === "meta-sofortformular" || !!a.meta_lead_id;
  const defsRoh = jsonObjekt(a.formular_fragen);
  const defs: MetaFrageDef[] | null = Array.isArray(defsRoh) ? defsRoh : null;
  const gespeichert = jsonObjekt(a.dossier_antworten);
  const antworten: LeadAntwort[] = meta
    ? (Array.isArray(gespeichert) && gespeichert.length ? antwortenSortieren(gespeichert as LeadAntwort[], defs) : antwortenAusText(metaBlockAusText(text), defs))
    : [];
  const leer = text.indexOf("\n\n");
  const kopf = leer >= 0 ? text.slice(0, leer) : text;
  const rumpf = leer >= 0 ? text.slice(leer + 2).trim() : "";
  const sprache: LeadSprache = /^Sprache:\s*Englisch/m.test(text) ? "en" : "de";
  const tel = landAusTelefon(telefon);
  const domain = mailDomainAus(email) ?? "";
  const landSpalte = /^[A-Z]{2}$/.test(String(a.land ?? "").trim().toUpperCase()) ? String(a.land).trim().toUpperCase() : null;
  const land = landSpalte ?? tel.land ?? (/\.at$/.test(domain) ? "AT" : /\.ch$/.test(domain) ? "CH" : /\.de$/.test(domain) ? "DE" : null);
  const fb = firmaBrauchbar(firmaRoh, name).brauchbar;

  const [w] = (await lauf`SELECT * FROM fiaon_lead_weg WHERE anfrage_id = ${anfrageId}`.catch(() => [])) as any[];
  const [fl] = (await lauf`
    SELECT f.id, f.status FROM fiaon_firmen_leads f
     WHERE (${email} <> '' AND LOWER(COALESCE(f.email, '')) = ${email}) OR f.id = ${w?.firma_id ?? 0}
     ORDER BY (f.id = ${w?.firma_id ?? 0}) DESC, f.id ASC LIMIT 1`.catch(() => [])) as any[];
  const firmaId = fl ? Number(fl.id) : w?.firma_id ? Number(w.firma_id) : null;
  const k9 = key9(telefon);
  const eingang = new Date(a.created_at);

  // ── Die Stopp-Fakten (shared/fiaon-global-lead-texte.ts entscheidet) ──
  const [f] = (await lauf`
    SELECT
      EXISTS (SELECT 1 FROM fiaon_lead_gespraech g WHERE g.anfrage_id = ${anfrageId}) AS lead_termin,
      EXISTS (SELECT 1 FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id
               WHERE t.quelle IN ('global', 'gruender') AND t.created_at > ${eingang}::timestamptz - INTERVAL '1 day'
                 AND ((${email} <> '' AND LOWER(COALESCE(p.primary_email, '')) = ${email})
                   OR (${k9} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) = ${k9}))) AS person_termin,
      EXISTS (SELECT 1 FROM fiaon_lead_post lp WHERE lp.anfrage_id = ${anfrageId} AND lp.art = 'ruecklaeufer') AS ruecklaeufer,
      EXISTS (SELECT 1 FROM fiaon_lead_post lp WHERE lp.anfrage_id = ${anfrageId} AND lp.art = 'von_hand') AS von_hand,
      EXISTS (SELECT 1 FROM fiaon_mail_log ml WHERE LOWER(TRIM(ml.empfaenger)) = ${email} AND ${email} <> '' AND ml.status = 'versandt'
               AND COALESCE(ml.art, 'echt') = 'echt' AND ml.zustellung IN ('gebounct', 'spam') AND ml.created_at > NOW() - INTERVAL '30 days') AS hart,
      EXISTS (SELECT 1 FROM fiaon_anfragen b WHERE b.art = 'global' AND b.id > ${anfrageId} AND NOT COALESCE(b.ist_test, FALSE)
               AND ${email} <> '' AND LOWER(COALESCE(b.email, '')) = ${email}) AS neuere
    `.catch(() => [{}])) as any[];
  const { produktkategorieSql } = await import("@shared/fiaon-produktkategorie");
  const [k] = (await lauf.unsafe(`
    SELECT
      BOOL_OR(${produktkategorieSql("x")} = 'global') AS global_bestellung,
      BOOL_OR(x.payment_status = 'paid' AND x.created_at > $2::timestamptz) AS bezahlt_danach,
      BOOL_OR(${produktkategorieSql("x")} <> 'global') AS privat_bestand
      FROM fiaon_applications x
     WHERE x.merged_into IS NULL AND NOT COALESCE(x.ist_entwurf, FALSE)
       AND (($1 <> '' AND LOWER(COALESCE(x.email, '')) = $1) OR ($3 <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(x.phone, ''), '\\D', '', 'g'), 9) = $3))`,
    [email, eingang.toISOString(), k9]).catch(() => [{}])) as any[];
  const [ang] = (await lauf`
    SELECT
      BOOL_OR(LOWER(COALESCE(status, '')) IN ('angenommen', 'bezahlt')) AS angenommen,
      BOOL_OR(LOWER(COALESCE(status, '')) NOT IN ('angenommen', 'bezahlt', 'abgelehnt', 'abgelaufen', 'storniert')) AS offen
      FROM fiaon_global_angebote
     WHERE ${email} <> '' AND LOWER(COALESCE(CASE WHEN jsonb_typeof(kunde) = 'object' THEN kunde->>'email' END, '')) = ${email}`.catch(() => [{}])) as any[];
  const [anruf] = firmaId ? ((await lauf`
    SELECT ergebnis, agent_name, created_at FROM fiaon_firmen_log
     WHERE firma_id = ${firmaId} AND art = 'anruf' AND created_at > ${eingang}::timestamptz
     ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[]) : [];
  const [info] = firmaId ? ((await lauf`
    SELECT 1 AS ja FROM fiaon_firmen_log
     WHERE firma_id = ${firmaId} AND art = 'mail' AND created_at > COALESCE(${d(w?.willkommen_am)}::timestamptz, ${eingang}::timestamptz) LIMIT 1`.catch(() => [])) as any[]) : [];
  let werbesperre = false;
  try { werbesperre = email ? await (await import("./fiaon-mail-frequenz")).werbesperreAnAdresse(email) : false; } catch { werbesperre = false; }
  const [b] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE created_at >= ${tagBeginn}::timestamptz AND created_at <= ${jetzt}::timestamptz + INTERVAL '1 minute')::int AS tag,
           COUNT(*) FILTER (WHERE created_at >= ${eingang}::timestamptz)::int AS gesamt
      FROM fiaon_mail_log
     WHERE ${email} <> '' AND LOWER(TRIM(COALESCE(empfaenger, ''))) = ${email} AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt'
       AND event = ANY(${[EV.willkommen, EV.nachfass, EV.info, "global_nicht_erreicht"]})`.catch(() => [{ tag: 0, gesamt: 0 }])) as any[];

  // Die zuständige Person (heute Daniel) — nie Justin selbst als „mein Kollege“.
  let zustaendig: LeadLage["zustaendig"] = null;
  try {
    const z = await (await import("./fiaon-global-termin")).globalZustaendig();
    if (z && z.id !== (await gruenderId())) {
      const [ag] = (await lauf`SELECT anrede FROM fiaon_agents WHERE id = ${z.id}`.catch(() => [])) as any[];
      zustaendig = { id: z.id, name: z.name || z.vorname, weiblich: String(ag?.anrede ?? "") === "Frau" };
    }
  } catch { zustaendig = null; }

  return {
    anfrageId, firmaId, name, email, telefon, firmaRoh, firmaBrauchbar: fb, sprache, kanal: meta ? "meta" : "website", antworten,
    mitNachricht: !meta && rumpf.length >= 3, paketName: paketwunschAus(kopf),
    eingangAm: eingang, echterEingang: d(a.meta_erstellt), metaWeg: a.meta_weg ?? null, istTest: !!a.ist_test, status: String(a.status),
    land, oesterreich: land === "AT", bestandskunde: !!k?.privat_bestand,
    ip: a.ip ? String(a.ip) : null, wunschzeit: (/^Wunschzeit:\s*(.+)$/m.exec(kopf)?.[1] ?? "").trim() || null,
    weg: w ? {
      code: w.code ?? null, codeBis: d(w.code_bis), willkommenAm: d(w.willkommen_am), willkommenStatus: w.willkommen_status ?? null,
      willkommenVersuche: Number(w.willkommen_versuche) || 0, willkommenLaeuft: d(w.willkommen_laeuft), gmailFaden: w.gmail_faden ?? null,
      gmailErsteId: w.gmail_erste_id ?? null, nachfassStufe: Number(w.nachfass_stufe) || 0, nachfassAm: d(w.nachfass_am),
      nachfassFaellig: d(w.nachfass_faellig), nachfassLaeuft: d(w.nachfass_laeuft), stoppAm: d(w.stopp_am), stoppGrund: w.stopp_grund ?? null,
      abgemeldetAm: d(w.abgemeldet_am), antwortAm: d(w.antwort_am),
    } : null,
    stopp: {
      privat: String(a.status) === "privat",
      kunde: !!k?.global_bestellung || !!k?.bezahlt_danach || !!ang?.angenommen,
      abgemeldet: !!w?.abgemeldet_am || werbesperre,
      unzustellbar: !!f?.ruecklaeufer || !!f?.hart,
      termin: !!f?.lead_termin || !!f?.person_termin || String(a.status) === "termin",
      antwort: !!w?.antwort_am,
      vonHand: !!f?.von_hand,
      anrufErgebnis: anruf ? String(anruf.ergebnis ?? "") : null,
      firmaStatus: fl?.status ? String(fl.status) : null,
      infoMail: !!info,
      angebot: !!ang?.offen,
      neuere: !!f?.neuere,
    },
    zustaendig,
    letzterAnruf: anruf ? { ergebnis: String(anruf.ergebnis ?? ""), am: new Date(anruf.created_at), wer: anruf.agent_name ?? null } : null,
    budget: { letzte24h: Number(b?.tag) || 0, gesamt: Number(b?.gesamt) || 0 },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ZEIT: Feiertage, Nachfass-Fälligkeit, wer wann anruft
// ═══════════════════════════════════════════════════════════════════════════
/** Feiertage: Deutschland immer (der Absender sitzt hier), dazu das Land des Leads. */
export function feiertagFuer(land: string | null): (iso: string) => boolean {
  return (iso) => istFeiertag("DE", iso) || (land === "AT" && istFeiertag("AT", iso)) || (land === "CH" && istFeiertag("CH", iso));
}

/**
 * Wann N1/N2/N3 fällig ist: +1/+3/+7 Werktage nach dem Willkommen, um 10 Uhr Berliner Zeit. Nachbesserung (Gutachten
 * Lead-Sicht, Mangel 5): N1 frühestens 24 Stunden nach W UND frühestens am Werktag NACH dem Tag, an dem W den Anruf
 * angekündigt hat (W nachts → Anruf am nächsten Werktag → N1 am Werktag danach) — nie eine zweite Mail vor dem Anruf. Rein.
 */
export function nachfassFaelligAm(willkommenAm: Date, stufe: 1 | 2 | 3, land: string | null = null): Date {
  const feiertag = feiertagFuer(land);
  if (stufe === 1) {
    const b = berlinZeit(willkommenAm);
    const imDienstTag = istWerktag(b.iso, feiertag) && b.stunde < V.fensterBis - 1;
    const anrufTag = imDienstTag ? b.iso : werktagPlus(b.iso, 1, feiertag);
    const n1 = berlinZeitpunkt(werktagPlus(anrufTag, 1, feiertag), V.nachfassStunde * 60);
    return new Date(Math.max(n1.getTime(), willkommenAm.getTime() + 24 * 3_600_000));
  }
  const tag = werktagPlus(berlinZeit(willkommenAm).iso, V.nachfassWerktage[stufe - 1], feiertag);
  return berlinZeitpunkt(tag, V.nachfassStunde * 60);
}

/** Wer ruft an, und wann — nur im Dienst eine Uhrzeit (Gutachten 1, Mangel 3). */
export async function rufLageFuer(lage: Pick<LeadLage, "zustaendig" | "letzterAnruf" | "land">, jetzt: Date): Promise<RufLage> {
  const z = lage.zustaendig;
  if (!z) return { kollege: null, art: "persoenlich" };
  if (lage.letzterAnruf && ["nicht_erreicht", "mailbox"].includes(lage.letzterAnruf.ergebnis)) return { kollege: z.name, weiblich: z.weiblich, art: "versucht" };
  const feiertag = feiertagFuer(lage.land);
  const b = berlinZeit(jetzt);
  const heuteDienst = istWerktag(b.iso, feiertag) && b.stunde >= V.fensterVon && b.stunde < V.fensterBis - 1;
  const abIso = heuteDienst ? b.iso : istWerktag(b.iso, feiertag) && b.stunde < V.fensterVon ? b.iso : werktagPlus(b.iso, 1, feiertag);
  const abZeit = heuteDienst ? jetzt : berlinZeitpunkt(abIso, 10 * 60);
  try {
    const abw = await import("./fiaon-abwesenheit");
    if (abw.istAbwesend(await abw.abwesenheitJetzt(sqlPool, jetzt), z.id, abZeit)) {
      // Nachbesserung (Gutachten Lead-Sicht, Mangel 16): Ist die zuständige Person nicht da, nennt die Mail die Vertretung —
      // ohne Vertretung niemanden („melden wir uns persönlich“), nie einen Namen, der nicht anruft.
      const v = await import("./fiaon-global-gespraech").then((m) => m.globalVertretung()).catch(() => null);
      if (v && v.id !== z.id) {
        const [ag] = (await sqlPool`SELECT anrede FROM fiaon_agents WHERE id = ${v.id}`.catch(() => [])) as any[];
        return { kollege: v.name, weiblich: String(ag?.anrede ?? "") === "Frau", art: "persoenlich" };
      }
      return { kollege: null, art: "persoenlich" };
    }
  } catch { /* ohne Abwesenheits-Stand: die Regel ohne Abwesenheit */ }
  return heuteDienst ? { kollege: z.name, weiblich: z.weiblich, art: "heute" } : { kollege: z.name, weiblich: z.weiblich, art: "ab", abTag: abZeit };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE TEXTE EINES LEADS (rein aus der Lage)
// ═══════════════════════════════════════════════════════════════════════════
function linkTeil(link: { url: string; bis?: Date | null }): { url: string; anzeige: string; bis: Date | null } {
  return { url: link.url, anzeige: linkAnzeige(link.url), bis: link.bis ?? null };
}

export async function willkommenFuer(lage: LeadLage, link: { url: string; bis?: Date | null }, jetzt: Date, opt: { kalenderLeer?: boolean } = {}): Promise<LeadMailText> {
  return willkommenText({
    sprache: lage.sprache, name: lage.name, kanal: lage.kanal, antworten: lage.antworten, mitNachricht: lage.mitNachricht,
    paketName: lage.paketName, oesterreich: lage.oesterreich, bestandskunde: lage.bestandskunde,
    link: linkTeil(link), eingangAm: lage.echterEingang && lage.echterEingang < lage.eingangAm ? lage.echterEingang : lage.eingangAm,
    jetzt, ruf: await rufLageFuer(lage, jetzt), wunschzeit: lage.wunschzeit, kalenderLeer: !!opt.kalenderLeer,
    whatsapp: await maraWhatsappLink(link.url, lage.sprache),
  });
}

/**
 * E-481 (Mara Business): der WhatsApp-Link zu Mara mit der Kennung aus dem persönlichen Link — nur, wenn Mara Business an ist
 * und eine Nummer hinterlegt ist. Eine Störung = keine Zeile (die Mail geht trotzdem).
 */
async function maraWhatsappLink(leadUrl: string, sprache: LeadSprache): Promise<{ url: string } | null> {
  try {
    const code = /\/g\/([A-Za-z0-9]{10})(?:[/?#]|$)/.exec(String(leadUrl ?? ""))?.[1] ?? null;
    const mb = await import("./fiaon-mara-business");
    if (!(await mb.mbAn())) return null;
    const url = await mb.mbWaLink(code, sprache);
    return url ? { url } : null;
  } catch { return null; }
}

/** Zeigt der Kalender gerade freie Zeiten (Gutachten Lead-Sicht, Mangel 8)? Eine Störung = „ja“ (der bisherige Text). */
async function kalenderLeer(): Promise<boolean> {
  try { return (await (await import("./fiaon-global-termin")).globalAngebotLaden()).rueckfall; } catch { return false; }
}

/** Führt Justin die Gespräche (W/N sprechen in seiner Stimme von „Termin mit mir“, Gutachten Lead-Sicht, Mangel 9)? */
async function justinFuehrt(): Promise<boolean> {
  try { return (await (await import("./fiaon-lead-weg")).globalKalenderPerson()).modus === "justin"; } catch { return true; }
}

export function nachfassFuer(stufe: 1 | 2 | 3, lage: LeadLage, link: { url: string; bis?: Date | null }, jetzt: Date, opt: { kalenderLeer?: boolean } = {}): LeadMailText {
  const versuch = lage.letzterAnruf && ["nicht_erreicht", "mailbox"].includes(lage.letzterAnruf.ergebnis) && lage.zustaendig
    && (!lage.weg?.willkommenAm || lage.letzterAnruf.am > lage.weg.willkommenAm)
    ? { am: lage.letzterAnruf.am, kollege: lage.zustaendig.name, weiblich: lage.zustaendig.weiblich } : null;
  return nachfassText(stufe, {
    sprache: lage.sprache, name: lage.name, link: linkTeil(link), willkommenAm: lage.weg?.willkommenAm ?? lage.eingangAm, jetzt,
    anrufVersuch: stufe === 1 ? versuch : null,
    angaben: lage.antworten.length ? "antworten" : lage.mitNachricht ? "nachricht" : null,
    firma: lage.firmaBrauchbar ? lage.firmaRoh : null, kalenderLeer: !!opt.kalenderLeer,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTOKOLL UND COCKPIT
// ═══════════════════════════════════════════════════════════════════════════
async function cockpitZeile(firmaId: number | null, ergebnis: string, notiz: string, lauf: Lauf): Promise<void> {
  if (!firmaId) return;
  await lauf`
    INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
    VALUES (${firmaId}, NULL, 'System', 'global', ${ergebnis}, ${notiz.slice(0, 2000)})`.catch(() => {});
}

async function postMerken(anfrageId: number, e: { richtung: "aus" | "ein"; art: string; gmailId: string | null; threadId: string | null; betreff: string; auszug: string; am?: Date }, lauf: Lauf): Promise<boolean> {
  const [r] = (await lauf`
    INSERT INTO fiaon_lead_post (anfrage_id, richtung, art, gmail_id, thread_id, betreff, auszug, am)
    VALUES (${anfrageId}, ${e.richtung}, ${e.art}, ${e.gmailId}, ${e.threadId}, ${e.betreff.slice(0, 300)}, ${e.auszug.slice(0, 1500)}, ${e.am ?? new Date()})
    ON CONFLICT (gmail_id) DO NOTHING RETURNING id`.catch(() => [])) as any[];
  return !!r;
}

async function protokollieren(event: string, an: string, art: string, anfrageId: number, betreff: string, lauf: Lauf, status: "versandt" | "fehlgeschlagen" = "versandt", grund: string | null = null): Promise<void> {
  const { mailProtokoll } = await import("./fiaon-mail-log");
  // versandweg google: Brevo kennt diese Mail nicht — der Zustell-Abgleich lässt sie aus (Muster E-441).
  await mailProtokoll({
    event, empfaenger: an, status, grund, ausgeloestVon: "Lead-Weg (js@, Justin)",
    payload: { versandweg: "google", postfach: LEAD_POSTFACH, anfrage_id: anfrageId, art, betreff },
  }, lauf);
}

/** Stopp merken (einmal) — mit einer Zeile im Cockpit. */
async function stoppSetzen(lage: LeadLage, grund: LeadStoppGrund, lauf: Lauf): Promise<void> {
  const [r] = (await lauf`
    UPDATE fiaon_lead_weg SET stopp_am = NOW(), stopp_grund = ${grund}, nachfass_faellig = NULL, updated_at = NOW()
     WHERE anfrage_id = ${lage.anfrageId} AND stopp_am IS NULL RETURNING anfrage_id`.catch(() => [])) as any[];
  if (r && lage.weg?.willkommenAm) await cockpitZeile(lage.firmaId, "lead_stopp", `Keine weiteren Lead-Mails von Justin: ${STOPP_TEXT[grund]}.`, lauf);
}

// ═══════════════════════════════════════════════════════════════════════════
// W — WILLKOMMEN
// ═══════════════════════════════════════════════════════════════════════════
export type LeadPostErgebnis = "gesendet" | "ausgelassen" | "wartet" | "fehler" | "unklar" | "aus";

async function willkommenAuslassen(anfrageId: number, grund: string, lauf: Lauf): Promise<LeadPostErgebnis> {
  await lauf`
    UPDATE fiaon_lead_weg SET willkommen_status = 'ausgelassen', willkommen_grund = ${grund.slice(0, 300)}, willkommen_laeuft = NULL, updated_at = NOW()
     WHERE anfrage_id = ${anfrageId} AND willkommen_am IS NULL`.catch(() => {});
  return "ausgelassen";
}

async function willkommenFehler(anfrageId: number, grund: string, lauf: Lauf, unklar = false): Promise<LeadPostErgebnis> {
  await lauf`
    UPDATE fiaon_lead_weg SET willkommen_status = ${unklar ? "unklar" : "fehler"}, willkommen_grund = ${grund.slice(0, 300)},
           willkommen_laeuft = CASE WHEN ${unklar} THEN willkommen_laeuft ELSE NULL END, updated_at = NOW()
     WHERE anfrage_id = ${anfrageId} AND willkommen_am IS NULL`.catch(() => {});
  if (!unklar) {
    const [z] = (await lauf`SELECT willkommen_versuche FROM fiaon_lead_weg WHERE anfrage_id = ${anfrageId}`.catch(() => [])) as any[];
    if (Number(z?.willkommen_versuche) >= 3) {
      // E-476 Scheibe 5: EIN Alarm für alle Lead-Mails (statt einer Zeile je Anfrage) — der Lead-Wächter (fiaon-lead-takt.ts)
      // schreibt ihn fort und schaltet ihn aus, wenn 24 Stunden lang keine Lead-Mail mehr scheitert.
      const { alarmMelden } = await import("./fiaon-system-alarme");
      await alarmMelden("lead-takt:lead-mail", {
        quelle: "lead-takt", stufe: "rot", link: "/chef/s/lead-motor", anhaengen: true,
        titel: "Lead-Wächter: eine Lead-Mail gescheitert oder nicht zugestellt",
        text: `Anfrage #${anfrageId}: Justins Willkommen ging nach drei Versuchen nicht hinaus (${grund.slice(0, 200)}) — Daniels Anruf-Auftrag steht trotzdem.`,
      }, lauf).catch(() => ({ neu: false }));
    }
  }
  return unklar ? "unklar" : "fehler";
}

/** Bucht ein hinausgegangenes Willkommen (Versand oder Gesendet-Abgleich). */
async function willkommenBuchen(lage: LeadLage, gesendet: { id: string; threadId: string }, m: LeadMailText, text: string, lauf: Lauf): Promise<void> {
  const jetzt = new Date();
  const faellig = nachfassFaelligAm(jetzt, 1, lage.land);
  await lauf`
    UPDATE fiaon_lead_weg SET willkommen_am = COALESCE(willkommen_am, NOW()), willkommen_status = 'gesendet', willkommen_grund = NULL,
           willkommen_laeuft = NULL, gmail_faden = ${gesendet.threadId || gesendet.id}, gmail_erste_id = ${gesendet.id},
           nachfass_stufe = 0, nachfass_faellig = ${faellig}, updated_at = NOW()
     WHERE anfrage_id = ${lage.anfrageId}`;
  await postMerken(lage.anfrageId, { richtung: "aus", art: "willkommen", gmailId: gesendet.id, threadId: gesendet.threadId || gesendet.id, betreff: m.betreff, auszug: text }, lauf);
  await protokollieren(EV.willkommen, lage.email, "willkommen", lage.anfrageId, m.betreff, lauf);
  await cockpitZeile(lage.firmaId, "lead_mail", `Willkommens-Mail von Justin (js@) mit seinem persönlichen Terminlink — ${m.sprache === "en" ? "auf Englisch" : "deutsch"}${lage.bestandskunde ? ", Fassung „Bestandskunde“" : ""}.`, lauf);
}

/**
 * Das Willkommen einer Anfrage — alle Regeln, dann EIN Versuch (atomar beansprucht). `erzwingen` nur für den Prüfstand
 * (ohne Schalter/Zählbeginn); jede andere Regel gilt immer. Wirft nie.
 */
export async function willkommenSenden(anfrageId: number, opt: { jetzt?: Date; lauf?: Lauf; erzwingen?: boolean } = {}): Promise<{ ergebnis: LeadPostErgebnis; grund: string | null }> {
  const lauf = opt.lauf ?? sqlPool;
  const jetzt = opt.jetzt ?? new Date();
  try {
    if (!versandErlaubt()) return { ergebnis: "aus", grund: "kein Betrieb (CRONS aus)" };
    const einst = await leadPostEinstellungen(lauf);
    if (!opt.erzwingen && (!einst.willkommenAn || !einst.ab)) return { ergebnis: "aus", grund: "Willkommen ist ausgeschaltet" };
    const lage = await leadLageLesen(anfrageId, lauf, jetzt);
    if (!lage) return { ergebnis: "ausgelassen", grund: "keine Global-Anfrage" };
    // Der Link legt die Zeile an (fiaon_lead_weg) — ohne Link kein Willkommen.
    const link = await leadCodeSichern(anfrageId, { firmaId: lage.firmaId, lauf });
    if (!link) return { ergebnis: "fehler", grund: "kein persönlicher Link" };
    const weg = (await leadLageLesen(anfrageId, lauf, jetzt))!.weg;
    if (weg?.willkommenAm || weg?.willkommenStatus === "gesendet") return { ergebnis: "ausgelassen", grund: "schon gesendet" };
    if (weg?.willkommenStatus === "ausgelassen") return { ergebnis: "ausgelassen", grund: "schon ausgelassen" };
    if ((weg?.willkommenVersuche ?? 0) >= 3) return { ergebnis: "fehler", grund: "drei Versuche" };
    // Hängt ein früherer Versuch? Dann entscheidet der Gesendet-Ordner (nie ein blinder zweiter Versand).
    if (weg?.willkommenLaeuft) return { ergebnis: "wartet", grund: "ein Versuch läuft oder wird abgeglichen" };

    // ── Die Regeln (Plan 4.2 + Gutachten-Pflichten) ──
    if (lage.istTest) return { ergebnis: await willkommenAuslassen(anfrageId, "Test-Anfrage", lauf), grund: "Test-Anfrage" };
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(lage.email)) return { ergebnis: await willkommenAuslassen(anfrageId, "keine gültige Mail-Adresse", lauf), grund: "keine gültige Mail-Adresse" };
    if (istWegwerf(mailDomainAus(lage.email))) return { ergebnis: await willkommenAuslassen(anfrageId, "Wegwerf-Adresse", lauf), grund: "Wegwerf-Adresse" };
    if (!opt.erzwingen && einst.ab && lage.eingangAm.getTime() < Date.parse(einst.ab)) return { ergebnis: await willkommenAuslassen(anfrageId, "vor dem Zählbeginn (Altbestand)", lauf), grund: "Altbestand" };
    if (lage.metaWeg === "meta_rueckstand") return { ergebnis: await willkommenAuslassen(anfrageId, "Meta-Rückstand (alter Lead)", lauf), grund: "Altbestand" };
    const echt = lage.echterEingang && lage.echterEingang < lage.eingangAm ? lage.echterEingang : lage.eingangAm;
    if (jetzt.getTime() - echt.getTime() > V.hoechstensTage * 86_400_000) return { ergebnis: await willkommenAuslassen(anfrageId, `älter als ${V.hoechstensTage} Tage`, lauf), grund: "zu alt" };
    if (jetzt.getTime() - lage.eingangAm.getTime() < einst.ruheMin * 60_000) return { ergebnis: "wartet", grund: `${einst.ruheMin} Minuten Ruhe nach dem Eingang` };
    // Nachbesserung (Gutachten Lead-Sicht, Mangel 9): W spricht in Justins Stimme vom „Termin mit mir“ — führt gerade jemand
    // anderes die Gespräche (Urlaub, „zuständige Person“), geht keine Lead-Mail. Der Anruf-Auftrag steht trotzdem.
    if (!opt.erzwingen && !(await justinFuehrt())) {
      return { ergebnis: await willkommenAuslassen(anfrageId, "Die Gespräche führt gerade nicht Justin — keine Mail in seiner Stimme (der Anruf-Auftrag steht)", lauf), grund: "gespraechsperson" };
    }
    // Nachbesserung (Gutachten Sicherheit, Mangel 2): ein Website-Anschluss, der in 24 Stunden mehr als zwei Anfragen schickt,
    // bekommt kein Willkommen aus js@ (sonst würde unser Postfach zum Spam-Relais). Der Anruf-Auftrag steht trotzdem.
    if (lage.kanal === "website" && lage.ip && !/^meta/.test(lage.ip)) {
      const [fl] = (await lauf`
        SELECT COUNT(*)::int AS n FROM fiaon_anfragen
         WHERE art = 'global' AND ip = ${lage.ip}
           AND created_at > ${lage.eingangAm}::timestamptz - INTERVAL '24 hours' AND created_at <= ${lage.eingangAm}::timestamptz + INTERVAL '24 hours'`.catch(() => [{ n: 0 }])) as any[];
      if (Number(fl?.n) > V.flutJeAnschluss) return { ergebnis: await willkommenAuslassen(anfrageId, `Verdacht Flut: ${fl.n} Anfragen vom selben Anschluss in 24 Stunden — Daniel ruft trotzdem an`, lauf), grund: "flut" };
    }
    const stopp = leadStoppGrund(lage.stopp);
    if (stopp) {
      await stoppSetzen(lage, stopp, lauf);
      return { ergebnis: await willkommenAuslassen(anfrageId, STOPP_TEXT[stopp], lauf), grund: STOPP_TEXT[stopp] };
    }
    const budget = leadMailBudget(lage.budget);
    if (!budget.ok) return { ergebnis: await willkommenAuslassen(anfrageId, budget.grund!, lauf), grund: budget.grund };
    // Justins Handmail (oder eine andere Mail) in 14 Tagen? Dann kein zweites „Willkommen“ (Plan 4.2).
    const [ml] = (await lauf`
      SELECT 1 AS ja FROM fiaon_mail_log
       WHERE LOWER(TRIM(COALESCE(empfaenger, ''))) = ${lage.email} AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt'
         AND created_at > NOW() - ${V.ruheTage}::int * INTERVAL '1 day' LIMIT 1`.catch(() => [])) as any[];
    if (ml) return { ergebnis: await willkommenAuslassen(anfrageId, `in ${V.ruheTage} Tagen schon eine Mail an diese Adresse`, lauf), grund: "schon angeschrieben" };
    if (!(await gmailBereit())) return { ergebnis: "wartet", grund: "Gmail-Anbindung fehlt" };
    let hand = false;
    try { hand = await gmail().schonGeschrieben(lage.email, V.ruheTage); }
    catch (e) { return { ergebnis: "wartet", grund: `Gesendet-Ordner nicht lesbar: ${String((e as Error)?.message ?? e).slice(0, 120)}` }; }
    if (hand) return { ergebnis: await willkommenAuslassen(anfrageId, `Justin (oder Mara) schrieb in ${V.ruheTage} Tagen schon an diese Adresse`, lauf), grund: "Handmail" };
    const { darfAnEmpfaenger } = await import("./fiaon-mail-frequenz");
    const tuer = await darfAnEmpfaenger(lage.email, EV.willkommen);
    if (!tuer.ok) return { ergebnis: await willkommenAuslassen(anfrageId, `Tür: ${tuer.grund ?? "abgelehnt"}`, lauf), grund: tuer.grund ?? "Tür" };
    const { firmaKundinAdresse } = await import("./fiaon-global-firma-post");
    if (await firmaKundinAdresse(lage.email).catch(() => false)) return { ergebnis: await willkommenAuslassen(anfrageId, "Firmenangebots-Kundin (E-301): keine automatische Mail", lauf), grund: "E-301" };

    // ── Der Tagesdeckel (Gutachten Sicherheit, Mangel 2): darüber wartet der Rest bis morgen, der Lauf meldet die Flut ──
    if (!opt.erzwingen) {
      const tagBeginn = berlinZeitpunkt(berlinZeit(jetzt).iso, 0);
      const [heute] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_lead_weg WHERE willkommen_am >= ${tagBeginn}`.catch(() => [{ n: 0 }])) as any[];
      if (Number(heute?.n) >= einst.willkommenMaxTag) return { ergebnis: "wartet", grund: `Tagesdeckel erreicht (${einst.willkommenMaxTag} Willkommens-Mails heute)` };
    }

    // ── Die Mail ──
    const absender = await gmail().absender();
    if (!absender) return { ergebnis: "wartet", grund: "Justins Unterschrift gerade nicht lesbar (Gmail gestört)" };
    const m = await willkommenFuer(lage, link, jetzt, { kalenderLeer: await kalenderLeer() });
    const funde = await leadMailPruefen(m);
    if (funde.length) return { ergebnis: await willkommenFehler(anfrageId, `Wand: ${funde.join("; ")}`, lauf), grund: funde.join("; ") };
    const html = await leadMailHtml(m, absender.signaturHtml);
    const text = await leadMailText(m, absender.signaturText);

    // ── Atomar beanspruchen, dann senden ──
    const [frei] = (await lauf`
      UPDATE fiaon_lead_weg SET willkommen_laeuft = NOW(), willkommen_status = 'laeuft', willkommen_versuche = willkommen_versuche + 1, updated_at = NOW()
       WHERE anfrage_id = ${anfrageId} AND willkommen_am IS NULL AND willkommen_laeuft IS NULL AND willkommen_versuche < 3
         AND COALESCE(willkommen_status, '') NOT IN ('gesendet', 'ausgelassen')
      RETURNING anfrage_id`) as any[];
    if (!frei) return { ergebnis: "wartet", grund: "ein anderer Lauf sendet gerade" };
    let gesendet: { id: string; threadId: string };
    try {
      gesendet = await gmail().senden(LEAD_POSTFACH, { vonName: absender.name, an: lage.email, betreff: m.betreff, text, html });
    } catch (e: any) {
      const { radarSendeFehlerArt } = await import("./fiaon-radar");
      const art = radarSendeFehlerArt(e);
      const grund = String(e?.message ?? e).slice(0, 200);
      if (art === "postfach") {
        // Postfach gestört (Token, 401/403/429) — sicher NICHT gesendet und nicht die Schuld des Leads: kein Versuch verbraucht,
        // der nächste Lauf versucht es wieder (sonst wären drei Versuche in sechs Minuten weg und das Willkommen verloren).
        await lauf`
          UPDATE fiaon_lead_weg SET willkommen_laeuft = NULL, willkommen_status = 'wartet', willkommen_grund = ${`Postfach gestört: ${grund}`.slice(0, 300)},
                 willkommen_versuche = GREATEST(willkommen_versuche - 1, 0), updated_at = NOW()
           WHERE anfrage_id = ${anfrageId} AND willkommen_am IS NULL`.catch(() => {});
        return { ergebnis: "wartet", grund: `Postfach gestört: ${grund}` };
      }
      return { ergebnis: await willkommenFehler(anfrageId, grund, lauf, art === "unklar"), grund };
    }
    await willkommenBuchen(lage, gesendet, m, text, lauf);
    console.log(`[LEAD-POST] Anfrage #${anfrageId}: Willkommen aus js@ gesendet (${m.sprache})`);
    return { ergebnis: "gesendet", grund: null };
  } catch (err) {
    const grund = String((err as Error)?.message ?? err).slice(0, 200);
    console.error(`[LEAD-POST] Willkommen #${anfrageId}:`, grund);
    return { ergebnis: await willkommenFehler(anfrageId, grund, lauf).catch(() => "fehler" as const), grund };
  }
}

/** Ein hängendes Willkommen (Netz, Neustart): der Gesendet-Ordner entscheidet — gefunden = buchen, sonst neu versuchen. */
async function willkommenAbgleichen(lauf: Lauf): Promise<number> {
  const offen = (await lauf`
    SELECT anfrage_id, willkommen_laeuft FROM fiaon_lead_weg
     WHERE willkommen_am IS NULL AND willkommen_laeuft IS NOT NULL AND willkommen_laeuft < NOW() - INTERVAL '15 minutes'
     ORDER BY willkommen_laeuft LIMIT 5`.catch(() => [])) as any[];
  let n = 0;
  for (const o of offen) {
    const lage = await leadLageLesen(Number(o.anfrage_id), lauf);
    if (!lage) continue;
    let fund: { id: string; threadId: string } | null = null;
    try { fund = await gmail().gesendetSuchen(LEAD_POSTFACH, lage.email, new Date(o.willkommen_laeuft)); }
    catch (e) { console.error(`[LEAD-POST] Abgleich #${o.anfrage_id}:`, String((e as Error)?.message ?? e).slice(0, 160)); continue; }
    if (fund) {
      const link = await leadCodeSichern(lage.anfrageId, { lauf }).catch(() => null);
      const m = await willkommenFuer(lage, link ?? { url: "https://fiaon.com/" }, new Date(o.willkommen_laeuft));
      await willkommenBuchen(lage, fund, m, "(nachgebucht aus dem Gesendet-Ordner)", lauf);
      console.log(`[LEAD-POST] Anfrage #${o.anfrage_id}: Willkommen im Gesendet-Ordner gefunden — nachgebucht, kein zweiter Versand.`);
    } else {
      await lauf`UPDATE fiaon_lead_weg SET willkommen_laeuft = NULL, willkommen_status = 'fehler', willkommen_grund = 'unklar — nicht im Gesendet-Ordner, neuer Versuch' WHERE anfrage_id = ${o.anfrage_id} AND willkommen_am IS NULL`.catch(() => {});
    }
    n++;
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// N1–N3 — NACHFASS IM SELBEN FADEN
// ═══════════════════════════════════════════════════════════════════════════
/** Ein fälliger Nachfass — Stopp, Budget, Tür, Wand, dann EIN Versuch (atomar). Wirft nie. */
export async function nachfassSenden(anfrageId: number, opt: { jetzt?: Date; lauf?: Lauf; erzwingen?: boolean } = {}): Promise<{ ergebnis: LeadPostErgebnis; grund: string | null; stufe?: number }> {
  const lauf = opt.lauf ?? sqlPool;
  const jetzt = opt.jetzt ?? new Date();
  try {
    if (!versandErlaubt()) return { ergebnis: "aus", grund: "kein Betrieb (CRONS aus)" };
    const einst = await leadPostEinstellungen(lauf);
    if (!opt.erzwingen && !einst.nachfassAn) return { ergebnis: "aus", grund: "Nachfass ist ausgeschaltet" };
    const lage = await leadLageLesen(anfrageId, lauf, jetzt);
    const w = lage?.weg;
    if (!lage || !w || w.willkommenStatus !== "gesendet" || !w.gmailErsteId) return { ergebnis: "ausgelassen", grund: "kein Willkommen aus js@" };
    if (w.stoppAm) return { ergebnis: "ausgelassen", grund: `gestoppt: ${w.stoppGrund}` };
    if (w.nachfassStufe >= 3) return { ergebnis: "ausgelassen", grund: "alle drei gesendet" };
    if (w.nachfassLaeuft) return { ergebnis: "wartet", grund: "ein Versuch läuft oder wird abgeglichen" };
    const stufe = (w.nachfassStufe + 1) as 1 | 2 | 3;
    if (!w.nachfassFaellig || w.nachfassFaellig.getTime() > jetzt.getTime()) return { ergebnis: "wartet", grund: "noch nicht fällig", stufe };
    if (!imSendefenster(jetzt, feiertagFuer(lage.land))) return { ergebnis: "wartet", grund: "außerhalb Mo–Fr 9–18 Uhr", stufe };
    const stopp = leadStoppGrund(lage.stopp);
    if (stopp) { await stoppSetzen(lage, stopp, lauf); return { ergebnis: "ausgelassen", grund: STOPP_TEXT[stopp], stufe }; }
    // Nachbesserung (Gutachten Lead-Sicht, Mangel 9): N spricht in Justins Stimme — führt gerade jemand anderes die Gespräche,
    // endet der Nachfass (der Anruf-Auftrag bleibt).
    if (!opt.erzwingen && !(await justinFuehrt())) { await stoppSetzen(lage, "gespraechsperson", lauf); return { ergebnis: "ausgelassen", grund: STOPP_TEXT.gespraechsperson, stufe }; }
    // Nachbesserung (Gutachten Lead-Sicht, Mangel 5): W hat einen Anruf angekündigt, im Cockpit steht aber noch keiner — dann
    // N1 einmal um einen Werktag schieben (die Erinnerung an Daniel macht der Takt), nie eine zweite Zusage vor dem Anruf.
    if (stufe === 1 && !opt.erzwingen && lage.zustaendig && !lage.letzterAnruf) {
      const [verschoben] = (await lauf`SELECT nachfass_verschoben_am FROM fiaon_lead_weg WHERE anfrage_id = ${anfrageId}`.catch(() => [])) as any[];
      if (!verschoben?.nachfass_verschoben_am) {
        const spaeter = berlinZeitpunkt(werktagPlus(berlinZeit(jetzt).iso, 1, feiertagFuer(lage.land)), V.nachfassStunde * 60);
        await lauf`UPDATE fiaon_lead_weg SET nachfass_faellig = ${spaeter}, nachfass_verschoben_am = NOW(), updated_at = NOW() WHERE anfrage_id = ${anfrageId} AND stopp_am IS NULL`.catch(() => {});
        await cockpitZeile(lage.firmaId, "lead_mail", "Justins Nachfass (N1) wartet einen Werktag — der angekündigte Anruf ist noch nicht eingetragen.", lauf);
        return { ergebnis: "wartet", grund: "der angekündigte Anruf fehlt noch — N1 einen Werktag später", stufe };
      }
    }
    const budget = leadMailBudget(lage.budget);
    if (!budget.ok) {
      // Budget heute erschöpft: einen Werktag später, nie verloren.
      const morgen = berlinZeitpunkt(werktagPlus(berlinZeit(jetzt).iso, 1, feiertagFuer(lage.land)), V.nachfassStunde * 60);
      await lauf`UPDATE fiaon_lead_weg SET nachfass_faellig = ${morgen}, updated_at = NOW() WHERE anfrage_id = ${anfrageId} AND stopp_am IS NULL`.catch(() => {});
      return { ergebnis: "wartet", grund: budget.grund, stufe };
    }
    const { darfAnEmpfaenger } = await import("./fiaon-mail-frequenz");
    const tuer = await darfAnEmpfaenger(lage.email, EV.nachfass);
    if (!tuer.ok) {
      if (/werbesperre|unzustellbar/i.test(String(tuer.grund))) { await stoppSetzen(lage, /werbesperre/i.test(String(tuer.grund)) ? "abgemeldet" : "unzustellbar", lauf); return { ergebnis: "ausgelassen", grund: tuer.grund, stufe }; }
      const morgen = berlinZeitpunkt(werktagPlus(berlinZeit(jetzt).iso, 1, feiertagFuer(lage.land)), V.nachfassStunde * 60);
      await lauf`UPDATE fiaon_lead_weg SET nachfass_faellig = ${morgen}, updated_at = NOW() WHERE anfrage_id = ${anfrageId} AND stopp_am IS NULL`.catch(() => {});
      return { ergebnis: "wartet", grund: `Tür: ${tuer.grund}`, stufe };
    }
    const absender = await gmail().absender();
    if (!absender) return { ergebnis: "wartet", grund: "Justins Unterschrift gerade nicht lesbar (Gmail gestört)", stufe };
    const link = await leadCodeSichern(anfrageId, { firmaId: lage.firmaId, lauf });
    if (!link) return { ergebnis: "fehler", grund: "kein persönlicher Link", stufe };
    const m = nachfassFuer(stufe, lage, link, jetzt, { kalenderLeer: await kalenderLeer() });
    const funde = await leadMailPruefen(m);
    if (funde.length) {
      // Ein fester Text, der an der Wand hängt, ist ein Fehler im Code — kein Versand, kein zweiter Versuch, ein Alarm.
      await lauf`UPDATE fiaon_lead_weg SET stopp_am = NOW(), stopp_grund = 'wand', nachfass_faellig = NULL, updated_at = NOW() WHERE anfrage_id = ${anfrageId} AND stopp_am IS NULL`.catch(() => {});
      // E-476 Scheibe 5: derselbe EINE Alarm wie alle Lead-Mails (Lead-Wächter, fiaon-lead-takt.ts).
      const { alarmMelden } = await import("./fiaon-system-alarme");
      await alarmMelden("lead-takt:lead-mail", {
        quelle: "lead-takt", stufe: "rot", link: "/chef/s/lead-motor", anhaengen: true,
        titel: "Lead-Wächter: eine Lead-Mail gescheitert oder nicht zugestellt", text: `Anfrage #${anfrageId}: ein Nachfass (N${stufe}) hielt an der Wortwand an — ${funde.join("; ").slice(0, 300)}`,
      }, lauf).catch(() => ({ neu: false }));
      console.error(`[LEAD-POST] N${stufe} zu #${anfrageId} hält die Wand an: ${funde.join("; ")}`);
      return { ergebnis: "fehler", grund: `Wand: ${funde.join("; ")}`, stufe };
    }
    const html = await leadMailHtml(m, absender.signaturHtml);
    const text = await leadMailText(m, absender.signaturText);
    const [frei] = (await lauf`
      UPDATE fiaon_lead_weg SET nachfass_laeuft = NOW(), updated_at = NOW()
       WHERE anfrage_id = ${anfrageId} AND nachfass_stufe = ${stufe - 1} AND nachfass_laeuft IS NULL AND stopp_am IS NULL
      RETURNING anfrage_id`) as any[];
    if (!frei) return { ergebnis: "wartet", grund: "ein anderer Lauf sendet gerade", stufe };
    let gesendet: { id: string; threadId: string };
    try {
      gesendet = await gmail().antworten(LEAD_POSTFACH, { id: w.gmailErsteId, threadId: w.gmailFaden ?? w.gmailErsteId, an: lage.email }, { vonName: absender.name, text, html });
    } catch (e: any) {
      const { radarSendeFehlerArt } = await import("./fiaon-radar");
      const art = radarSendeFehlerArt(e);
      // unklar: nachfass_laeuft bleibt — der Gesendet-Abgleich entscheidet (nie ein blinder zweiter Versand).
      // postfach (Token, 429): der nächste Lauf versucht es wieder. mail (4xx, die Mail selbst): erst am nächsten Werktag
      // wieder — sonst stünde alle zehn Minuten derselbe Fehler im Protokoll.
      if (art === "postfach") await lauf`UPDATE fiaon_lead_weg SET nachfass_laeuft = NULL WHERE anfrage_id = ${anfrageId}`.catch(() => {});
      if (art === "mail") {
        const morgen = berlinZeitpunkt(werktagPlus(berlinZeit(jetzt).iso, 1, feiertagFuer(lage.land)), V.nachfassStunde * 60);
        await lauf`UPDATE fiaon_lead_weg SET nachfass_laeuft = NULL, nachfass_faellig = ${morgen}, updated_at = NOW() WHERE anfrage_id = ${anfrageId} AND stopp_am IS NULL`.catch(() => {});
      }
      console.error(`[LEAD-POST] N${stufe} zu #${anfrageId}:`, String(e?.message ?? e).slice(0, 200));
      return { ergebnis: art === "unklar" ? "unklar" : "fehler", grund: String(e?.message ?? e).slice(0, 200), stufe };
    }
    await nachfassBuchen(lage, stufe, gesendet, m, text, lauf);
    console.log(`[LEAD-POST] Anfrage #${anfrageId}: N${stufe} aus js@ gesendet`);
    return { ergebnis: "gesendet", grund: null, stufe };
  } catch (err) {
    const grund = String((err as Error)?.message ?? err).slice(0, 200);
    console.error(`[LEAD-POST] Nachfass #${anfrageId}:`, grund);
    return { ergebnis: "fehler", grund };
  }
}

async function nachfassBuchen(lage: LeadLage, stufe: 1 | 2 | 3, gesendet: { id: string; threadId: string }, m: LeadMailText, text: string, lauf: Lauf): Promise<void> {
  const wAm = lage.weg?.willkommenAm ?? new Date();
  // Nach einem späten N1 (Mangel 5) kommt die nächste Mail frühestens zwei Werktage später — nie an zwei Tagen hintereinander.
  const mindestens = berlinZeitpunkt(werktagPlus(berlinZeit(new Date()).iso, 2, feiertagFuer(lage.land)), V.nachfassStunde * 60);
  const plan = stufe < 3 ? nachfassFaelligAm(wAm, (stufe + 1) as 2 | 3, lage.land) : null;
  const naechste = plan ? new Date(Math.max(plan.getTime(), mindestens.getTime())) : null;
  await lauf`
    UPDATE fiaon_lead_weg SET nachfass_stufe = ${stufe}, nachfass_am = NOW(), nachfass_laeuft = NULL, nachfass_faellig = ${naechste}, updated_at = NOW()
     WHERE anfrage_id = ${lage.anfrageId}`;
  await postMerken(lage.anfrageId, { richtung: "aus", art: `n${stufe}`, gmailId: gesendet.id || null, threadId: gesendet.threadId, betreff: m.betreff, auszug: text }, lauf);
  await protokollieren(EV.nachfass, lage.email, `n${stufe}`, lage.anfrageId, m.betreff, lauf);
  await cockpitZeile(lage.firmaId, "lead_mail", stufe === 3
    ? "Letzte Nachfass-Mail von Justin (N3) — danach keine automatische Mail mehr."
    : `Nachfass-Mail N${stufe} von Justin (js@, im selben Faden) mit dem Terminlink.`, lauf);
}

async function nachfassAbgleichen(lauf: Lauf): Promise<number> {
  const offen = (await lauf`
    SELECT anfrage_id, nachfass_laeuft, nachfass_stufe FROM fiaon_lead_weg
     WHERE nachfass_laeuft IS NOT NULL AND nachfass_laeuft < NOW() - INTERVAL '15 minutes'
     ORDER BY nachfass_laeuft LIMIT 5`.catch(() => [])) as any[];
  let n = 0;
  for (const o of offen) {
    const lage = await leadLageLesen(Number(o.anfrage_id), lauf);
    if (!lage) continue;
    let fund: { id: string; threadId: string } | null = null;
    try { fund = await gmail().gesendetSuchen(LEAD_POSTFACH, lage.email, new Date(o.nachfass_laeuft)); }
    catch { continue; }
    const stufe = (Number(o.nachfass_stufe) + 1) as 1 | 2 | 3;
    if (fund && stufe <= 3) {
      const m = nachfassFuer(stufe, lage, { url: "https://fiaon.com/" }, new Date(o.nachfass_laeuft));
      await nachfassBuchen(lage, stufe, fund, m, "(nachgebucht aus dem Gesendet-Ordner)", lauf);
    } else {
      await lauf`UPDATE fiaon_lead_weg SET nachfass_laeuft = NULL WHERE anfrage_id = ${o.anfrage_id}`.catch(() => {});
    }
    n++;
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANTWORTEN IN js@ — Cockpit-Zeile, Nachfass-Stopp, Meldung an Justin, Auftrag an die zuständige Person
//
// Nachbesserung 05.11.2026 (Gutachten Technik Mangel 1, Lead-Sicht Mangel 1/18, Sicherheit Mangel 6/13):
//   · Der Leser läuft nur, wenn das Willkommen an ist (mit Zählbeginn), und nur für Anfragen ab dem Zählbeginn oder mit einem
//     Willkommen aus js@ — der Altbestand bleibt still; dazu ein eigener Not-Aus (lead_global_antworten_an).
//   · EIN Rückruf-Auftrag je Anfrage (global-antwort:<Anfrage>) — jede weitere Mail hängt sich als Beitrag daran. Keiner bei
//     Termin, Kunde, offenem Angebot, offenem Anruf-Auftrag (dann ein Beitrag dort), „bitte nicht anrufen“, ohne Lead-Mail im
//     Faden oder wenn Justin im Faden in den letzten Tagen selbst schrieb. Schreibt Justin danach selbst, schließt er sich.
//   · Die Meldung an Justin nur bei der ersten Antwort — danach eine Cockpit-Zeile (die Mails liegen ohnehin in js@).
//   · „kein Interesse“ (schriftliche Absage) → keine Mail UND kein Anruf; „keine Mails“ → keine Mail, anrufen bleibt erlaubt.
//     Die Abmelde-Mail des Mailprogramms (List-Unsubscribe, Betreff „Stopp“) zählt als „keine Mails“.
//   · Dieselbe Regel für Antworten an Maras Postfächer (Postmeister-Weiche 0c, leadAntwortBehandeln).
// ═══════════════════════════════════════════════════════════════════════════
export interface AntwortErgebnis { gelesen: number; antworten: number; abmeldungen: number; ruecklaeufer: number; vonHand: number; automatisch: number; fehler: number }

/** Die Meldung an Justin im Faden des Leads (Dossier-Faden) — kurz, keine Aufgabe. */
async function justinMelden(lage: LeadLage, kopf: string, saetze: string[], lauf: Lauf): Promise<void> {
  try {
    const { fadenLesen, dossierEinstellungen } = await import("./fiaon-lead-dossier");
    const faden = await fadenLesen(lage.firmaId, lauf);
    const an = (await dossierEinstellungen(lauf)).anAdresse;
    const anzeige = linksEntschaerfen(leadAnzeigeName(lage.firmaRoh, lage.name));
    const cockpit = absoluteUrl(lage.firmaId ? `/agent/firmen?firma=${lage.firmaId}` : "/agent/firmen");
    const v = await anJustinSenden({
      an, name: "Justin", betreff: faden.stamm ? fadenAntwortBetreff(faden.stamm) : `Lead: ${anzeige}`,
      text: [kopf, "", "Hallo Justin,", "", ...saetze].join("\n"),
      knoepfe: [{ text: "Im Firmen-Cockpit öffnen", url: cockpit }], kopfzeilen: faden.kopfzeilen ?? undefined,
      antwortAn: { email: an, name: "Justin" }, verlinken: [cockpit], abschnitteFett: true,
    });
    if (!v.ok) console.error(`[LEAD-POST] Meldung an Justin (#${lage.anfrageId}) nicht gesendet: ${v.grund}`);
  } catch (e) {
    console.error(`[LEAD-POST] Meldung an Justin (#${lage.anfrageId}):`, String((e as Error)?.message ?? e).slice(0, 160));
  }
}

/** „keine Mails“: nie wieder eine Lead-Mail, Werbesperre an jeder Person hinter der Adresse (Gutachten 0, Mangel 5). */
export async function leadAbmelden(lage: LeadLage, quelle: string, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`UPDATE fiaon_lead_weg SET abgemeldet_am = COALESCE(abgemeldet_am, NOW()), updated_at = NOW() WHERE anfrage_id = ${lage.anfrageId}`.catch(() => {});
  await stoppSetzen(lage, "abgemeldet", lauf);
  try {
    const { personenAnAdresse } = await import("./fiaon-mail-frequenz");
    const { werbesperreSetzen } = await import("../routes/fiaon-abmelden");
    for (const id of await personenAnAdresse(lage.email)) await werbesperreSetzen(id, `Werbesperre: Antwort „keine Mails“ auf Justins Lead-Mail (${quelle}).`).catch(() => false);
  } catch { /* die Sperre am Lead hält trotzdem */ }
  await cockpitZeile(lage.firmaId, "abgemeldet", "Der Lead möchte keine Mails mehr — keine Lead-Mail mehr (Anrufen bleibt erlaubt).", lauf);
}

/**
 * Die schriftliche Absage (Gutachten Sicherheit, Mangel 6): „kein Interesse“ heißt auch kein Anruf mehr — der EINE Stand
 * schließt den Anruf-Auftrag (und den Rückruf der Vertretung), die Firma steht auf „kein Interesse“, die Erinnerungsleiter
 * schweigt, und im Cockpit steht „Nicht anrufen — schriftlich abgesagt“. Wirft nie.
 */
export async function leadSchriftlichAbgesagt(lage: LeadLage, quelle: string, lauf: Lauf = sqlPool): Promise<void> {
  try {
    if (lage.firmaId) {
      await lauf`UPDATE fiaon_firmen_leads SET status = 'kein_interesse', wiedervorlage = NULL, updated_at = NOW()
                  WHERE id = ${lage.firmaId} AND COALESCE(status, '') NOT IN ('kunde', 'antrag')`.catch(() => {});
    }
    await lauf`UPDATE fiaon_lead_takt SET abgesagt_am = COALESCE(abgesagt_am, NOW()), updated_at = NOW() WHERE anfrage_id = ${lage.anfrageId}`.catch(() => {});
    const { leadStandSetzen } = await import("./fiaon-lead-takt");
    await leadStandSetzen({ anfrageId: lage.anfrageId, firmaId: lage.firmaId, ereignis: "schriftlich_abgesagt", wer: { id: null, name: "System" } }, lauf);
    await cockpitZeile(lage.firmaId, "abgesagt", `Nicht anrufen — schriftlich abgesagt (Antwort an ${quelle}). Der Anruf-Auftrag ist geschlossen.`, lauf);
  } catch (e) {
    console.error(`[LEAD-POST] Absage zu #${lage.anfrageId}:`, String((e as Error)?.message ?? e).slice(0, 160));
  }
}

/** Ein offener Anruf-Auftrag zu dieser Anfrage (Daniels „bitte anrufen“ oder der Rückruf der Vertretung)? */
async function offenerAnrufAuftrag(anfrageId: number, lauf: Lauf): Promise<{ id: number } | null> {
  const [t] = (await lauf`
    SELECT id FROM fiaon_betreiber_todos
     WHERE schluessel = ANY(${[`global-anfrage:${anfrageId}`, `global-rueckruf:${anfrageId}`]}) AND status <> 'erledigt'
     ORDER BY id LIMIT 1`.catch(() => [])) as any[];
  return t ? { id: Number(t.id) } : null;
}

/** Schrieb Justin in diesem Faden in den letzten Tagen selbst (von Hand)? */
async function handImFaden(anfrageId: number, lauf: Lauf): Promise<boolean> {
  const [h] = (await lauf`
    SELECT 1 AS ja FROM fiaon_lead_post
     WHERE anfrage_id = ${anfrageId} AND art = 'von_hand' AND am > NOW() - ${V.handFadenTage}::int * INTERVAL '1 day' LIMIT 1`.catch(() => [])) as any[];
  return !!h;
}

/**
 * Wann eine Antwort KEINEN Rückruf-Auftrag bekommt — die erste zutreffende Regel, sonst null (Gutachten Technik Mangel 1,
 * Lead-Sicht Mangel 1). Rein.
 */
export function rueckrufGrund(f: { termin: boolean; kunde: boolean; angebot: boolean; keineAnrufe: boolean; hand: boolean; ohneFaden: boolean; offen: boolean }): string | null {
  if (f.termin) return "termin";
  if (f.kunde) return "kunde";
  if (f.angebot) return "angebot";
  if (f.keineAnrufe) return "keine_anrufe";
  if (f.hand) return "hand";
  if (f.ohneFaden) return "ohne_faden";
  if (f.offen) return "offen";
  return null;
}

export interface LeadAntwortEin {
  /** „js@“ oder das Mara-Postfach (welcome@, support@). */
  quelle: string;
  gmailId: string | null; threadId: string | null; betreff: string; kern: string; datum: Date; art: LeadAntwortArt;
}

/** Der Rückruf-Auftrag an die zuständige Person — EINER je Anfrage; weitere Mails hängen sich als Beitrag an. */
async function rueckrufAuftrag(lage: LeadLage, ein: LeadAntwortEin, lauf: Lauf): Promise<string | null> {
  const wunsch = wunschzeitErkennen(ein.kern, ein.datum);
  let frei: boolean | null = null;
  if (wunsch) {
    try {
      const { globalAngebotLaden } = await import("./fiaon-global-termin");
      const a = await globalAngebotLaden();
      frei = a.ergebnis.frei.some((x) => x.tag === wunsch.tag && x.zeit === wunsch.zeit);
    } catch { frei = null; }
  }
  const wunschText = wunsch ? `${tagText(berlinZeitpunkt(wunsch.tag, 12 * 60), "de")} ${wunsch.zeit} Uhr` : null;
  const heute = berlinZeit(new Date()).iso;
  const wo = ein.quelle === "js@" ? "auf Justins Mail (js@)" : `an ${ein.quelle}`;
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: null, ref: null,
      titel: `FIAON Global: ${leadAnzeigeName(lage.firmaRoh, lage.name)} hat geschrieben${wunschText ? ` — Wunschzeit ${wunschText}` : ""}`,
      text: [
        `Der Lead hat ${wo} geschrieben: „${linksEntschaerfen(ein.betreff || "(ohne Betreff)")}“.`,
        `Auszug: „${linksEntschaerfen(ein.kern.replace(/\s+/g, " ").slice(0, 400))}“`,
        wunschText
          ? (frei ? `Er nennt ${wunschText} — die Zeit ist bei Justin frei: bitte im Cockpit „Termin bei Justin eintragen“ (mit seiner Notiz).`
            : `Er nennt ${wunschText} — bei Justin ist diese Zeit nicht frei: bitte zu seiner Zeit anrufen und eine passende vereinbaren.`)
          : "Bitte anrufen und, wenn er möchte, im Cockpit „Termin bei Justin eintragen“.",
        `Telefon: ${lage.telefon || "—"} · E-Mail: ${lage.email}`,
        "Justin hat die Mail in seinem Postfach — die Plattform antwortet nie selbst.",
      ].join("\n"),
      // Zur Wunschzeit fällig (Gutachten Lead-Sicht, Mangel 2) — sonst heute.
      faelligAm: wunsch && wunsch.tag >= heute ? wunsch.tag : heute, dringend: true,
      schluessel: `global-antwort:${lage.anfrageId}`, bereich: "sonstiges", quelle: "global", autorName: "FIAON Global",
      link: lage.firmaId ? `/agent/firmen?firma=${lage.firmaId}` : "/agent/firmen",
      agentId: lage.zustaendig?.id ?? null,
      anlageText: "Antwort eines Business-Leads.",
      // E-476 Scheibe 5 (Entscheidung 3A): die Meldung an „Lead-Meldungen an“, nie an die private Login-Adresse.
      meldung: await import("./fiaon-lead-takt").then((m) => m.leadAuftragMeldung(lauf)).catch(() => null),
    });
  } catch (e) {
    console.error(`[LEAD-POST] Rückruf-Auftrag zu #${lage.anfrageId}:`, String((e as Error)?.message ?? e).slice(0, 160));
  }
  return wunschText ? `${wunschText}${frei === true ? " (bei Justin frei)" : frei === false ? " (bei Justin belegt)" : ""}` : null;
}

/**
 * EINE Antwort eines Business-Leads behandeln — aus js@ (Antwort-Leser) oder aus einem Mara-Postfach (Postmeister-Weiche 0c).
 * Gibt die Zähl-Art zurück oder null (schon gesehen). Wirft nie die Antwort weg: jede Störung steht im Log.
 */
export async function leadAntwortBehandeln(lage: LeadLage, ein: LeadAntwortEin, lauf: Lauf = sqlPool): Promise<keyof AntwortErgebnis | null> {
  const betreff = linksEntschaerfen(ein.betreff || "(ohne Betreff)").slice(0, 140);
  const auszug = linksEntschaerfen(ein.kern.replace(/\s+/g, " ").slice(0, 600));
  if (ein.art.art === "absage" || ein.art.art === "keine_mails") {
    const art = ein.art.art === "absage" ? "absage" : "abmeldung";
    const [frueher] = (await lauf`SELECT 1 AS ja FROM fiaon_lead_post WHERE anfrage_id = ${lage.anfrageId} AND art = ${art} LIMIT 1`.catch(() => [])) as any[];
    if (!(await postMerken(lage.anfrageId, { richtung: "ein", art, gmailId: ein.gmailId, threadId: ein.threadId, betreff: ein.betreff, auszug: ein.kern, am: ein.datum }, lauf)) && ein.gmailId) return null;
    await lauf`UPDATE fiaon_lead_weg SET antwort_am = COALESCE(antwort_am, ${ein.datum}), updated_at = NOW() WHERE anfrage_id = ${lage.anfrageId}`.catch(() => {});
    await leadAbmelden(lage, ein.quelle, lauf);
    if (ein.art.art === "absage") await leadSchriftlichAbgesagt(lage, ein.quelle, lauf);
    if (!frueher) {
      await justinMelden(lage, ein.art.art === "absage" ? `ABSAGE: „${betreff}“` : `ABMELDUNG: „${betreff}“`, [
        ein.art.art === "absage"
          ? `${linksEntschaerfen(lage.name || "Der Lead")} hat schriftlich abgesagt (${ein.quelle}) — es geht keine Lead-Mail mehr hinaus, und niemand ruft an: der Anruf-Auftrag ist geschlossen.`
          : `${linksEntschaerfen(lage.name || "Der Lead")} möchte keine Mails mehr (${ein.quelle}) — es geht keine Lead-Mail mehr hinaus. Anrufen bleibt erlaubt.`,
        "", "AUSZUG", `„${auszug}“`,
      ], lauf);
    }
    return "abmeldungen";
  }
  const [frueher] = (await lauf`SELECT 1 AS ja FROM fiaon_lead_post WHERE anfrage_id = ${lage.anfrageId} AND art = 'antwort' LIMIT 1`.catch(() => [])) as any[];
  if (!(await postMerken(lage.anfrageId, { richtung: "ein", art: "antwort", gmailId: ein.gmailId, threadId: ein.threadId, betreff: ein.betreff, auszug: ein.kern, am: ein.datum }, lauf)) && ein.gmailId) return null;
  await lauf`UPDATE fiaon_lead_weg SET antwort_am = COALESCE(antwort_am, ${ein.datum}), updated_at = NOW() WHERE anfrage_id = ${lage.anfrageId}`.catch(() => {});
  await stoppSetzen(lage, "antwort", lauf);
  const offen = await offenerAnrufAuftrag(lage.anfrageId, lauf);
  const grund = rueckrufGrund({
    termin: lage.stopp.termin, kunde: lage.stopp.kunde, angebot: lage.stopp.angebot, keineAnrufe: ein.art.keineAnrufe,
    hand: ein.quelle === "js@" && (await handImFaden(lage.anfrageId, lauf)),
    ohneFaden: ein.quelle === "js@" && !lage.weg?.gmailFaden, offen: !!offen,
  });
  let wunsch: string | null = null;
  if (!grund) wunsch = await rueckrufAuftrag(lage, ein, lauf);
  else if (grund === "offen" && offen) {
    // Der offene Anruf-Auftrag bekommt die Antwort als Beitrag — mit seiner Wunschzeit (dann ist er zu dieser Zeit fällig).
    const w = wunschzeitErkennen(ein.kern, ein.datum);
    if (w) wunsch = `${tagText(berlinZeitpunkt(w.tag, 12 * 60), "de")} ${w.zeit} Uhr`;
    const { auftragBeitrag } = await import("./fiaon-auftraege");
    await auftragBeitrag(offen.id, { autorArt: "system", autorName: "FIAON Global", art: "kommentar",
      text: `Der Lead hat geschrieben (${ein.quelle}): „${betreff}“${wunsch ? ` — Wunschzeit ${wunsch}` : ""} — Auszug: „${auszug.slice(0, 400)}“` }, lauf).catch(() => false);
    if (w && w.tag >= berlinZeit(new Date()).iso) await lauf`UPDATE fiaon_betreiber_todos SET faellig_am = ${w.tag}::date, agent_gelesen_am = NULL, updated_at = NOW() WHERE id = ${offen.id} AND status <> 'erledigt'`.catch(() => {});
  }
  const zeile: Record<string, string> = {
    termin: "er hat schon ein Gespräch — kein Anruf-Auftrag", kunde: "er ist schon Kunde — kein Anruf-Auftrag",
    angebot: "er hat ein offenes Angebot — kein Anruf-Auftrag", keine_anrufe: "er möchte nicht angerufen werden — kein Anruf-Auftrag",
    hand: "Justin schreibt im Faden selbst — kein Anruf-Auftrag", ohne_faden: "kein Faden einer Lead-Mail — kein Anruf-Auftrag",
    offen: "hängt am offenen Anruf-Auftrag",
  };
  await cockpitZeile(lage.firmaId, "antwort", `Der Lead hat geschrieben (${ein.quelle}): „${betreff}“${wunsch ? ` — Wunschzeit ${wunsch}` : ""}. ${grund ? zeile[grund] : "Rückruf-Auftrag an die zuständige Person"}; keine weitere Lead-Mail.`, lauf);
  // Die Meldung an Justin nur bei der ersten Antwort — danach reicht die Cockpit-Zeile (die Mails liegen ohnehin bei ihm).
  if (!frueher) {
    const wer = lage.zustaendig ? lage.zustaendig.name : "Das Team";
    const was = grund === "termin" ? "Er hat schon ein Gespräch bei dir — die Antwort betrifft vermutlich Verschieben oder die Nummer. Kein Anruf-Auftrag an das Team."
      : grund === "keine_anrufe" ? "Er möchte nicht angerufen werden — deshalb kein Anruf-Auftrag; die Mail liegt in deinem Postfach."
        : grund === "hand" || grund === "ohne_faden" ? "Du schreibst mit ihm selbst — deshalb kein Anruf-Auftrag an das Team."
          : grund === "kunde" || grund === "angebot" ? "Er ist schon Kunde bzw. hat ein offenes Angebot — kein Anruf-Auftrag an das Team."
            : grund === "offen" ? `${wer} hat schon einen offenen Anruf-Auftrag — die Antwort hängt dort dran. Keine Aufgabe für dich.`
              : `${wer} hat einen Auftrag: anrufen${wunsch ? ` (Wunschzeit ${wunsch})` : ""} und den Termin bei dir eintragen — keine Aufgabe für dich.`;
    await justinMelden(lage, `ANTWORT DES LEADS (${ein.quelle}): „${betreff}“`, [
      `${linksEntschaerfen(lage.name || "Der Lead")} hat geschrieben — die Mail liegt ${ein.quelle === "js@" ? `in deinem Postfach js@ im Faden „${betreff.slice(0, 80)}“` : `ungelesen im Ordner „FIAON/Global-Lead“ von ${ein.quelle} (Mara antwortet Business-Leads nicht)`}.`,
      `Das Nachfassen ist gestoppt. ${was}`,
      "", "AUSZUG", `„${auszug}“`,
    ], lauf);
  }
  return "antworten";
}

/** Justin hat im Faden selbst geschrieben — ein offener Rückruf-Auftrag aus einer Antwort entfällt (Lead-Sicht, Mangel 1 Nr. 5). */
async function rueckrufSchliessen(anfrageId: number, lauf: Lauf): Promise<void> {
  const [t] = (await lauf`SELECT id FROM fiaon_betreiber_todos WHERE schluessel = ${`global-antwort:${anfrageId}`} AND status <> 'erledigt'`.catch(() => [])) as any[];
  if (!t) return;
  const { auftragErledigen } = await import("./fiaon-auftraege");
  await auftragErledigen(Number(t.id), {
    art: "auto", von: "System", autorArt: "system",
    ergebnis: "Justin hat dem Lead selbst geantwortet (js@) — der Rückruf entfällt.", ereignis: "Justin antwortet selbst",
  }, lauf).catch(() => false);
}

let letzteAntwortRunde = 0;
/** Gmail-Nachrichten, die keinen Lead betreffen (fremde Rückläufer, fremde Mails im Posteingang) — nicht alle 6 Minuten neu lesen. */
const fremdGelesen = new Map<string, number>();
function fremdMerken(id: string): void {
  fremdGelesen.set(id, Date.now() + 5 * 86_400_000);
  if (fremdGelesen.size > 5000) {
    const jetzt = Date.now();
    for (const [k, bis] of Array.from(fremdGelesen.entries())) if (bis < jetzt || fremdGelesen.size > 4000) fremdGelesen.delete(k);
  }
}
/** Prüfstand: die Merkliste leeren. */
export function leadPostFremdVergessen(): void { fremdGelesen.clear(); }

/**
 * Liest js@ — NUR Mails von Adressen offener Global-Leads (ab dem Zählbeginn oder mit Willkommen aus js@), Mails in UNSEREN
 * Fäden (auch von einer anderen Adresse), Rückläufer und eigene Mails in unseren Fäden. Antwortet nie. Jede Gmail-Nachricht
 * genau einmal (fiaon_lead_post.gmail_id). Läuft nur mit Willkommen AN + Zählbeginn + Not-Aus AN (`erzwingen` = Prüfstand).
 */
export async function leadAntwortenLesen(opt: { lauf?: Lauf; tage?: number; erzwingen?: boolean } = {}): Promise<AntwortErgebnis> {
  const lauf = opt.lauf ?? sqlPool;
  const erg: AntwortErgebnis = { gelesen: 0, antworten: 0, abmeldungen: 0, ruecklaeufer: 0, vonHand: 0, automatisch: 0, fehler: 0 };
  const einst = await leadPostEinstellungen(lauf);
  if (!opt.erzwingen && (!einst.willkommenAn || !einst.ab || !einst.antwortenAn)) return erg;
  if (!(await gmailBereit())) return erg;
  await leadPostSchema(lauf);
  const ab = einst.ab ?? new Date(0).toISOString();
  const offene = (await lauf`
    SELECT a.id, LOWER(COALESCE(a.email, '')) AS email, w.gmail_faden, w.gmail_erste_id
      FROM fiaon_anfragen a LEFT JOIN fiaon_lead_weg w ON w.anfrage_id = a.id
     WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE) AND COALESCE(a.status, '') <> 'privat'
       AND a.created_at > NOW() - ${V.antwortTage}::int * INTERVAL '1 day' AND COALESCE(a.email, '') <> ''
       AND (a.created_at >= ${ab}::timestamptz OR w.willkommen_am IS NOT NULL)
     ORDER BY a.created_at DESC LIMIT 400`.catch(() => [])) as any[];
  if (!offene.length) return erg;
  const jeAdresse = new Map<string, number>();
  const jeFaden = new Map<string, number>();
  const eigene = new Set<string>();
  for (const o of offene) {
    if (!jeAdresse.has(o.email)) jeAdresse.set(String(o.email), Number(o.id));
    if (o.gmail_faden) jeFaden.set(String(o.gmail_faden), Number(o.id));
  }
  const bekannt = new Set(((await lauf`SELECT gmail_id FROM fiaon_lead_post WHERE gmail_id IS NOT NULL AND am > NOW() - INTERVAL '60 days'`.catch(() => [])) as any[]).map((r) => String(r.gmail_id)));
  for (const id of Array.from(bekannt)) eigene.add(id);
  const tage = opt.tage ?? 4;
  const adressen = Array.from(jeAdresse.keys()).filter((x) => /^[^\s@()"]+@[^\s@()"]+$/.test(x));
  const abfragen: { q: string; art: "ein" | "dsn" | "aus" | "faden" }[] = [
    { q: `newer_than:${tage}d (from:mailer-daemon OR from:postmaster)`, art: "dsn" },
    { q: `newer_than:${tage}d in:sent`, art: "aus" },
  ];
  for (let i = 0; i < adressen.length; i += 20) abfragen.push({ q: `newer_than:${tage}d -in:sent -in:drafts -in:chats from:(${adressen.slice(i, i + 20).join(" OR ")})`, art: "ein" });
  // Nachbesserung (Gutachten Technik, Mangel 12 b): Antwortet der Lead im Faden von einer anderen Adresse, findet ihn die
  // Adress-Suche nicht — der Posteingang wird deshalb auf unsere Fäden gefiltert (nur die Kennungen, gelesen wird nur ein Treffer).
  if (jeFaden.size) abfragen.push({ q: `newer_than:${tage}d -in:sent -in:drafts -in:chats -from:mailer-daemon -from:postmaster`, art: "faden" });
  const g = gmail();
  const gesehen = new Set<string>();
  const jetztMs = Date.now();
  for (const abf of abfragen) {
    let liste: { id: string; threadId: string }[] = [];
    try { liste = await g.suchen(LEAD_POSTFACH, abf.q, 100); }
    catch (e) { erg.fehler++; console.error("[LEAD-POST] js@ suchen:", String((e as Error)?.message ?? e).slice(0, 160)); continue; }
    for (const m of liste) {
      if (gesehen.has(m.id) || eigene.has(m.id)) continue;
      if ((fremdGelesen.get(m.id) ?? 0) > jetztMs) continue;
      gesehen.add(m.id);
      // „aus“ und „faden“: nur Mails in UNSEREN Fäden — der Rest von js@ (Investoren, Radar) bleibt unberührt und ungelesen.
      if ((abf.art === "aus" || abf.art === "faden") && !jeFaden.has(m.threadId)) continue;
      try {
        const n = await g.lesen(LEAD_POSTFACH, m.id);
        erg.gelesen++;
        const r = await nachrichtVerarbeiten(n, abf.art === "faden" ? "ein" : abf.art, { jeAdresse, jeFaden }, lauf);
        if (r) (erg as any)[r]++;
        else if (abf.art === "dsn" || abf.art === "faden") fremdMerken(m.id);
      } catch (e) {
        erg.fehler++;
        console.error(`[LEAD-POST] js@ ${m.id}:`, String((e as Error)?.message ?? e).slice(0, 160));
      }
    }
  }
  return erg;
}

async function nachrichtVerarbeiten(
  n: GmailNachricht, art: "ein" | "dsn" | "aus", karte: { jeAdresse: Map<string, number>; jeFaden: Map<string, number> }, lauf: Lauf,
): Promise<keyof AntwortErgebnis | null> {
  const { antwortVorab, antwortKern } = await import("./fiaon-radar-faden");
  if (art === "aus") {
    const anfrageId = karte.jeFaden.get(n.threadId);
    if (!anfrageId || n.vonAdresse !== LEAD_POSTFACH) return null;
    if (!(await postMerken(anfrageId, { richtung: "aus", art: "von_hand", gmailId: n.id, threadId: n.threadId, betreff: n.betreff, auszug: antwortKern(n.text), am: n.datum }, lauf))) return null;
    const lage = await leadLageLesen(anfrageId, lauf);
    if (lage) await stoppSetzen(lage, "von_hand", lauf);
    await rueckrufSchliessen(anfrageId, lauf);
    return "vonHand";
  }
  if (art === "dsn") {
    // Ein Rückläufer gehört zu uns, wenn er in einem unserer Fäden steht oder eine Lead-Adresse nennt.
    let anfrageId = karte.jeFaden.get(n.threadId) ?? null;
    if (!anfrageId) {
      const text = `${n.betreff}\n${n.text}`.toLowerCase();
      karte.jeAdresse.forEach((id, adr) => { if (!anfrageId && text.includes(adr)) anfrageId = id; });
    }
    if (!anfrageId) return null;
    const vorab = antwortVorab({ vonAdresse: n.vonAdresse, betreff: n.betreff, text: n.text });
    if (vorab !== "unzustellbar") {
      await postMerken(anfrageId, { richtung: "ein", art: "automatisch", gmailId: n.id, threadId: n.threadId, betreff: n.betreff, auszug: n.snippet || "", am: n.datum }, lauf);
      return "automatisch";
    }
    if (!(await postMerken(anfrageId, { richtung: "ein", art: "ruecklaeufer", gmailId: n.id, threadId: n.threadId, betreff: n.betreff, auszug: n.snippet || "", am: n.datum }, lauf))) return null;
    const lage = await leadLageLesen(anfrageId, lauf);
    if (lage) {
      await stoppSetzen(lage, "unzustellbar", lauf);
      await cockpitZeile(lage.firmaId, "ruecklaeufer", "Justins Lead-Mail kam unzustellbar zurück — die Adresse stimmt nicht. Bitte im Anruf die richtige Adresse erfragen.", lauf);
      await justinMelden(lage, "RÜCKLÄUFER: deine Mail an den Lead kam unzustellbar zurück", [
        `Die Mail an ${lage.email} kam unzustellbar zurück. Es geht keine weitere Lead-Mail an diese Adresse.`,
        `${lage.zustaendig ? `${lage.zustaendig.name} ruft` : "Das Team ruft"} wie geplant an und fragt die richtige Adresse ab.`,
      ], lauf);
    }
    return "ruecklaeufer";
  }
  // art === "ein": eine Mail von einer Lead-Adresse an js@ (oder in einem unserer Fäden von einer anderen Adresse).
  const anfrageId = karte.jeFaden.get(n.threadId) ?? karte.jeAdresse.get(n.vonAdresse) ?? (n.antwortAn ? karte.jeAdresse.get(String(n.antwortAn).replace(/^.*<([^>]+)>.*$/, "$1").trim().toLowerCase()) : undefined) ?? null;
  if (!anfrageId) return null;
  const kern = antwortKern(n.text);
  const vorab = antwortVorab({ vonAdresse: n.vonAdresse, betreff: n.betreff, text: kern });
  const artAntwort = leadAntwortArt({ kern, betreff: n.betreff, vorab });
  // Die Abmelde-Mail des Mailprogramms trägt oft eine Automatik-Kennung — sie zählt trotzdem (Gutachten Sicherheit, Mangel 13).
  if ((n.autoHinweis || vorab === "abwesend" || vorab === "automatisch") && artAntwort.art !== "keine_mails") {
    await postMerken(anfrageId, { richtung: "ein", art: "automatisch", gmailId: n.id, threadId: n.threadId, betreff: n.betreff, auszug: kern, am: n.datum }, lauf);
    return "automatisch";
  }
  const lage = await leadLageLesen(anfrageId, lauf);
  if (!lage) return null;
  return leadAntwortBehandeln(lage, { quelle: "js@", gmailId: n.id, threadId: n.threadId, betreff: n.betreff, kern, datum: n.datum, art: artAntwort }, lauf);
}

// ═══════════════════════════════════════════════════════════════════════════
// RÜCKRUF-BITTE ÜBER DIE SEITE MIT DEM PERSÖNLICHEN LINK (Nachbesserung E-476, Gutachten Lead-Sicht Mangel 8)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Der Lead kommt über seinen Link, findet keine passende Zeit und schickt „Rückruf anfragen“: KEINE zweite Anfrage (zweiter
 * Auftrag, zweite Lead-Meldung, zweites Dossier), sondern DIESE Anfrage bekommt seine Wunschzeit — der Anruf-Auftrag hängt sie
 * an (oder geht wieder auf), Justins Nachfass endet. Eingang: keine Tabellen-Anweisung, jede Störung nur im Log. Wirft nie.
 */
export async function leadRueckrufWunsch(anfrageId: number, ein: { wunschzeit: string | null; text: string | null; firma: string; name: string; telefon: string; email: string }, lauf: Lauf = sqlPool): Promise<{ ok: boolean; zustaendigName: string | null }> {
  try {
    const wz = String(ein.wunschzeit ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const nachricht = String(ein.text ?? "").trim().slice(0, 1500);
    const heute = berlinZeit(new Date());
    const zusatz = [`Rückruf-Bitte über die Seite (${heute.datum}${heute.iso.slice(0, 4)})`, wz ? `Wunschzeit: ${wz}` : null, nachricht ? `Nachricht: ${nachricht}` : null].filter(Boolean).join(" · ");
    await lauf`UPDATE fiaon_anfragen SET text = CONCAT_WS(E'\n\n', NULLIF(text, ''), ${zusatz}::text) WHERE id = ${anfrageId} AND art = 'global'`.catch(() => {});
    await lauf`UPDATE fiaon_lead_weg SET stopp_am = COALESCE(stopp_am, NOW()), stopp_grund = COALESCE(stopp_grund, 'rueckruf'), nachfass_faellig = NULL, updated_at = NOW()
                WHERE anfrage_id = ${anfrageId}`.catch(() => {});
    const z = await import("./fiaon-global-termin").then((m) => m.globalZustaendig()).catch(() => null);
    const [fl] = (await lauf`SELECT firma_id FROM fiaon_lead_weg WHERE anfrage_id = ${anfrageId}`.catch(() => [])) as any[];
    const firmaId = fl?.firma_id ? Number(fl.firma_id) : null;
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const erg = await auftragFuerKunden({
      personId: null, ref: null,
      titel: `FIAON Global: ${leadAnzeigeName(ein.firma, ein.name)} bittet um einen Rückruf${wz ? ` — ${wz.slice(0, 60)}` : ""}`,
      text: [
        `Rückruf-Bitte über seinen persönlichen Link (Anfrage #${anfrageId}) — keine passende Zeit im Kalender.`,
        wz ? `Wunschzeit: ${linksEntschaerfen(wz)} — bitte dann anrufen.` : "Bitte heute anrufen.",
        nachricht ? `Nachricht: „${linksEntschaerfen(nachricht.replace(/\s+/g, " ").slice(0, 400))}“` : null,
        `Telefon: ${ein.telefon || "—"} · E-Mail: ${ein.email || "—"}`,
      ].filter(Boolean).join("\n"),
      faelligAm: heute.iso, dringend: true, schluessel: `global-anfrage:${anfrageId}`, bereich: "sonstiges", quelle: "website",
      autorName: "Website", link: firmaId ? `/agent/firmen?firma=${firmaId}` : "/agent/firmen", agentId: z?.id ?? null,
      anlageText: "Rückruf-Bitte eines Business-Leads über seinen persönlichen Link.",
      meldung: await import("./fiaon-lead-takt").then((m) => m.leadAuftragMeldung(lauf)).catch(() => null),
    });
    await cockpitZeile(firmaId, "rueckruf", `Bittet über seinen Link um einen Rückruf${wz ? ` (Wunschzeit: ${linksEntschaerfen(wz).slice(0, 80)})` : ""} — keine weitere Lead-Mail von Justin.`, lauf);
    return { ok: true, zustaendigName: erg?.agentName ?? z?.name ?? null };
  } catch (e) {
    console.error(`[LEAD-POST] Rückruf-Bitte zu #${anfrageId}:`, String((e as Error)?.message ?? e).slice(0, 200));
    return { ok: false, zustaendigName: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LÄUFE
// ═══════════════════════════════════════════════════════════════════════════
let letzterPuls = 0;
/**
 * lead_post (2 Minuten, rund um die Uhr): Willkommen, Gesendet-Abgleich, Antworten in js@ (alle 6 Minuten — nur mit Willkommen
 * AN, Zählbeginn und Not-Aus AN). `true` = eine Historienzeile (gearbeitet oder Stundenpuls).
 */
export async function leadPostLauf(jetzt: Date = new Date(), lauf: Lauf = sqlPool): Promise<boolean> {
  if (!versandErlaubt()) return false;
  await leadPostSchema(lauf);
  const einst = await leadPostEinstellungen(lauf);
  let gearbeitet = 0;
  gearbeitet += await willkommenAbgleichen(lauf);
  gearbeitet += await nachfassAbgleichen(lauf);
  if (einst.willkommenAn && einst.ab) {
    const kandidaten = (await lauf`
      SELECT a.id FROM fiaon_anfragen a
        LEFT JOIN fiaon_lead_weg w ON w.anfrage_id = a.id
       WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE) AND COALESCE(a.status, 'neu') NOT IN ('privat', 'termin')
         AND a.created_at >= ${einst.ab}::timestamptz AND a.created_at > NOW() - ${V.hoechstensTage}::int * INTERVAL '1 day'
         AND a.created_at <= ${jetzt}::timestamptz - ${einst.ruheMin}::int * INTERVAL '1 minute'
         AND COALESCE(a.email, '') <> ''
         AND (w.anfrage_id IS NULL OR (w.willkommen_am IS NULL AND COALESCE(w.willkommen_status, '') NOT IN ('gesendet', 'ausgelassen')
              AND w.willkommen_laeuft IS NULL AND w.willkommen_versuche < 3))
       ORDER BY a.id LIMIT 5`.catch(() => [])) as any[];
    let deckel = false;
    for (const k of kandidaten) {
      const r = await willkommenSenden(Number(k.id), { jetzt, lauf });
      if (r.ergebnis !== "wartet" && r.ergebnis !== "aus") gearbeitet++;
      if (r.ergebnis === "wartet" && /^Tagesdeckel/.test(String(r.grund))) { deckel = true; break; }
    }
    // Nachbesserung (Gutachten Sicherheit, Mangel 2): der Tagesdeckel ist erreicht — der Rest wartet bis morgen, das Lagezimmer weiß es.
    if (deckel) {
      const { alarmMelden } = await import("./fiaon-system-alarme");
      await alarmMelden("lead-takt:flut", {
        quelle: "lead-takt", stufe: "rot", link: "/chef/s/lead-motor", endetNachStunden: 24,
        titel: "Lead-Wächter: ungewöhnlich viele neue Leads — Willkommens-Mails angehalten",
        text: `Heute gingen schon ${einst.willkommenMaxTag} Willkommens-Mails aus js@ hinaus (Tagesdeckel). Weitere warten bis morgen. Bitte im Lead-Motor prüfen, ob die Anfragen echt sind (Formular-Flut?) — Daniels Anruf-Aufträge stehen trotzdem.`,
      }, lauf).catch(() => ({ neu: false }));
    }
  }
  if (einst.willkommenAn && einst.ab && einst.antwortenAn && Date.now() - letzteAntwortRunde >= 6 * 60_000) {
    letzteAntwortRunde = Date.now();
    const a = await leadAntwortenLesen({ lauf });
    gearbeitet += a.antworten + a.abmeldungen + a.ruecklaeufer + a.vonHand;
  }
  if (gearbeitet > 0) { letzterPuls = Date.now(); return true; }
  if (Date.now() - letzterPuls >= 60 * 60_000) { letzterPuls = Date.now(); return true; }
  return false;
}

/**
 * lead_nachfass (10 Minuten): N1–N3 im Sendefenster. Die Meldung trägt „versandt“ und „faellig“ — der Wächter der
 * Verkaufsläufe schlägt an, wenn fällige Nachfass-Mails 24 Stunden lang nicht hinausgehen (Gutachten 0, Mangel 11).
 */
export async function leadNachfassLauf(jetzt: Date = new Date(), lauf: Lauf = sqlPool): Promise<{ versandt: number; faellig: number; aus: boolean; grund?: string }> {
  if (!versandErlaubt()) return { versandt: 0, faellig: 0, aus: true, grund: "aus" };
  await leadPostSchema(lauf);
  const einst = await leadPostEinstellungen(lauf);
  if (!einst.nachfassAn) return { versandt: 0, faellig: 0, aus: true, grund: "Nachfass ist ausgeschaltet" };
  const faellige = (await lauf`
    SELECT anfrage_id FROM fiaon_lead_weg
     WHERE willkommen_status = 'gesendet' AND stopp_am IS NULL AND nachfass_stufe < 3 AND nachfass_laeuft IS NULL
       AND nachfass_faellig IS NOT NULL AND nachfass_faellig <= ${jetzt}
     ORDER BY nachfass_faellig LIMIT 10`.catch(() => [])) as any[];
  if (!faellige.length) return { versandt: 0, faellig: 0, aus: false };
  // Außerhalb des Fensters wartet alles — das zählt nicht als „stumm“.
  if (!imSendefenster(jetzt, feiertagFuer(null))) return { versandt: 0, faellig: 0, aus: false, grund: "außerhalb Mo–Fr 9–18 Uhr" };
  let versandt = 0;
  for (const f of faellige) if ((await nachfassSenden(Number(f.anfrage_id), { jetzt, lauf })).ergebnis === "gesendet") versandt++;
  return { versandt, faellig: faellige.length, aus: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// INFO-MAIL NACH DEM ANRUF (Firmen-Cockpit) — die Regeln für Global-Leads
// ═══════════════════════════════════════════════════════════════════════════
export interface InfoMailUrteil { lead: boolean; anfrageId: number | null; sperre: string | null; link: string | null; art: "erreicht" | "nicht_erreicht" | "neutral" }

/**
 * Darf die Info-Mail an diese Firma? Ein Global-Lead (offene Anfrage, 60 Tage): nie bei einem Termin (die Bestätigung hat er,
 * Gutachten 0, Mangel 6); nach „nicht erreicht“ übernimmt Justins N1, wenn das Nachfassen läuft (Gutachten 1, Mangel 9);
 * das Mail-Budget gilt. Ohne Anfrage (Kaltakquise) bleibt alles wie bisher.
 */
export async function infoMailUrteil(firma: { email: string | null; telefon: string | null }, letztesErgebnis: string | null, lauf: Lauf = sqlPool): Promise<InfoMailUrteil> {
  // Der Einstieg „danke für das Gespräch eben“ nur nach einem erreichten Anruf (Plan 4.6) — ohne Anruf ein neutraler.
  const art: InfoMailUrteil["art"] = letztesErgebnis && /^erreicht_/.test(letztesErgebnis) ? "erreicht"
    : letztesErgebnis && ["nicht_erreicht", "mailbox"].includes(letztesErgebnis) ? "nicht_erreicht" : "neutral";
  const { offeneAnfrageFuer } = await import("./fiaon-lead-weg");
  const a = await offeneAnfrageFuer(firma.email, firma.telefon, lauf).catch(() => null);
  if (!a) return { lead: false, anfrageId: null, sperre: null, link: null, art };
  const lage = await leadLageLesen(a.anfrageId, lauf).catch(() => null);
  if (!lage) return { lead: false, anfrageId: null, sperre: null, link: null, art };
  if (lage.stopp.privat) return { lead: false, anfrageId: lage.anfrageId, sperre: "Diese Anfrage läuft über den Privat-Weg (Beschwerde oder Privatkunde) — keine Business-Info-Mail.", link: null, art };
  if (lage.stopp.termin) return { lead: true, anfrageId: lage.anfrageId, sperre: "Er hat schon ein Gespräch (Termin) — keine Info-Mail vor dem Gespräch, die Bestätigung hat er.", link: null, art };
  if (lage.stopp.abgemeldet) return { lead: true, anfrageId: lage.anfrageId, sperre: "Er möchte keine Mails mehr.", link: null, art };
  const einst = await leadPostEinstellungen(lauf);
  if (art === "nicht_erreicht" && lage.weg?.willkommenStatus === "gesendet" && !lage.weg.stoppAm && einst.nachfassAn) {
    return { lead: true, anfrageId: lage.anfrageId, sperre: "Justins Nachfass-Mail übernimmt „nicht erreicht“ (am nächsten Werktag um 10 Uhr) — keine zweite Mail.", link: null, art };
  }
  // Nach einem ERREICHTEN Anruf hat er um die Unterlagen gebeten — dann zählt der Tagesdeckel nicht (das Willkommen von heute
  // hielte sonst die versprochene Info-Mail auf); die Grenze von fünf Mails bis zum Gespräch gilt immer.
  const budget = leadMailBudget({ letzte24h: art === "erreicht" ? 0 : lage.budget.letzte24h, gesamt: lage.budget.gesamt });
  if (!budget.ok) return { lead: true, anfrageId: lage.anfrageId, sperre: `Mail-Budget: ${budget.grund}.`, link: null, art };
  const link = await leadCodeSichern(lage.anfrageId, { firmaId: lage.firmaId, lauf }).catch(() => null);
  return { lead: true, anfrageId: lage.anfrageId, sperre: null, link: link?.url ?? null, art };
}

/** Nach der Info-Mail an einen Global-Lead: der Nachfass endet (Gutachten 0, Mangel 6 — sonst zwei Mails, zwei Stimmen). */
export async function infoMailVermerken(anfrageId: number, an: string, betreff: string, lauf: Lauf = sqlPool): Promise<void> {
  await leadPostSchema(lauf).catch(() => {});
  await protokollieren(EV.info, an, "info", anfrageId, betreff, lauf);
  const lage = await leadLageLesen(anfrageId, lauf).catch(() => null);
  if (lage?.weg) await stoppSetzen(lage, "info_mail", lauf);
}

// ═══════════════════════════════════════════════════════════════════════════
// FÜR DAS DOSSIER (D1) — ein Satz: was der Lead von Justin bekommt
// ═══════════════════════════════════════════════════════════════════════════
export async function leadMailHinweis(anfrageId: number | null, lauf: Lauf = sqlPool): Promise<string | null> {
  if (!anfrageId) return null;
  try {
    const einst = await leadPostEinstellungen(lauf);
    const [a] = (await lauf`SELECT COALESCE(status, '') AS status FROM fiaon_anfragen WHERE id = ${anfrageId}`.catch(() => [])) as any[];
    if (a?.status === "privat") return "Privat-Weg (Beschwerde oder Privatkunde): keine Mail von dir, Daniel ruft nicht an — der Auftrag liegt bei der Leitung bzw. der Betreuung.";
    const [w] = (await lauf`SELECT willkommen_am, willkommen_status, willkommen_grund FROM fiaon_lead_weg WHERE anfrage_id = ${anfrageId}`.catch(() => [])) as any[];
    if (w?.willkommen_am) return `Willkommens-Mail von dir (js@) mit Terminlink ist raus (${berlinZeit(new Date(w.willkommen_am)).datum} ${String(berlinZeit(new Date(w.willkommen_am)).stunde).padStart(2, "0")}:${String(berlinZeit(new Date(w.willkommen_am)).minute).padStart(2, "0")}).`;
    if (w?.willkommen_status === "ausgelassen") return `Keine Willkommens-Mail: ${String(w.willkommen_grund ?? "").slice(0, 120)}.`;
    if (!einst.willkommenAn) return "Lead-Mails von dir sind aus (Lead-Motor) — der Lead bekommt keine Willkommens-Mail.";
    if (!(await justinFuehrt())) return "Die Gespräche führt gerade nicht du (Chefbüro › Rückholung) — der Lead bekommt keine Mail in deiner Stimme.";
    return `Deine Willkommens-Mail (js@, mit Terminlink) geht nach ${einst.ruheMin} Minuten Ruhe hinaus, wenn er bis dahin nicht gebucht hat.`;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// LEAD-MOTOR: Stand, Vorschau, Prüfversand
// ═══════════════════════════════════════════════════════════════════════════
export async function leadPostStand(lauf: Lauf = sqlPool): Promise<any> {
  await leadPostSchema(lauf);
  const einstellungen = await leadPostEinstellungen(lauf);
  const [z] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE willkommen_am > NOW() - INTERVAL '7 days')::int AS willkommen,
           COUNT(*) FILTER (WHERE nachfass_am > NOW() - INTERVAL '7 days')::int AS nachfass,
           COUNT(*) FILTER (WHERE antwort_am > NOW() - INTERVAL '7 days')::int AS antworten,
           COUNT(*) FILTER (WHERE stopp_am > NOW() - INTERVAL '7 days')::int AS stopps,
           COUNT(*) FILTER (WHERE willkommen_status = 'fehler')::int AS fehler,
           COUNT(*) FILTER (WHERE nachfass_faellig IS NOT NULL AND stopp_am IS NULL)::int AS offen
      FROM fiaon_lead_weg`.catch(() => [{}])) as any[];
  const letzte = (await lauf`
    SELECT w.anfrage_id, a.name, a.firma, w.willkommen_am, w.willkommen_status, w.willkommen_grund, w.nachfass_stufe, w.nachfass_faellig,
           w.stopp_grund, w.antwort_am, w.abgemeldet_am, w.updated_at
      FROM fiaon_lead_weg w JOIN fiaon_anfragen a ON a.id = w.anfrage_id
     WHERE w.willkommen_status IS NOT NULL
     ORDER BY w.updated_at DESC LIMIT 12`.catch(() => [])) as any[];
  return {
    einstellungen, zahlen: z ?? {}, justinFuehrt: await justinFuehrt(),
    letzte: letzte.map((r) => ({
      anfrageId: Number(r.anfrage_id), name: leadAnzeigeName(r.firma, r.name), willkommenAm: r.willkommen_am, willkommenStatus: r.willkommen_status,
      willkommenGrund: r.willkommen_grund, nachfassStufe: Number(r.nachfass_stufe) || 0, nachfassFaellig: r.nachfass_faellig,
      stopp: r.stopp_grund ? STOPP_TEXT[r.stopp_grund as LeadStoppGrund] ?? r.stopp_grund : null, antwortAm: r.antwort_am, abgemeldetAm: r.abgemeldet_am,
    })),
  };
}

/** Ein erfundener Musterlead für Vorschau und Prüfversand (Repo öffentlich: nur example.com). */
export function musterLage(sprache: LeadSprache, variante: "meta" | "website" | "bestandskunde" | "oesterreich" = "meta"): LeadLage {
  const jetzt = new Date();
  const antworten: LeadAntwort[] = variante === "website" ? [] : [
    { schluessel: "vorhaben", frage: "Was planen Sie mit Ihrer US-Gesellschaft?", antwort: "Beides", code: "vorhaben_3" },
    { schluessel: "kapitalrahmen_ziel", frage: "Welchen Kapitalrahmen planen Sie als Ziel?", antwort: "100.000 $ – 250.000 $", code: "kapitalrahmen_ziel_2" },
    { schluessel: "wann_starten", frage: "Wann möchten Sie starten?", antwort: "So bald wie möglich", code: "wann_starten_1" },
  ];
  return {
    anfrageId: 0, firmaId: null, name: "Max Mustermann", email: "max@muster-logistik.example", telefon: "+49 151 00000000",
    firmaRoh: "Muster Logistik GmbH", firmaBrauchbar: true, sprache, kanal: variante === "website" ? "website" : "meta", antworten,
    mitNachricht: variante === "website", paketName: null, eingangAm: new Date(jetzt.getTime() - 12 * 60_000), echterEingang: null, metaWeg: null,
    istTest: false, status: "neu", land: variante === "oesterreich" ? "AT" : "DE", oesterreich: variante === "oesterreich", bestandskunde: variante === "bestandskunde",
    ip: null, wunschzeit: null,
    weg: null,
    stopp: { privat: false, kunde: false, abgemeldet: false, unzustellbar: false, termin: false, antwort: false, vonHand: false, anrufErgebnis: null, firmaStatus: null, infoMail: false, angebot: false },
    zustaendig: { id: 0, name: "Daniel Beispiel", weiblich: false }, letzterAnruf: null, budget: { letzte24h: 0, gesamt: 0 },
  };
}

const MUSTER_LINK = { url: "https://fiaon.com/g/AbCdEfGh23", bis: new Date(Date.now() + 30 * 86_400_000) };

/** Vorschau einer Lead-Mail — zu einer echten Anfrage (nur lesen, kein Code angelegt) oder zum Musterlead. Sendet nie. */
export async function leadMailVorschau(ein: { anfrageId?: number | null; art: "willkommen" | "n1" | "n2" | "n3"; sprache?: LeadSprache; variante?: "meta" | "website" | "bestandskunde" | "oesterreich" }, lauf: Lauf = sqlPool): Promise<{ betreff: string; html: string; text: string; funde: string[] }> {
  const jetzt = new Date();
  let lage: LeadLage; let link: { url: string; bis?: Date | null } = MUSTER_LINK;
  if (ein.anfrageId) {
    const l = await leadLageLesen(ein.anfrageId, lauf);
    if (!l) throw new Error(`Anfrage #${ein.anfrageId} ist keine Global-Anfrage.`);
    lage = l;
    if (l.weg?.code) link = { url: `https://fiaon.com/g/${l.weg.code}`, bis: l.weg.codeBis };
  } else lage = musterLage(ein.sprache ?? "de", ein.variante ?? "meta");
  const m = ein.art === "willkommen" ? await willkommenFuer(lage, link, jetzt)
    : nachfassFuer(ein.art === "n1" ? 1 : ein.art === "n2" ? 2 : 3, { ...lage, weg: lage.weg ?? { ...leereWeg(), willkommenAm: new Date(jetzt.getTime() - 86_400_000) } }, link, jetzt);
  const absender = await gmail().absender().catch(() => null);
  const { radarKarteAbsender } = await import("./fiaon-radar");
  const sig = absender ?? (() => { const k = radarKarteAbsender(null); return { name: k.name, signaturHtml: k.signaturHtml, signaturText: k.signaturText }; })();
  return { betreff: m.betreff, html: await leadMailHtml(m, sig.signaturHtml), text: await leadMailText(m, sig.signaturText), funde: await leadMailPruefen(m) };
}

function leereWeg(): NonNullable<LeadLage["weg"]> {
  return {
    code: null, codeBis: null, willkommenAm: null, willkommenStatus: null, willkommenVersuche: 0, willkommenLaeuft: null, gmailFaden: null,
    gmailErsteId: null, nachfassStufe: 0, nachfassAm: null, nachfassFaellig: null, nachfassLaeuft: null, stoppAm: null, stoppGrund: null,
    abgemeldetAm: null, antwortAm: null,
  };
}

/**
 * Prüfversand: W (deutsch und englisch), N1, N2, N3 mit dem Musterlead aus js@ an `an` (eine fiaon.com-Adresse) — genau so,
 * wie der Lead sie bekommt (echte Unterschrift, Betreff mit „Prüfversand:“). Protokoll art = test. Nur auf Knopf.
 */
export async function leadMailsPruefversand(anRoh: string, wer: string): Promise<{ ok: boolean; gesendet: string[]; fehler: string[] }> {
  const an = String(anRoh || "").trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@fiaon\.com$/.test(an)) return { ok: false, gesendet: [], fehler: ["Prüfversand nur an eine fiaon.com-Adresse"] };
  if (!(await gmailBereit())) return { ok: false, gesendet: [], fehler: ["Gmail-Anbindung fehlt"] };
  const absender = await gmail().absender();
  if (!absender) return { ok: false, gesendet: [], fehler: ["Justins Unterschrift ist gerade nicht lesbar (Gmail)"] };
  const jetzt = new Date();
  const gesendet: string[] = []; const fehler: string[] = [];
  const faelle: { name: string; m: LeadMailText }[] = [
    { name: "W deutsch", m: await willkommenFuer(musterLage("de"), MUSTER_LINK, jetzt) },
    { name: "W englisch", m: await willkommenFuer(musterLage("en"), MUSTER_LINK, jetzt) },
    { name: "W Website", m: await willkommenFuer(musterLage("de", "website"), MUSTER_LINK, jetzt) },
    { name: "N1", m: nachfassFuer(1, { ...musterLage("de"), weg: { ...leereWeg(), willkommenAm: new Date(jetzt.getTime() - 86_400_000) } }, MUSTER_LINK, jetzt) },
    { name: "N2", m: nachfassFuer(2, { ...musterLage("de"), weg: { ...leereWeg(), willkommenAm: new Date(jetzt.getTime() - 3 * 86_400_000) } }, MUSTER_LINK, jetzt) },
    { name: "N3", m: nachfassFuer(3, { ...musterLage("de"), weg: { ...leereWeg(), willkommenAm: new Date(jetzt.getTime() - 9 * 86_400_000) } }, MUSTER_LINK, jetzt) },
  ];
  const { mailProtokoll } = await import("./fiaon-mail-log");
  for (const f of faelle) {
    const funde = await leadMailPruefen(f.m);
    if (funde.length) { fehler.push(`${f.name}: ${funde.join("; ")}`); continue; }
    try {
      const html = await leadMailHtml(f.m, absender.signaturHtml);
      const text = await leadMailText(f.m, absender.signaturText);
      const betreff = `Prüfversand: ${f.m.betreff.replace(/^Re:\s*/, "")} (${f.name})`;
      await gmail().senden(LEAD_POSTFACH, { vonName: absender.name, an, betreff, text, html });
      await mailProtokoll({ event: f.m.art === "willkommen" ? EV.willkommen : EV.nachfass, empfaenger: an, status: "versandt", ausgeloestVon: `Prüfversand Lead-Mails (${wer})`, payload: { versandweg: "google", art: f.m.art, betreff } }).catch(() => {});
      await sqlPool`UPDATE fiaon_mail_log SET art = 'test' WHERE id = (SELECT MAX(id) FROM fiaon_mail_log WHERE empfaenger = ${an} AND event = ${f.m.art === "willkommen" ? EV.willkommen : EV.nachfass})`.catch(() => {});
      gesendet.push(f.name);
    } catch (e) {
      fehler.push(`${f.name}: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
    }
  }
  return { ok: fehler.length === 0, gesendet, fehler };
}

export { ANRUF_ERGEBNIS_TEXT };
