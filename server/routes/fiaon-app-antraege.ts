// ═══════════════════════════════════════════════════════════════════════════
// /APP — ANTRÄGE, VOLLMACHT, FINGERUNTERSCHRIFT (Scheibe 5, 05.09.2026)
//
// Der Kunde ERKLÄRT, FIAON bereitet vor und übermittelt, ein MENSCH versendet
// und quittiert. Nichts hier versendet automatisch. Was diese Datei tut:
//
//   · Vorgang anlegen   — aus einem offenen Befund (fiaon_ansprueche) wird ein
//                         Vorgang mit Aktenzeichen und einem Schreiben in
//                         Ich-Form des Kunden (Vorlagen: ../lib/fiaon-schreiben)
//   · Unterschrift      — signierter Link ohne Anmeldung (Muster
//                         fiaon-zustimmung.ts), Fingerunterschrift als PNG,
//                         festgehalten mit Zeitpunkt, IP und Browserkennung
//   · Vollmacht         — „Vollmacht zur Übermittlung“, zwölf Monate, jederzeit
//                         widerruflich; nötig, bevor der erste Antrag hinausgeht
//   · Bescheid          — der Kunde fotografiert die Antwort der Stelle, ein
//                         Mensch prüft und trägt das Ergebnis ein
//   · Nachricht         — Anliegen mit Dringend-Kästchen (Post mit Frist)
//   · Mitarbeiter       — Versand quittieren, Ergebnis eintragen, Notiz für Kunden
//
// Alles hängt am MENSCHEN (person_id). Jeder Kundenendpunkt prüft, dass der
// Vorgang zur Person der angemeldeten Referenz gehört — sonst 404 mit Satz.
// Tabellen: db/migrations/081_app_vollmacht_vorgaenge.sql — dieselbe DDL unten
// in ensureAntraegeTabellen (idempotent). Berliner Datum nur über formatToParts.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { sqlPool } from "../lib/db-pool";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { bildAlsPdf, istBild, istHeic } from "../lib/fiaon-bild-zu-pdf";
import { personFuerRef, keinePerson, sauberName, berlinHeute, tag, werktageSpaeter, ensureAppTabellen, antraegeFreigeschaltet } from "./fiaon-app";
import { auftragFuerKunden, todoMeldung } from "./fiaon-betreiber-todo";
import { schreibenErzeugen, unterschriftHtml, unterschriftEinsetzen, schreibenAlsPdf, hashVon, fusszeileFuer, markenzeileFuer, datumPlusMonate, type SchreibenArt, type SchreibenDaten } from "../lib/fiaon-schreiben";
import { REGELN, type Antworten } from "@shared/fiaon-ansprueche";
import { pushBeiEreignis } from "../lib/fiaon-push";
import { wandPruefen, wandUrteil } from "@shared/fiaon-wortverbote";

const router = Router();

// ── Tabellen ────────────────────────────────────────────────────────────────
let tabellenBereit: Promise<void> | null = null;
export function ensureAntraegeTabellen(): Promise<void> {
  if (!tabellenBereit) {
    tabellenBereit = (async () => {
      await ensureAppTabellen();
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_vollmachten (
        id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, ref TEXT,
        template_version INTEGER NOT NULL DEFAULT 1, umfang JSONB NOT NULL DEFAULT '[]'::jsonb,
        rendered_html TEXT NOT NULL, signature_png TEXT, signature_name TEXT, signed_at TIMESTAMPTZ,
        ip TEXT, user_agent TEXT, doc_hash TEXT, pdf_dokument_id BIGINT,
        gueltig_bis DATE, widerrufen_am TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','unterschrieben','widerrufen','abgelaufen')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_vollmachten_person_idx ON fiaon_vollmachten (person_id, status)`;
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_vorgang_ereignisse (
        id BIGSERIAL PRIMARY KEY, vorgang_id BIGINT NOT NULL, person_id BIGINT NOT NULL,
        art TEXT NOT NULL CHECK (art IN ('befund','entwurf','vollmacht','unterschrift_offen','unterschrieben','versandt','erinnert','nachfrage','antwort_da','bewilligt','abgelehnt','zurueckgezogen','eskaliert','notiz')),
        text TEXT, text_fuer_kunden TEXT, agent_id BIGINT, am TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_vorgang_ereignisse_vorgang_idx ON fiaon_vorgang_ereignisse (vorgang_id, am)`;
    })().catch((e) => { tabellenBereit = null; throw e; });
  }
  return tabellenBereit;
}

// ── Feste Zuordnungen ───────────────────────────────────────────────────────
/** Regel (shared/fiaon-ansprueche.ts) → Vorgangsart (fiaon_vorgaenge.art). */
const REGEL_ZU_ART: Record<string, SchreibenArt> = {
  p_konto_erhoehung: "p_konto", p_konto_umwandlung: "p_konto_umwandlung", rundfunk_befreiung: "rundfunk",
  wohngeld_pruefung: "wohngeld", kfz_vergleich: "kfz", handy_vergleich: "handy",
};
const ANTRAGSARTEN: SchreibenArt[] = ["p_konto", "p_konto_umwandlung", "rundfunk", "wohngeld", "kfz", "handy"];

/** Titel je Vorgangsart, so wie der Kunde sie liest. */
const ART_TITEL: Record<string, string> = {
  brief: "Ihr Brief", p_konto: "Antrag: höherer Schutzbetrag (P-Konto)", p_konto_umwandlung: "Umwandlung in ein P-Konto",
  rundfunk: "Antrag: Befreiung vom Rundfunkbeitrag", selbstauskunft: "Selbstauskunft (Art. 15 DSGVO)", wohngeld: "Anschreiben Wohngeldstelle",
  kfz: "Kündigung Kfz-Versicherung", handy: "Kündigung Handyvertrag",
};

/** Umfang der Vollmacht — je Antragsart eine Zeile, die der Kunde an- oder abwählt. */
const UMFANG_OPTIONEN: { wert: string; text: string }[] = [
  { wert: "p_konto", text: "Antrag auf einen höheren Schutzbetrag auf dem P-Konto an Ihre Bank" },
  { wert: "p_konto_umwandlung", text: "Verlangen auf Umwandlung Ihres Girokontos in ein P-Konto an Ihre Bank" },
  { wert: "rundfunk", text: "Antrag auf Befreiung vom Rundfunkbeitrag an den Beitragsservice" },
  { wert: "wohngeld", text: "Anschreiben an Ihre Wohngeldstelle" },
  { wert: "kfz", text: "Kündigung Ihrer Kfz-Versicherung" },
  { wert: "handy", text: "Kündigung Ihres Handyvertrags" },
  { wert: "selbstauskunft", text: "Selbstauskunft nach Art. 15 DSGVO an Auskunfteien" },
];
const UMFANG_WERTE = new Set(UMFANG_OPTIONEN.map((o) => o.wert));

/** Zeitleiste: der Satz, den der Kunde je Ereignis liest, wenn kein eigener hinterlegt ist. */
const EREIGNIS_SATZ: Record<string, string> = {
  befund: "Befund aus Ihrem Anspruchs-Check", entwurf: "Entwurf vorbereitet", vollmacht: "Vollmacht erteilt",
  unterschrift_offen: "Wartet auf Ihre Unterschrift", unterschrieben: "Von Ihnen unterschrieben", versandt: "Versandt",
  erinnert: "Erinnerung an die Frist", nachfrage: "Nachgefragt", antwort_da: "Antwort eingegangen", bewilligt: "Bewilligt",
  abgelehnt: "Abgelehnt", zurueckgezogen: "Zurückgezogen auf Ihren Wunsch", eskaliert: "An die Leitung gegeben", notiz: "Vermerk für Sie",
};

const VOR_VERSAND = ["entwurf", "unterschrift_offen", "versandbereit"];
const KEIN_VORGANG = "Diesen Vorgang gibt es in Ihrer Akte nicht.";
const STOERUNG = "Dieser Vorgang lässt sich gerade nicht öffnen.";

// ── Zeit (Berlin, nur formatToParts) ────────────────────────────────────────
function berlinTeile(d: Date): { j: string; m: string; t: string; h: string; min: string } {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const w = (art: string) => teile.find((p) => p.type === art)?.value ?? "00";
  return { j: w("year"), m: w("month"), t: w("day"), h: w("hour") === "24" ? "00" : w("hour"), min: w("minute") };
}
/** „05.09.2026“ */
function heuteText(): string { const h = berlinHeute(); return `${String(h.t).padStart(2, "0")}.${String(h.m).padStart(2, "0")}.${h.j}`; }
/** „2026-09-05“ */
function heuteIso(): string { const h = berlinHeute(); return `${h.j}-${String(h.m).padStart(2, "0")}-${String(h.t).padStart(2, "0")}`; }
/** Kalendertage nach heute als YYYY-MM-DD. */
function tageSpaeter(n: number): string {
  const h = berlinHeute();
  const d = new Date(Date.UTC(h.j, h.m - 1, h.t + Math.max(0, Math.floor(n)), 12));
  return d.toISOString().slice(0, 10);
}
/**
 * Heute in zwölf Monaten als YYYY-MM-DD — dieselbe Rechnung wie im Vollmachttext
 * (datumPlusMonate: 29.02. → 28.02.), damit Dokument und Datenbank denselben
 * Tag nennen. Eine Quelle, kein zweiter Rechenweg.
 */
function zwoelfMonateSpaeter(): string {
  const d = datumPlusMonate(heuteText(), 12) ?? heuteText();
  return d.split(".").reverse().join("-");
}
/** „05.09.2026, 14:32“ — für die Zeitleiste und den Unterschriftblock. */
function zeitText(d: any): string | null {
  if (!d) return null;
  const x = new Date(d); if (Number.isNaN(x.getTime())) return null;
  const b = berlinTeile(x);
  return `${b.t}.${b.m}.${b.j}, ${b.h}:${b.min}`;
}

/**
 * Die Adresse des Anfragenden — sie steht als Beweismittel in fiaon_vollmachten.ip.
 * server/index.ts setzt `trust proxy 1`, damit liefert req.ip bereits die Adresse
 * hinter dem Render-Proxy. X-Forwarded-For nur als Rückfall, und dann der LETZTE
 * Eintrag: den hängt der Proxy an, den ersten schickt der Client selbst mit —
 * eine selbst gesetzte IP wäre als Nachweis wertlos.
 */
function absenderIp(req: Request): string | null {
  if (req.ip) return String(req.ip);
  const weiter = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
  return weiter.length ? weiter[weiter.length - 1] : (req.socket?.remoteAddress || null);
}

// ── Signierte Links (Muster fiaon-zustimmung.ts) ────────────────────────────
// HMAC-SHA256 über `${zweck}.${id}.${exp}`; Token `${id}.${exp}.${sig32}`. Der
// Zweck steht NICHT im Token — er steckt in der Signatur, deshalb kann ein
// Vollmacht-Token nie als Antrag-Token durchgehen. Einmaligkeit kommt aus dem
// ZUSTAND (Vollmacht aktiv / Vorgang nicht mehr unterschrift_offen), nicht aus
// einer Token-Liste. Ablauf 30 Tage.
export type TokenZweck = "vollmacht" | "antrag";
export const UNTERSCHRIFT_TAGE = 30;
const TOKEN_MS = UNTERSCHRIFT_TAGE * 24 * 60 * 60 * 1000;

function geheimnis(): string {
  // Wie fiaon-kunde-session.ts: ohne Geheimnis keine Signatur — lieber laut
  // scheitern als Unterschriftslinks mit einem öffentlich lesbaren Schlüssel.
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET fehlt — Unterschriftslinks können nicht signiert werden.");
  return s;
}
function signatur(zweck: TokenZweck, id: number, exp: number): string {
  return createHmac("sha256", geheimnis()).update(`${zweck}.${id}.${exp}`).digest("hex").slice(0, 32);
}
export function unterschriftTokenErzeugen(zweck: TokenZweck, id: number, ttlMs = TOKEN_MS): string {
  const exp = Date.now() + ttlMs;
  return `${id}.${exp}.${signatur(zweck, id, exp)}`;
}
/** Prüft ein Token gegen BEIDE Zwecke — genau einer kann passen. */
export function unterschriftTokenPruefen(token: unknown): { zweck: TokenZweck; id: number; exp: number; abgelaufen: boolean; ausgestelltAm: Date } | null {
  const teile = String(token ?? "").split(".");
  if (teile.length !== 3) return null;
  const id = Number(teile[0]); const exp = Number(teile[1]); const sig = teile[2];
  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(exp) || exp <= 0 || !/^[0-9a-f]{32}$/.test(sig)) return null;
  const zwecke: TokenZweck[] = ["vollmacht", "antrag"];
  for (let i = 0; i < zwecke.length; i++) {
    const a = Buffer.from(signatur(zwecke[i], id, exp)); const b = Buffer.from(sig);
    if (a.length === b.length && timingSafeEqual(a, b)) return { zweck: zwecke[i], id, exp, abgelaufen: exp < Date.now(), ausgestelltAm: new Date(exp - TOKEN_MS) };
  }
  return null;
}
const unterschriftPfad = (token: string) => `/app/unterschrift/${token}`;

// ── Der Mensch und seine Daten ──────────────────────────────────────────────
interface Kunde { personId: number; ref: string | null; vorname: string; nachname: string; name: string; daten: SchreibenDaten["kunde"] }

/** Person + jüngster Antrag: Name, Adresse, Geburtsdatum — für Schreiben und Aufträge. */
async function kundeLaden(personId: number): Promise<Kunde | null> {
  const [z] = (await sqlPool`
    SELECT p.first_name, p.last_name, p.company_name, p.street, p.zip, p.city, p.birthdate,
           a.ref, a.first_name AS a_vor, a.last_name AS a_nach, a.street AS a_str, a.zip AS a_zip, a.city AS a_ort, a.birthdate AS a_geb
      FROM fiaon_persons p
      LEFT JOIN LATERAL (SELECT ref, first_name, last_name, street, zip, city, birthdate FROM fiaon_applications
                          WHERE person_id = p.id AND merged_into IS NULL AND gdpr_deleted_at IS NULL
                          ORDER BY created_at DESC LIMIT 1) a ON TRUE
     WHERE p.id = ${personId} LIMIT 1`) as any[];
  if (!z) return null;
  const s = (a: unknown, b: unknown) => String(a ?? "").trim() || String(b ?? "").trim();
  const vorname = s(z.first_name, z.a_vor); const nachname = s(z.last_name, z.a_nach);
  const name = [vorname, nachname].filter(Boolean).join(" ") || String(z.company_name || "").trim() || (z.ref ? String(z.ref) : `Person ${personId}`);
  return {
    personId, ref: z.ref ? String(z.ref) : null, vorname, nachname, name,
    daten: { vorname, nachname, strasse: s(z.street, z.a_str), plz: s(z.zip, z.a_zip), ort: s(z.city, z.a_ort), geburtsdatum: s(z.birthdate, z.a_geb) || undefined },
  };
}

async function antwortenLaden(personId: number): Promise<Antworten> {
  const zeilen = (await sqlPool`SELECT frage_schluessel, wert FROM fiaon_anspruch_antworten WHERE person_id = ${personId}`) as any[];
  const a: Record<string, unknown> = {};
  for (let i = 0; i < zeilen.length; i++) a[zeilen[i].frage_schluessel] = zeilen[i].wert;
  return a as Antworten;
}

const aktenzeichenFuer = (id: number) => `AZ ${berlinHeute().j}-${String(id).padStart(6, "0")}`;

type Lauf = typeof sqlPool;
async function ereignis(vorgangId: number, personId: number, art: string, text: string | null, textFuerKunden: string | null = null, agentId: number | null = null, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`INSERT INTO fiaon_vorgang_ereignisse (vorgang_id, person_id, art, text, text_fuer_kunden, agent_id)
             VALUES (${vorgangId}, ${personId}, ${art}, ${text}, ${textFuerKunden}, ${agentId})`;
}

/** Einen Mitarbeiter-Auftrag schließen, der durch einen Zustandswechsel gegenstandslos wurde — nichts löschen, nur „erledigt“ mit Grund. */
async function auftragSchliessen(schluessel: string, ergebnis: string): Promise<void> {
  await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = COALESCE(erledigt_am, NOW()), ergebnis = COALESCE(ergebnis, ${ergebnis}), updated_at = NOW()
                 WHERE schluessel = ${schluessel} AND status <> 'erledigt'`.catch(() => {});
}
/** Alle Aufträge, die zu einem Vorgang gehören können — Bescheid, Fristenwächter, Versand. */
const AUFTRAG_SCHLUESSEL = (id: number) => [`app-bescheid:${id}`, `frist7:${id}`, `nachfass:${id}`, `eskalation:${id}`, `app-antrag-versand:${id}`, `app-ablehnung:${id}`];

// ── Vollmacht: Lage ─────────────────────────────────────────────────────────
interface VollmachtZeile { id: number; umfang: string[]; gueltig_bis: any; signed_at: any; widerrufen_am: any; status: string; created_at: any }

/** Die aktive Vollmacht (unterschrieben, nicht widerrufen, nicht abgelaufen) — oder null. */
async function vollmachtAktiv(personId: number): Promise<VollmachtZeile | null> {
  const [v] = (await sqlPool`
    SELECT id, umfang, gueltig_bis, signed_at, widerrufen_am, status, created_at FROM fiaon_vollmachten
     WHERE person_id = ${personId} AND status = 'unterschrieben' AND widerrufen_am IS NULL AND gueltig_bis >= ${heuteIso()}::date
     ORDER BY signed_at DESC LIMIT 1`) as any[];
  if (!v) return null;
  return vollmachtZeile(v);
}
function vollmachtZeile(v: any): VollmachtZeile {
  return { id: Number(v.id), umfang: Array.isArray(v.umfang) ? v.umfang.map(String) : [], gueltig_bis: v.gueltig_bis, signed_at: v.signed_at, widerrufen_am: v.widerrufen_am, status: v.status, created_at: v.created_at };
}
/**
 * Ein Vollmacht-Link ist nur so lange gültig, wie sich an den Vollmachten der
 * Person seit seiner Ausstellung nichts geändert hat: Jede neue Zeile und jeder
 * Widerruf danach entwertet ältere Links (geteiltes Gerät, weitergeleitete Mail).
 */
async function vollmachtSeit(personId: number, seit: Date): Promise<{ neu: boolean; widerrufen: boolean }> {
  const [r] = (await sqlPool`
    SELECT bool_or(created_at > ${seit}) AS neu, bool_or(widerrufen_am IS NOT NULL AND widerrufen_am > ${seit}) AS widerrufen
      FROM fiaon_vollmachten WHERE person_id = ${personId}`) as any[];
  return { neu: !!r?.neu, widerrufen: !!r?.widerrufen };
}
/** Deckt die aktive Vollmacht diese Antragsart? Eine Vollmacht ohne die Zeile deckt sie nicht. */
async function vollmachtDeckt(personId: number, art: string): Promise<boolean> {
  const v = await vollmachtAktiv(personId);
  return !!v && v.umfang.indexOf(art) !== -1;
}
/** Die jüngste Vollmacht überhaupt (auch widerrufen/abgelaufen) — für die Seite unter Mehr › Vollmachten. */
async function vollmachtLetzte(personId: number): Promise<VollmachtZeile | null> {
  const [v] = (await sqlPool`SELECT id, umfang, gueltig_bis, signed_at, widerrufen_am, status, created_at FROM fiaon_vollmachten WHERE person_id = ${personId} ORDER BY created_at DESC LIMIT 1`) as any[];
  return v ? vollmachtZeile(v) : null;
}

/**
 * Der Weg zur Unterschrift für einen Vorgang: erst die Vollmacht (wenn sie fehlt
 * oder die Art nicht deckt), dann der Antrag. Der Client zeigt „1 von 2“.
 */
async function unterschriftWeg(personId: number, vorgangId: number, art: string): Promise<{ vollmachtNoetig: boolean; url: string }> {
  const noetig = !(await vollmachtDeckt(personId, art));
  const token = noetig ? unterschriftTokenErzeugen("vollmacht", personId) : unterschriftTokenErzeugen("antrag", vorgangId);
  return { vollmachtNoetig: noetig, url: unterschriftPfad(token) };
}

// ── Schreiben rendern ───────────────────────────────────────────────────────
async function vorgangLaden(id: number, personId: number): Promise<any | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [v] = (await sqlPool`
    SELECT v.*, an.regel_schluessel, an.betrag_cents, an.monatlich, an.stand AS anspruch_stand
      FROM fiaon_vorgaenge v LEFT JOIN fiaon_ansprueche an ON an.id = v.anspruch_id
     WHERE v.id = ${id} AND v.person_id = ${personId} LIMIT 1`) as any[];
  return v ?? null;
}

function schreibenDaten(k: Kunde, aktenzeichen: string, extra: Partial<SchreibenDaten> = {}): SchreibenDaten {
  return { kunde: k.daten, aktenzeichen, datum: heuteText(), ...extra };
}

/** Das Schreiben eines Vorgangs neu rendern (reine Vorlage — für Hinweistext und Empfänger). */
async function schreibenFuerVorgang(v: any, k: Kunde) {
  const antworten = await antwortenLaden(k.personId);
  return schreibenErzeugen(v.art as SchreibenArt, schreibenDaten(k, String(v.aktenzeichen || aktenzeichenFuer(Number(v.id))), {
    antworten, betragCents: v.betrag_cents == null ? null : Number(v.betrag_cents),
    empfaenger: v.empfaenger_name ? { name: String(v.empfaenger_name), adresse: v.empfaenger_adresse ? String(v.empfaenger_adresse) : undefined } : undefined,
  }));
}

/** Das gespeicherte Schreiben (HTML) eines Vorgangs. */
async function schreibenHtmlLaden(vorgangId: number): Promise<string | null> {
  const [d] = (await sqlPool`SELECT inhalt FROM fiaon_dokumente WHERE vorgang_id = ${vorgangId} AND art = 'schreiben_html' AND geloescht_am IS NULL ORDER BY hochgeladen_am DESC LIMIT 1`) as any[];
  return d?.inhalt ? Buffer.from(d.inhalt).toString("utf8") : null;
}

const eurText = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

/**
 * Der Standsatz in Klartext (Bauvorlage 3.6) — jede Zahl darin kommt aus einem
 * Datenfeld, jede Zusage hat eine Datenbedingung: „nachgefragt“ steht erst, wenn
 * ein Mitarbeiter die Nachfrage quittiert hat (nachgefragtAm); bei bewilligt/
 * abgelehnt kommt der Satz des Mitarbeiters (stand_text) mit.
 */
function standSatz(v: any, letztesErgebnisAm: string | null, nachgefragtAm: string | null = null): string {
  const emp = v.empfaenger_name ? String(v.empfaenger_name) : "die zuständige Stelle";
  const eigener = String(v.stand_text || "").trim();
  switch (String(v.stand)) {
    case "entwurf": return "Wird vorbereitet.";
    case "unterschrift_offen": return "Wartet auf Ihre Unterschrift.";
    case "versandbereit": return "Unterschrieben – ein Mitarbeiter versendet und bestätigt den Versand hier.";
    case "versandt": return `Versandt am ${tag(v.versandt_am) ?? "–"} an ${emp}.${v.frist_am ? ` Antwort erwartet bis ${tag(v.frist_am)}.` : ""}`;
    case "nachfrage": return nachgefragtAm
      ? `Keine Antwort bis ${tag(v.frist_am) ?? "–"}. Wir haben am ${nachgefragtAm} nachgefragt. Sie müssen nichts tun.`
      : `Keine Antwort bis ${tag(v.frist_am) ?? "–"}. Die Nachfrage ist in Arbeit.`;
    case "bewilligt": return `Bewilligt${letztesErgebnisAm ? ` am ${letztesErgebnisAm}` : ""}${v.betrag_cents != null ? `: ${eurText(Number(v.betrag_cents))} ${v.monatlich === false ? "einmalig" : "im Monat"}` : ""}.${eigener ? ` ${eigener}` : ""}`;
    case "abgelehnt": return `Abgelehnt${letztesErgebnisAm ? ` am ${letztesErgebnisAm}` : ""}. ${eigener || "Was das heißt, steht in der Notiz Ihrer Ansprechperson im Verlauf."}`;
    case "zurueckgezogen": return "Zurückgezogen auf Ihren Wunsch.";
    case "eingegangen": return `Eingegangen am ${zeitText(v.created_at) ?? "–"} Uhr. Noch nicht gelesen.`;
    case "gelesen": return `Gelesen am ${tag(v.updated_at) ?? "–"}.`;
    case "erledigt": return `Erledigt am ${tag(v.updated_at) ?? "–"}.`;
    default: return String(v.stand_text || v.stand);
  }
}

const fehler = (res: Response, code: number, satz: string) => res.status(code).json({ ok: false, error: satz });

// ═══════════════════════════════════════════════════════════════════════════
// KUNDE — Basis /kunde/:ref/app
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /kunde/:ref/app/vorgaenge { regelSchluessel }
 * Aus einem offenen Befund wird ein Vorgang: Aktenzeichen, Schreiben in Ich-Form
 * (HTML in der Akte), Stand unterschrift_offen, Anspruch → beantragt. Zurück
 * kommt der Weg zur Unterschrift — erst Vollmacht, wenn sie fehlt.
 */
router.post("/kunde/:ref/app/vorgaenge", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    if (!(await antraegeFreigeschaltet())) return res.status(403).json({ ok: false, grund: "antraege_aus", error: "Die Unterschrift in der App und die Anträge aus Ihrem Bereich schalten wir gerade frei. Bis dahin bereitet Ihre Ansprechperson Anträge mit Ihnen im Gespräch vor." });
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const regelSchluessel = String(req.body?.regelSchluessel ?? "").trim();
    const art = REGEL_ZU_ART[regelSchluessel];
    const regel = REGELN.find((r) => r.schluessel === regelSchluessel && r.aktiv);
    if (!art || !regel) return fehler(res, 400, "Diesen Antrag kennen wir nicht. Bitte wählen Sie einen Punkt aus Ihrer Liste.");
    const [an] = (await sqlPool`SELECT id, stand, betrag_cents, monatlich, begruendung, vorgang_id FROM fiaon_ansprueche WHERE person_id = ${p.personId} AND regel_schluessel = ${regelSchluessel} LIMIT 1`) as any[];
    if (!an) return fehler(res, 404, "Dieser Punkt steht nicht auf Ihrer Liste. Bitte beantworten Sie zuerst die Fragen im Anspruchs-Check.");
    if (String(an.stand) !== "offen") {
      if (an.vorgang_id) {
        const alt = await vorgangLaden(Number(an.vorgang_id), p.personId);
        if (alt && String(alt.stand) === "unterschrift_offen") {
          const weg = await unterschriftWeg(p.personId, Number(alt.id), String(alt.art));
          return res.json({ ok: true, vorgangId: Number(alt.id), aktenzeichen: alt.aktenzeichen, vollmachtNoetig: weg.vollmachtNoetig, unterschriftUrl: weg.url, bereitsAngelegt: true });
        }
      }
      if (String(an.stand) === "verworfen" || String(an.stand) === "nicht_zutreffend") return fehler(res, 409, "Diesen Punkt haben Sie zurückgestellt. Öffnen Sie ihn zuerst wieder im Anspruchs-Check.");
      return fehler(res, 409, "Dieser Antrag ist schon angelegt. Sie finden ihn unter Vorgänge.");
    }
    const k = await kundeLaden(p.personId);
    if (!k) return keinePerson(res);
    if (!k.daten.strasse || !k.daten.plz || !k.daten.ort) return fehler(res, 409, "Für das Schreiben fehlt Ihre Anschrift. Bitte ergänzen Sie sie unter Mehr › Meine Daten.");

    // Den Anspruch ZUERST beanspruchen — nur aus 'offen' heraus. Zwei schnelle
    // Klicks lesen beide 'offen', aber nur einer gewinnt diese Zeile; der andere
    // bekommt 409 statt eines zweiten Vorgangs mit zweitem Unterschriftslink.
    const [claim] = (await sqlPool`UPDATE fiaon_ansprueche SET stand = 'beantragt', aktualisiert_am = NOW()
                                    WHERE id = ${Number(an.id)} AND person_id = ${p.personId} AND stand = 'offen' RETURNING id`) as any[];
    if (!claim) return fehler(res, 409, "Dieser Antrag ist schon angelegt. Sie finden ihn unter Vorgänge.");

    const antworten = await antwortenLaden(p.personId);
    let angelegt: { vorgangId: number; aktenzeichen: string } | null = null;
    try {
      // Vorgang, Schreiben, Ereignisse und die Verknüpfung zum Anspruch in EINER
      // Transaktion: Bricht das Rendern oder ein INSERT ab, bleibt kein Vorgang
      // in 'entwurf' ohne Aktenzeichen zurück.
      angelegt = await sqlPool.begin(async (tx) => {
        const lauf = tx as unknown as Lauf;
        const [v] = (await lauf`
          INSERT INTO fiaon_vorgaenge (person_id, art, titel, anspruch_id, stand, stand_text)
          VALUES (${p.personId}, ${art}, ${regel.titel}, ${Number(an.id)}, 'entwurf', 'Wird vorbereitet.')
          RETURNING id`) as any[];
        const vorgangId = Number(v.id);
        const aktenzeichen = aktenzeichenFuer(vorgangId);
        const schreiben = schreibenErzeugen(art, schreibenDaten(k, aktenzeichen, { antworten, betragCents: an.betrag_cents == null ? null : Number(an.betrag_cents) }));
        await lauf`INSERT INTO fiaon_dokumente (person_id, ref, vorgang_id, art, dateiname, mime, bytes, inhalt, quelle, aktenzeichen, doc_hash)
                   VALUES (${p.personId}, ${req.kundeRef!}, ${vorgangId}, 'schreiben_html', ${`Schreiben_${aktenzeichen.replace(/[^0-9A-Za-z-]/g, "_")}.html`}, 'text/html',
                           ${Buffer.byteLength(schreiben.html, "utf8")}, ${Buffer.from(schreiben.html, "utf8")}, 'erzeugt', ${aktenzeichen}, ${hashVon(schreiben.html)})`;
        await lauf`UPDATE fiaon_vorgaenge SET aktenzeichen = ${aktenzeichen}, empfaenger_name = ${schreiben.empfaengerName}, empfaenger_adresse = ${schreiben.empfaengerAdresse},
                          stand = 'unterschrift_offen', stand_text = 'Wartet auf Ihre Unterschrift.', updated_at = NOW() WHERE id = ${vorgangId}`;
        await ereignis(vorgangId, p.personId, "befund", `Befund ${regelSchluessel}: ${String(an.begruendung || "").slice(0, 500)}`, an.begruendung ? String(an.begruendung) : null, null, lauf);
        await ereignis(vorgangId, p.personId, "entwurf", `Schreiben „${schreiben.titel}“ an ${schreiben.empfaengerName} erzeugt.`, null, null, lauf);
        await ereignis(vorgangId, p.personId, "unterschrift_offen", "Unterschriftslink ausgestellt.", null, null, lauf);
        await lauf`UPDATE fiaon_ansprueche SET vorgang_id = ${vorgangId}, aktualisiert_am = NOW() WHERE id = ${Number(an.id)} AND person_id = ${p.personId}`;
        return { vorgangId, aktenzeichen };
      }) as { vorgangId: number; aktenzeichen: string };
    } catch (e) {
      // Reservierung zurückgeben — sonst stünde der Punkt als „beantragt“ ohne Vorgang.
      await sqlPool`UPDATE fiaon_ansprueche SET stand = 'offen', vorgang_id = NULL, aktualisiert_am = NOW()
                     WHERE id = ${Number(an.id)} AND person_id = ${p.personId} AND stand = 'beantragt' AND vorgang_id IS NULL`.catch(() => {});
      throw e;
    }

    const weg = await unterschriftWeg(p.personId, angelegt.vorgangId, art);
    res.json({ ok: true, vorgangId: angelegt.vorgangId, aktenzeichen: angelegt.aktenzeichen, vollmachtNoetig: weg.vollmachtNoetig, unterschriftUrl: weg.url });
  } catch (e: any) {
    console.error("[APP] vorgang anlegen:", e?.message || e);
    fehler(res, 500, "Der Antrag konnte gerade nicht vorbereitet werden. Bitte versuchen Sie es in einem Moment noch einmal.");
  }
});

/** GET /kunde/:ref/app/vorgaenge/:id — ein Vorgang mit Stand, Schreiben, Dokumenten, Zeitleiste (nur eigene Person). */
router.get("/kunde/:ref/app/vorgaenge/:id", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const v = await vorgangLaden(Number(req.params.id), p.personId);
    if (!v) return fehler(res, 404, KEIN_VORGANG);
    const id = Number(v.id);
    const ereignisse = (await sqlPool`SELECT art, text_fuer_kunden, am, agent_id FROM fiaon_vorgang_ereignisse WHERE vorgang_id = ${id} AND person_id = ${p.personId} ORDER BY am ASC, id ASC`) as any[];
    const dokumente = (await sqlPool`SELECT id, art, dateiname, hochgeladen_am FROM fiaon_dokumente WHERE vorgang_id = ${id} AND person_id = ${p.personId} AND geloescht_am IS NULL AND art <> 'schreiben_html' ORDER BY hochgeladen_am ASC`) as any[];
    const k = await kundeLaden(p.personId);
    const regel = v.regel_schluessel ? REGELN.find((r) => r.schluessel === v.regel_schluessel) : null;
    let hinweisFuerKunden: string | null = null;
    let schreibenHtml: string | null = null;
    if (v.art !== "brief") {
      schreibenHtml = await schreibenHtmlLaden(id);
      if (k) { try { hinweisFuerKunden = (await schreibenFuerVorgang(v, k)).hinweisFuerKunden ?? null; } catch (e: any) { console.error("[APP] hinweis:", e?.message || e); } }
    }
    const ergebnis = ereignisse.filter((e) => e.art === "bewilligt" || e.art === "abgelehnt").pop();
    // „Nachgefragt“ zählt erst, wenn ein MENSCH es quittiert hat (agent_id gesetzt) — der Wächter legt nur den Auftrag an.
    const nachgefragt = ereignisse.filter((e) => e.art === "nachfrage" && e.agent_id != null).pop();
    const nachgefragtAm = nachgefragt ? tag(nachgefragt.am) : null;
    const unterschriftUrl = String(v.stand) === "unterschrift_offen" ? (await unterschriftWeg(p.personId, id, String(v.art))).url : null;
    res.json({
      ok: true,
      vorgang: {
        id, art: v.art, artTitel: ART_TITEL[v.art] ?? v.art, titel: v.titel, stand: v.stand, standSatz: standSatz(v, ergebnis ? tag(ergebnis.am) : null, nachgefragtAm),
        aktenzeichen: v.aktenzeichen ?? null, empfaenger: v.empfaenger_name ?? null, empfaengerAdresse: v.empfaenger_adresse ?? null,
        eingegangenAm: tag(v.created_at), versandtAm: tag(v.versandt_am), fristAm: tag(v.frist_am), erinnertAm: tag(v.erinnert_am), nachgefragtAm,
        betragCents: v.betrag_cents == null ? null : Number(v.betrag_cents), monatlich: v.monatlich == null ? null : !!v.monatlich,
        regel: regel ? { titel: regel.titel, rechtsgrundlage: regel.rechtsgrundlage, geprueftAm: tag(regel.geprueftAm), stelle: regel.stelle, wasWirTun: regel.wasWirTun } : null,
        hinweisFuerKunden, schreibenHtml, unterschriftUrl,
        zurueckziehbar: VOR_VERSAND.indexOf(String(v.stand)) !== -1,
        dokumente: dokumente.map((d) => ({ id: Number(d.id), art: d.art, dateiname: d.dateiname, am: tag(d.hochgeladen_am) })),
        zeitleiste: ereignisse.map((e) => ({ art: e.art, am: zeitText(e.am), text: e.text_fuer_kunden || EREIGNIS_SATZ[e.art] || e.art })),
      },
    });
  } catch (e: any) {
    console.error("[APP] vorgang laden:", e?.message || e);
    fehler(res, 500, STOERUNG);
  }
});

// ── Bescheid fotografieren ──────────────────────────────────────────────────
const bescheidUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 10, fields: 5 },
  fileFilter: (_req, file, cb) => {
    const art = String(file.mimetype || "").toLowerCase();
    if (art === "application/pdf" || istBild(art)) cb(null, true);
    else if (istHeic(art)) cb(new Error("Dieses Foto liegt im iPhone-Format HEIC vor. Bitte stellen Sie in den iPhone-Einstellungen unter Kamera → Formate auf „Maximale Kompatibilität“ und fotografieren Sie den Bescheid noch einmal."));
    else cb(new Error("Wir können Fotos (JPG, PNG) und PDF-Dateien lesen. Bitte fotografieren Sie den Bescheid mit der Kamera."));
  },
});

const NUR_FOTO_PDF = "Wir können Fotos (JPG, PNG) und PDF-Dateien lesen. Bitte fotografieren Sie den Bescheid mit der Kamera.";
/**
 * Passen die ersten Bytes zum gemeldeten Typ? Der Client-MIME-Typ ist nur eine
 * Behauptung — eine Fremddatei mit dem Etikett „application/pdf“ würde sonst als
 * PDF gespeichert und dem Mitarbeiter genau so ausgeliefert.
 */
function dateiKopfPasst(mime: string, b: Buffer): boolean {
  if (!b || b.length < 8) return false;
  const art = String(mime || "").toLowerCase();
  if (art === "application/pdf") return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d; // %PDF-
  if (art === "image/jpeg" || art === "image/jpg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (art === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (art === "image/webp") return b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

/**
 * POST /kunde/:ref/app/vorgaenge/:id/bescheid (multipart: bescheid=Seiten, bis 10)
 * Die Antwort der Stelle kommt per Post zum Kunden — das Foto schließt den Kreis.
 * Der Stand bleibt; das Ergebnis trägt ein Mensch ein (POST /agent/…/ergebnis).
 */
router.post("/kunde/:ref/app/vorgaenge/:id/bescheid", requireKunde, (req, res, next) => {
  bescheidUpload.array("bescheid", 10)(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") return fehler(res, 400, "Das Foto ist größer als 12 MB. Bitte fotografieren Sie den Bescheid mit geringerer Auflösung noch einmal.");
      if (err.code === "LIMIT_FILE_COUNT") return fehler(res, 400, "Mehr als zehn Seiten gehen in einem Schritt nicht. Senden Sie diese ab und fotografieren Sie den Rest danach.");
      // Alle übrigen Multer-Grenzen (falsches Feld, zu viele Felder …) haben englische Meldungen — die liest kein Kunde.
      if (err.code && String(err.code).startsWith("LIMIT_")) return fehler(res, 400, "Die Datei konnte nicht angenommen werden. Bitte versuchen Sie es noch einmal.");
      return fehler(res, 400, err.message || "Die Datei konnte nicht angenommen werden.");
    }
    next();
  });
}, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const v = await vorgangLaden(Number(req.params.id), p.personId);
    if (!v) return fehler(res, 404, KEIN_VORGANG);
    if (VOR_VERSAND.indexOf(String(v.stand)) !== -1 || String(v.stand) === "zurueckgezogen") return fehler(res, 409, "Zu diesem Vorgang ist noch nichts versandt – eine Antwort der Stelle kann daher noch nicht vorliegen.");
    const seiten = ((req as any).files as Express.Multer.File[] | undefined) ?? [];
    if (!seiten.length || !seiten[0]?.buffer?.length) return fehler(res, 400, "Es ist kein Foto angekommen. Bitte versuchen Sie es noch einmal.");
    for (let i = 0; i < seiten.length; i++) if (!dateiKopfPasst(seiten[i].mimetype, seiten[i].buffer)) return fehler(res, 400, NUR_FOTO_PDF);
    const id = Number(v.id);
    const az = String(v.aktenzeichen || aktenzeichenFuer(id));
    const datum = heuteText();
    const dokIds: number[] = [];
    for (let i = 0; i < seiten.length; i++) {
      const f = seiten[i];
      let pdf: Buffer;
      try { pdf = istBild(f.mimetype) ? await bildAlsPdf(f.buffer, sauberName(f.originalname, `bescheid-${i + 1}.jpg`)) : f.buffer; }
      catch (e: any) { console.error("[APP] bescheid bildAlsPdf:", e?.message || e); return fehler(res, 400, NUR_FOTO_PDF); }
      const hash = createHash("sha256").update(pdf).digest("hex");
      const [d] = (await sqlPool`
        INSERT INTO fiaon_dokumente (person_id, ref, vorgang_id, art, dateiname, mime, bytes, inhalt, quelle, aktenzeichen, doc_hash)
        VALUES (${p.personId}, ${req.kundeRef!}, ${id}, 'bescheid', ${`Bescheid_${datum.replace(/\./g, "-")}_Seite${i + 1}.pdf`}, 'application/pdf', ${pdf.length}, ${pdf}, 'eingegangen', ${az}, ${hash})
        RETURNING id`) as any[];
      dokIds.push(Number(d.id));
    }
    await ereignis(id, p.personId, "antwort_da", `Kunde hat die Antwort fotografiert (${seiten.length} ${seiten.length === 1 ? "Seite" : "Seiten"}, Dokumente #${dokIds.join(", #")}).`, "Ihre Antwort der Stelle liegt in der Akte.");
    await sqlPool`UPDATE fiaon_vorgaenge SET updated_at = NOW() WHERE id = ${id}`;
    const frist = werktageSpaeter(2);
    let anWen: string | null = null;
    let auftragDa = false;
    try {
      const erg = await auftragFuerKunden({
        personId: p.personId, ref: req.kundeRef!, agentId: v.zustaendig_agent_id ? Number(v.zustaendig_agent_id) : null,
        titel: `${p.name}: Bescheid prüfen (${az})`,
        text: `Der Kunde hat die Antwort der Stelle zu „${String(v.titel)}“ fotografiert (${az}, Vorgang #${id}, ${seiten.length} ${seiten.length === 1 ? "Seite" : "Seiten"}, Dokumente #${dokIds.join(", #")}). Bitte lesen und das Ergebnis im Vorgang eintragen (bewilligt oder abgelehnt, mit Betrag und einem Satz für den Kunden). Frist: zwei Werktage (${frist}).`,
        faelligAm: frist, schluessel: `app-bescheid:${id}`, quelle: "kundenbereich", bereich: "pruefen",
        // 06.09.2026: Link auf die Vorgangsseite des Teams (/admin ist für Mitarbeiter zu).
        link: `/agent/app-vorgaenge/${id}`, autorName: "Kundenbereich",
      });
      anWen = erg.kundenName ?? erg.agentName ?? null;
      auftragDa = true;
      if (erg.agentId && !v.zustaendig_agent_id) await sqlPool`UPDATE fiaon_vorgaenge SET zustaendig_agent_id = ${erg.agentId} WHERE id = ${id}`;
    } catch (e: any) {
      console.error("[APP] Auftrag Bescheid:", e?.message || e);
      // Kein Bescheid darf liegen bleiben: Meldung an die Leitung, wenn der Auftrag nicht angelegt werden konnte.
      await todoMeldung(`app-bescheid-ohne-auftrag:${id}`, {
        titel: `${p.name}: Bescheid liegt ohne Auftrag in der Akte (${az})`,
        text: `Der Kunde hat einen Bescheid fotografiert (Vorgang #${id}, Dokumente #${dokIds.join(", #")}), aber der Auftrag an den Betreuer konnte nicht angelegt werden. Bitte lesen und das Ergebnis im Vorgang eintragen.`,
        bereich: "pruefen", link: `/agent/app-vorgaenge/${id}`,
      }, { name: "Kundenbereich", agentId: null }).catch(() => {});
    }
    // Der Satz verspricht nur, was ein Auftrag trägt: ohne Auftrag keine Person, kein „prüft“.
    const text = auftragDa
      ? `Danke. Ihr Bescheid liegt in der Akte – ${anWen ?? "Ihre Ansprechperson"} liest ihn und trägt das Ergebnis hier ein.`
      : "Danke. Ihr Bescheid liegt in der Akte. Das Ergebnis trägt Ihre Ansprechperson hier ein.";
    res.json({ ok: true, vorgangId: id, dokumentIds: dokIds, seiten: seiten.length, text });
  } catch (e: any) {
    console.error("[APP] bescheid:", e?.message || e);
    fehler(res, 500, "Der Bescheid konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal.");
  }
});

/** POST /kunde/:ref/app/vorgaenge/:id/zurueckziehen — nur vor dem Versand. */
router.post("/kunde/:ref/app/vorgaenge/:id/zurueckziehen", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const v = await vorgangLaden(Number(req.params.id), p.personId);
    if (!v) return fehler(res, 404, KEIN_VORGANG);
    if (VOR_VERSAND.indexOf(String(v.stand)) === -1) return fehler(res, 409, "Dieser Antrag ist schon versandt und lässt sich hier nicht mehr zurückziehen. Schreiben Sie Ihrer Ansprechperson eine Nachricht.");
    const id = Number(v.id);
    const az = String(v.aktenzeichen || aktenzeichenFuer(id));
    const warVersandbereit = String(v.stand) === "versandbereit";
    const [geaendert] = (await sqlPool`UPDATE fiaon_vorgaenge SET stand = 'zurueckgezogen', stand_text = 'Zurückgezogen auf Ihren Wunsch.', updated_at = NOW()
                                        WHERE id = ${id} AND stand IN ('entwurf','unterschrift_offen','versandbereit') RETURNING id`) as any[];
    if (!geaendert) return fehler(res, 409, "Dieser Antrag ist schon versandt und lässt sich hier nicht mehr zurückziehen. Schreiben Sie Ihrer Ansprechperson eine Nachricht.");
    // Der Anspruch wird nur dann wieder „offen“, wenn er auf DIESEN Vorgang zeigt — ein anderer aktiver Vorgang darf nicht abgehängt werden.
    if (v.anspruch_id) await sqlPool`UPDATE fiaon_ansprueche SET stand = 'offen', vorgang_id = NULL, aktualisiert_am = NOW()
                                       WHERE id = ${Number(v.anspruch_id)} AND person_id = ${p.personId} AND (vorgang_id = ${id} OR vorgang_id IS NULL)`;
    await ereignis(id, p.personId, "zurueckgezogen", "Vom Kunden im Bereich zurückgezogen.", "Zurückgezogen auf Ihren Wunsch.");
    if (warVersandbereit) {
      // Beim Betreuer liegt der offene Auftrag „versenden und quittieren“ — der muss zu, und zwar sichtbar, bevor ein Brief in den Umschlag kommt.
      await auftragSchliessen(`app-antrag-versand:${id}`, "Vom Kunden zurückgezogen – NICHT versenden.");
      try {
        await auftragFuerKunden({
          personId: p.personId, ref: req.kundeRef!, agentId: v.zustaendig_agent_id ? Number(v.zustaendig_agent_id) : null, dringend: true, faelligAm: heuteIso(),
          titel: `${p.name}: NICHT versenden – Antrag zurückgezogen (${az})`,
          text: `Der Kunde hat den unterschriebenen Antrag „${String(v.titel)}“ (${az}, Vorgang #${id}) im Kundenbereich zurückgezogen, BEVOR er versandt wurde. Der Auftrag „Antrag versenden und quittieren“ ist geschlossen. Bitte nichts mehr versenden; falls der Brief schon im Umschlag ist, herausnehmen. Die Dokumente bleiben in der Akte.`,
          schluessel: `app-antrag-stopp:${id}`, quelle: "kundenbereich", bereich: "pruefen", link: `/agent/app-vorgaenge/${id}`, autorName: "Kundenbereich",
        });
      } catch (e: any) { console.error("[APP] Stopp-Auftrag:", e?.message || e); }
    }
    res.json({ ok: true, stand: "zurueckgezogen", text: "Der Antrag ist zurückgezogen. Der Punkt steht wieder offen auf Ihrer Liste." });
  } catch (e: any) {
    console.error("[APP] zurueckziehen:", e?.message || e);
    fehler(res, 500, STOERUNG);
  }
});

// ── Vollmacht (Mehr › Vollmachten) ──────────────────────────────────────────
function vollmachtAntwort(v: VollmachtZeile | null, aktiv: boolean, unterschriftUrl: string | null) {
  return {
    ok: true, aktiv,
    gueltigBis: v ? tag(v.gueltig_bis) : null,
    umfang: v ? v.umfang.map((w) => UMFANG_OPTIONEN.find((o) => o.wert === w)?.text ?? w) : [],
    umfangWerte: v ? v.umfang : [],
    unterschriebenAm: v ? zeitText(v.signed_at) : null,
    widerrufenAm: v ? zeitText(v.widerrufen_am) : null,
    // „abgelaufen“ wird nie in die Spalte geschrieben, sondern gerechnet: unterschrieben, nicht widerrufen, aber gueltig_bis vorbei.
    status: v ? (aktiv ? "unterschrieben" : v.widerrufen_am ? "widerrufen" : v.status === "unterschrieben" ? "abgelaufen" : v.status) : null,
    unterschriftUrl,
  };
}

/** GET /kunde/:ref/app/vollmacht — die aktive Vollmacht, sonst die letzte plus der Weg zu einer neuen. */
router.get("/kunde/:ref/app/vollmacht", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const frei = await antraegeFreigeschaltet();
    const aktiv = await vollmachtAktiv(p.personId);
    if (aktiv) return res.json({ ...vollmachtAntwort(aktiv, true, null), antraegeAn: frei });
    const letzte = await vollmachtLetzte(p.personId);
    // Ohne Freischaltung (fiaon_settings.app_antraege_an) kein Unterschriftlink — der Bereich zeigt dann den Hinweis.
    res.json({ ...vollmachtAntwort(letzte, false, frei ? unterschriftPfad(unterschriftTokenErzeugen("vollmacht", p.personId)) : null), antraegeAn: frei });
  } catch (e: any) {
    console.error("[APP] vollmacht:", e?.message || e);
    fehler(res, 500, "Ihre Vollmacht konnte gerade nicht geladen werden.");
  }
});

/** POST /kunde/:ref/app/vollmacht/widerruf — widerruft die aktive Vollmacht; offene Anträge bleiben liegen. */
router.post("/kunde/:ref/app/vollmacht/widerruf", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const aktiv = await vollmachtAktiv(p.personId);
    if (!aktiv) return fehler(res, 409, "Es gibt gerade keine Vollmacht, die Sie widerrufen könnten.");
    await sqlPool`UPDATE fiaon_vollmachten SET status = 'widerrufen', widerrufen_am = NOW() WHERE id = ${aktiv.id} AND person_id = ${p.personId}`;
    const offene = (await sqlPool`SELECT id, person_id, stand, titel, aktenzeichen, zustaendig_agent_id FROM fiaon_vorgaenge WHERE person_id = ${p.personId} AND stand IN ('unterschrift_offen','versandbereit')`) as any[];
    for (let i = 0; i < offene.length; i++) {
      const o = offene[i]; const oid = Number(o.id);
      await ereignis(oid, p.personId, "vollmacht", "Vollmacht vom Kunden widerrufen — Übermittlung nicht mehr gedeckt.", "Sie haben Ihre Vollmacht widerrufen. Ohne Vollmacht übermitteln wir dieses Schreiben nicht.").catch(() => {});
      if (String(o.stand) === "versandbereit") {
        // Beim Betreuer liegt der offene Versand-Auftrag — ein STOPP daran, sichtbar und dringend. POST /versandt lehnt ohne Vollmacht ohnehin ab.
        try {
          await auftragFuerKunden({
            personId: p.personId, ref: req.kundeRef!, agentId: o.zustaendig_agent_id ? Number(o.zustaendig_agent_id) : null, dringend: true, faelligAm: heuteIso(),
            titel: `${p.name}: STOPP – Vollmacht widerrufen, NICHT versenden (${String(o.aktenzeichen || `Vorgang #${oid}`)})`,
            text: `Der Kunde hat seine Vollmacht widerrufen. Der unterschriebene Antrag „${String(o.titel)}“ (Vorgang #${oid}) darf NICHT versendet werden, bis eine neue Vollmacht vorliegt. Das Quittieren wird vom System abgelehnt.`,
            schluessel: `app-antrag-versand:${oid}`, quelle: "kundenbereich", bereich: "pruefen", link: `/agent/app-vorgaenge/${oid}`, autorName: "Kundenbereich",
          });
        } catch (e: any) { console.error("[APP] Widerruf Stopp-Auftrag:", e?.message || e); }
      }
    }
    const hinweis = offene.length
      ? `Ihre Vollmacht ist widerrufen. ${offene.length === 1 ? "Ein Antrag wartet noch" : `${offene.length} Anträge warten noch`} – ohne Vollmacht übermitteln wir nichts. Sie können jederzeit eine neue Vollmacht erteilen.`
      : "Ihre Vollmacht ist widerrufen. Sie können jederzeit eine neue erteilen.";
    res.json({ ok: true, widerrufenAm: heuteText(), offeneVorgaenge: offene.length, text: hinweis });
  } catch (e: any) {
    console.error("[APP] vollmacht widerruf:", e?.message || e);
    fehler(res, 500, "Der Widerruf konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal.");
  }
});

// ── Nachricht mit Dringend-Kästchen ─────────────────────────────────────────
/**
 * POST /kunde/:ref/app/nachricht { betreff, text, dringend }
 * Wie POST /kunde/:ref/tickets (fiaon-tickets.ts) — plus: bei „dringend“ ein
 * Auftrag an den Betreuer, heute fällig (Post mit Frist, Gericht, Inkasso).
 */
const NACHRICHTEN_JE_STUNDE = 6;
/** Frühere dringende Nachrichten desselben Tages bleiben im wieder geöffneten Auftrag lesbar. */
async function mitFrueherenNachrichten(schluessel: string, neuerText: string): Promise<string> {
  try {
    const [alt] = (await sqlPool`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${schluessel} AND erledigt_am IS NULL LIMIT 1`) as any[];
    const vorher = String(alt?.text || "").trim();
    if (!vorher || vorher === neuerText) return neuerText;
    return `${neuerText}\n\n— frühere Nachricht heute —\n${vorher}`.slice(0, 4000);
  } catch { return neuerText; }
}

router.post("/kunde/:ref/app/nachricht", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = req.kundeRef!;
    const betreff = String(req.body?.betreff || "").trim().slice(0, 160);
    const text = String(req.body?.text || "").trim().slice(0, 4000);
    const dringend = req.body?.dringend === true || ["1", "true", "ja", "on"].indexOf(String(req.body?.dringend ?? "").toLowerCase()) !== -1;
    if (betreff.length < 3 || text.length < 10) return fehler(res, 400, "Bitte geben Sie einen Betreff und mindestens einen Satz ein.");
    // Frequenzbremse: höchstens NACHRICHTEN_JE_STUNDE je Referenz — sonst füllt ein Skript mit dem Cookie das Aufgabenbrett in Sekunden.
    const [zahl] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_tickets WHERE ref = ${ref} AND created_at > NOW() - INTERVAL '1 hour'`.catch(() => [{ n: 0 }])) as any[];
    if (Number(zahl?.n ?? 0) >= NACHRICHTEN_JE_STUNDE) return fehler(res, 429, "Sie haben in der letzten Stunde schon mehrere Nachrichten geschickt. Ihre Ansprechperson liest sie – bitte warten Sie mit der nächsten ein wenig.");
    const [a] = (await sqlPool`SELECT a.person_id, p.assigned_agent_id FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
    const [t] = (await sqlPool`
      INSERT INTO fiaon_tickets (ref, person_id, agent_id, betreff, text)
      VALUES (${ref}, ${a?.person_id ?? null}, ${a?.assigned_agent_id ?? null}, ${dringend ? `DRINGEND: ${betreff}`.slice(0, 160) : betreff}, ${text}) RETURNING id, created_at`) as any[];
    const id = Number(t.id);
    await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${ref}, ${a?.person_id ?? null}, ${a?.assigned_agent_id ?? null}, 'Kunde', 'kunde_anliegen', ${`Anliegen #${id}${dringend ? " (DRINGEND – Post mit Frist)" : ""}: ${betreff}\n${text}`}, NOW())`.catch(() => {});
    let anWen: string | null = null;
    if (dringend) {
      try {
        const p = await personFuerRef(ref);
        // Schlüssel je Person, nicht je Ticket: weitere dringende Nachrichten hängen sich an denselben Auftrag (auftragFuerKunden öffnet ihn wieder).
        const schluessel = p?.personId ? `dringend:${p.personId}` : `dringend-ref:${ref}`;
        const erg = await auftragFuerKunden({
          personId: p?.personId ?? null, ref, dringend: true, faelligAm: heuteIso(), schluessel,
          titel: `${p?.name ?? ref}: DRINGEND – Post mit Frist: ${betreff}`.slice(0, 160),
          // Eine zweite dringende Nachricht am selben Tag öffnet denselben Auftrag — die frühere bleibt darunter stehen (TFO, 05.09.).
          text: await mitFrueherenNachrichten(schluessel, `Der Kunde hat sein Anliegen als dringend markiert (Frist, Gericht, Gerichtsvollzieher oder Inkasso). Anliegen #${id}.\n\nBetreff: ${betreff}\n\n${text}\n\nBitte heute lesen und dem Kunden antworten – im Anliegen oder per Telefon.`),
          quelle: "kundenbereich", bereich: "pruefen", link: `/admin/kunde/${encodeURIComponent(ref)}`, autorName: "Kundenbereich",
        });
        anWen = erg.kundenName ?? erg.agentName ?? null;
      } catch (e: any) { console.error("[APP] Auftrag dringende Nachricht:", e?.message || e); }
    }
    // Keine Zeitzusage für einen Menschen („liest sie heute“) — nur, was der Auftrag trägt: die Fälligkeit.
    const antwortSatz = !dringend ? "Ihre Nachricht ist bei uns eingegangen. Die Antwort sehen Sie hier unter Hilfe."
      : anWen ? `Ihre Nachricht liegt als dringend bei ${anWen} – mit Fälligkeit heute. Die Antwort sehen Sie hier unter Hilfe.`
      : "Ihre Nachricht ist als dringend bei uns eingegangen. Die Antwort sehen Sie hier unter Hilfe.";
    res.json({ ok: true, id, dringend, anWen, text: antwortSatz });
  } catch (e: any) {
    console.error("[APP] nachricht:", e?.message || e);
    fehler(res, 500, "Ihre Nachricht konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal.");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ÖFFENTLICH — Basis /app/unterschrift/:token (signierter Link, keine Anmeldung)
// ═══════════════════════════════════════════════════════════════════════════
type Zustand = "offen" | "unterschrieben" | "abgelaufen" | "widerrufen" | "ungueltig";
const LINK_ABGELAUFEN = "Dieser Link ist abgelaufen. Öffnen Sie den Vorgang in Ihrem Bereich – dort liegt ein neuer.";

/** Der jüngste Antrag der Person, der noch auf die Unterschrift wartet — für „1 von 2“. */
async function naechsterOffenerAntrag(personId: number): Promise<{ id: number; art: string } | null> {
  const [v] = (await sqlPool`SELECT id, art FROM fiaon_vorgaenge WHERE person_id = ${personId} AND stand = 'unterschrift_offen' AND art <> 'brief' ORDER BY created_at DESC LIMIT 1`) as any[];
  return v ? { id: Number(v.id), art: String(v.art) } : null;
}

/** GET /app/unterschrift/:token — was ist zu unterschreiben, und in welchem Zustand ist es? */
router.get("/app/unterschrift/:token", async (req: Request, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    if (!(await antraegeFreigeschaltet())) return res.status(403).json({ ok: false, zustand: "ungueltig", grund: "antraege_aus", error: "Die Unterschrift in der App und die Anträge aus Ihrem Bereich schalten wir gerade frei. Bis dahin bereitet Ihre Ansprechperson Anträge mit Ihnen im Gespräch vor." });
    const tk = unterschriftTokenPruefen(req.params.token);
    if (!tk) return res.status(400).json({ ok: false, zustand: "ungueltig" as Zustand, error: "Dieser Link ist ungültig." });
    // Ablauf ZUERST und ohne Dokument: Ein Token aus Mail, Browserverlauf oder
    // weitergeleitetem Chat darf kein zeitlich unbegrenzter Lesezugang auf ein
    // unterschriebenes Dokument mit Name, Anschrift, Geburtsdatum sein. Das
    // dauerhafte Nachlesen liegt hinter requireKunde (GET /vorgaenge/:id, /vollmacht).
    if (tk.abgelaufen) return res.status(410).json({ ok: false, zustand: "abgelaufen" as Zustand, error: LINK_ABGELAUFEN });
    if (tk.zweck === "vollmacht") {
      const k = await kundeLaden(tk.id);
      if (!k) return res.status(404).json({ ok: false, zustand: "ungueltig" as Zustand, error: "Dieser Link ist ungültig." });
      const aktiv = await vollmachtAktiv(k.personId);
      const naechster = await naechsterOffenerAntrag(k.personId);
      // Einmaligkeit über den Zustand: eine aktive Vollmacht, die alles Offene deckt, braucht keine zweite.
      // Jede Vollmacht-Zeile oder jeder Widerruf NACH der Ausstellung entwertet den Link (siehe vollmachtSeit).
      let zustand: Zustand = "offen";
      const seit = await vollmachtSeit(k.personId, tk.ausgestelltAm);
      if (aktiv && (!naechster || aktiv.umfang.indexOf(naechster.art) !== -1)) zustand = "unterschrieben";
      else if (seit.widerrufen) zustand = "widerrufen";
      else if (seit.neu) return res.status(410).json({ ok: false, zustand: "abgelaufen" as Zustand, error: LINK_ABGELAUFEN });
      // Vorbelegt: alle Zeilen — oder, bei einer aktiven Vollmacht, deren Zeilen plus die Art des wartenden Antrags.
      // Modul A bekommt die SCHLÜSSEL (p_konto, rundfunk, selbstauskunft …), nicht die Sie-Texte der Kästchen.
      const alleWerte = UMFANG_OPTIONEN.map((o) => o.wert);
      const vorbelegt = aktiv ? alleWerte.filter((w) => aktiv.umfang.indexOf(w) !== -1 || w === naechster?.art) : alleWerte;
      const s = schreibenErzeugen("vollmacht", schreibenDaten(k, "", { vollmachtUmfang: vorbelegt }));
      const weiterToken = zustand !== "unterschrieben" && naechster ? unterschriftTokenErzeugen("antrag", naechster.id) : null;
      return res.json({
        ok: true, art: "vollmacht", titel: s.titel, empfaenger: s.empfaengerName, aktenzeichen: null,
        html: aktiv && zustand === "unterschrieben" ? await vollmachtHtml(aktiv.id) ?? s.html : s.html,
        name: k.name, umfangOptionen: UMFANG_OPTIONEN, umfangVorbelegt: vorbelegt,
        gueltigBis: aktiv ? tag(aktiv.gueltig_bis) : tag(zwoelfMonateSpaeter()), unterschriebenAm: aktiv ? zeitText(aktiv.signed_at) : null,
        hinweisFuerKunden: s.hinweisFuerKunden ?? null,
        zustand, schritt: weiterToken ? { nr: 1, von: 2 } : { nr: 1, von: 1 }, weiterToken,
        vorgangId: naechster?.id ?? null,
      });
    }
    // Antrag
    const [v] = (await sqlPool`SELECT * FROM fiaon_vorgaenge WHERE id = ${tk.id} LIMIT 1`) as any[];
    if (!v || v.art === "brief") return res.status(404).json({ ok: false, zustand: "ungueltig" as Zustand, error: "Dieser Link ist ungültig." });
    const k = await kundeLaden(Number(v.person_id));
    if (!k) return res.status(404).json({ ok: false, zustand: "ungueltig" as Zustand, error: "Dieser Link ist ungültig." });
    let zustand: Zustand = "offen";
    if (String(v.stand) === "zurueckgezogen") zustand = "widerrufen";
    else if (String(v.stand) !== "unterschrift_offen") zustand = "unterschrieben";
    const html = await schreibenHtmlLaden(Number(v.id));
    const vorlage = await schreibenFuerVorgang(v, k);
    const [unterschrift] = (await sqlPool`SELECT am FROM fiaon_vorgang_ereignisse WHERE vorgang_id = ${Number(v.id)} AND art = 'unterschrieben' ORDER BY am DESC LIMIT 1`) as any[];
    const aktiv = await vollmachtAktiv(k.personId);
    // „2 von 2“, wenn die Vollmacht eben erst unterschrieben wurde (Kette aus der Vollmacht-Seite).
    const ebenErst = !!aktiv?.signed_at && Date.now() - new Date(aktiv.signed_at).getTime() < 2 * 60 * 60 * 1000;
    res.json({
      ok: true, art: v.art, titel: vorlage.titel || String(v.titel), empfaenger: v.empfaenger_name ?? vorlage.empfaengerName, empfaengerAdresse: v.empfaenger_adresse ?? vorlage.empfaengerAdresse,
      aktenzeichen: v.aktenzeichen ?? null, html: html ?? vorlage.html, name: k.name, umfangOptionen: null,
      gueltigBis: null, unterschriebenAm: unterschrift ? zeitText(unterschrift.am) : null, hinweisFuerKunden: vorlage.hinweisFuerKunden ?? null,
      vollmachtNoetig: !(aktiv && aktiv.umfang.indexOf(String(v.art)) !== -1),
      zustand, schritt: ebenErst ? { nr: 2, von: 2 } : { nr: 1, von: 1 }, weiterToken: null, vorgangId: Number(v.id),
    });
  } catch (e: any) {
    console.error("[APP] unterschrift laden:", e?.message || e);
    fehler(res, 500, "Die Seite lässt sich gerade nicht öffnen. Bitte versuchen Sie es in einem Moment noch einmal.");
  }
});

async function vollmachtHtml(id: number): Promise<string | null> {
  const [v] = (await sqlPool`SELECT rendered_html, signature_png, signature_name, signed_at FROM fiaon_vollmachten WHERE id = ${id} LIMIT 1`) as any[];
  if (!v) return null;
  return v.signature_png ? unterschriftEinsetzen(String(v.rendered_html), unterschriftHtml(String(v.signature_png), String(v.signature_name || ""), zeitText(v.signed_at) ?? "")) : String(v.rendered_html);
}

const SIGNATUR_MAX = 400 * 1024;
/** Prüft die Fingerunterschrift: PNG als data-URL, höchstens 400 KB, wirklich Base64. */
function signaturPruefen(roh: unknown): string | null {
  const s = String(roh ?? "");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
  const b64 = s.slice("data:image/png;base64,".length);
  if (b64.length < 200) return null;
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length < 100 || bytes.length > SIGNATUR_MAX) return null;
  // PNG-Kopf: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  return s;
}

/**
 * POST /app/unterschrift/:token { signaturePng, name, umfang[], gelesen: true }
 * Vollmacht: Zeile in fiaon_vollmachten + PDF. Antrag: Vorgang → versandbereit,
 * PDF in der Akte, Auftrag „versenden und quittieren“ an den Betreuer.
 */
router.post("/app/unterschrift/:token", async (req: Request, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    if (!(await antraegeFreigeschaltet())) return res.status(403).json({ ok: false, zustand: "ungueltig", grund: "antraege_aus", error: "Die Unterschrift in der App und die Anträge aus Ihrem Bereich schalten wir gerade frei. Bis dahin bereitet Ihre Ansprechperson Anträge mit Ihnen im Gespräch vor." });
    const tk = unterschriftTokenPruefen(req.params.token);
    if (!tk) return res.status(400).json({ ok: false, zustand: "ungueltig" as Zustand, error: "Dieser Link ist ungültig." });
    if (tk.abgelaufen) return res.status(410).json({ ok: false, zustand: "abgelaufen" as Zustand, error: LINK_ABGELAUFEN });
    if (req.body?.gelesen !== true) return fehler(res, 400, tk.zweck === "vollmacht" ? "Bitte bestätigen Sie, dass Sie die Vollmacht gelesen haben." : "Bitte bestätigen Sie, dass Sie das Schreiben gelesen haben.");
    const name = String(req.body?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
    if (name.length < 3) return fehler(res, 400, "Bitte schreiben Sie Ihren Namen in Druckschrift in das Feld.");
    const signaturePng = signaturPruefen(req.body?.signaturePng);
    if (!signaturePng) return fehler(res, 400, "Ihre Unterschrift ist nicht angekommen. Bitte unterschreiben Sie noch einmal mit dem Finger.");
    const ip = absenderIp(req); const userAgent = String(req.headers["user-agent"] || "").slice(0, 500) || null;
    // Roboter-Wand (Hausregel aus fiaon-zustimmung.ts, AGENTS.md 06.08.2026): Ein
    // Browsertest oder Skript gegen die Produktion darf keine echten
    // Willenserklärungen erzeugen — keine Vollmacht, keinen Versand-Auftrag.
    const { istRoboterUnterschrift } = await import("../lib/fiaon-vertrieb-zusage");
    const roboter = istRoboterUnterschrift(ip, userAgent);
    if (roboter.roboter) {
      console.warn(`[APP] Unterschrift abgewiesen: ${roboter.grund ?? "Roboter"} (Token-Zweck ${tk.zweck}, id ${tk.id})`);
      return fehler(res, 400, "Diese Unterschrift kann nur ein Mensch leisten.");
    }
    const jetzt = new Date(); const jetztText = zeitText(jetzt) ?? heuteText();
    const [datumText, uhrzeitText] = jetztText.split(", ");

    // ── Vollmacht ──────────────────────────────────────────────────────────
    if (tk.zweck === "vollmacht") {
      const k = await kundeLaden(tk.id);
      if (!k) return res.status(404).json({ ok: false, zustand: "ungueltig" as Zustand, error: "Dieser Link ist ungültig." });
      const rohUmfang = Array.isArray(req.body?.umfang) ? (req.body.umfang as unknown[]).map(String) : [];
      const umfang = UMFANG_OPTIONEN.map((o) => o.wert).filter((w) => rohUmfang.indexOf(w) !== -1);
      if (!umfang.length) return fehler(res, 400, "Bitte wählen Sie mindestens eine Antragsart, für die die Vollmacht gelten soll.");
      const aktiv = await vollmachtAktiv(k.personId);
      const naechster = await naechsterOffenerAntrag(k.personId);
      if (aktiv && (!naechster || aktiv.umfang.indexOf(naechster.art) !== -1)) {
        return res.status(409).json({ ok: false, zustand: "unterschrieben" as Zustand, error: `Ihre Vollmacht ist schon erteilt und gilt bis ${tag(aktiv.gueltig_bis)}.` });
      }
      // Einmaligkeit des Links: Jede Vollmacht-Zeile oder jeder Widerruf nach der
      // Ausstellung entwertet ihn — sonst setzte ein alter Link (geteiltes Gerät,
      // weitergeleitete Mail) eine widerrufene Vollmacht wieder in Kraft.
      const seit = await vollmachtSeit(k.personId, tk.ausgestelltAm);
      if (seit.widerrufen) return res.status(409).json({ ok: false, zustand: "widerrufen" as Zustand, error: "Sie haben seit diesem Link eine Vollmacht widerrufen. Für eine neue entsteht in Ihrem Bereich ein neuer Link." });
      if (seit.neu) return res.status(410).json({ ok: false, zustand: "abgelaufen" as Zustand, error: LINK_ABGELAUFEN });
      // Der Antrag, der als Nächstes folgt, muss von der Vollmacht gedeckt sein — sonst liefe der Kunde im Kreis.
      if (naechster && UMFANG_WERTE.has(naechster.art) && umfang.indexOf(naechster.art) === -1) {
        const zeile = UMFANG_OPTIONEN.find((o) => o.wert === naechster.art)?.text ?? naechster.art;
        return fehler(res, 400, `Die Vollmacht muss den Antrag umfassen, den Sie als Nächstes unterschreiben: ${zeile}. Bitte setzen Sie das Häkchen bei dieser Zeile.`);
      }
      const s = schreibenErzeugen("vollmacht", schreibenDaten(k, "", { vollmachtUmfang: umfang }));
      const docHash = hashVon(`${s.html}\n${signaturePng}\n${name}`);
      const gueltigBis = zwoelfMonateSpaeter();
      // Eine ältere aktive Vollmacht (die den offenen Antrag nicht deckt) wird durch die neue ersetzt.
      if (aktiv) await sqlPool`UPDATE fiaon_vollmachten SET status = 'widerrufen', widerrufen_am = NOW() WHERE id = ${aktiv.id} AND person_id = ${k.personId}`;
      const [vz] = (await sqlPool`
        INSERT INTO fiaon_vollmachten (person_id, ref, template_version, umfang, rendered_html, signature_png, signature_name, signed_at, ip, user_agent, doc_hash, gueltig_bis, status)
        VALUES (${k.personId}, ${k.ref}, 1, ${sqlPool.json(umfang as any)}, ${s.html}, ${signaturePng}, ${name}, ${jetzt}, ${ip}, ${userAgent}, ${docHash}, ${gueltigBis}, 'unterschrieben')
        RETURNING id`) as any[];
      const vollmachtId = Number(vz.id);
      try {
        // Die Vollmacht ist AN FIAON gerichtet und wird nicht übermittelt — eigene Markenzeile statt „Übermittelt durch …“.
        const pdf = await schreibenAlsPdf(unterschriftEinsetzen(s.html, unterschriftHtml(signaturePng, name, jetztText)), s.titel, `Vollmacht zur Übermittlung Nr. ${vollmachtId} · erteilt von ${k.name}`, markenzeileFuer("vollmacht"));
        const [d] = (await sqlPool`
          INSERT INTO fiaon_dokumente (person_id, ref, vorgang_id, art, dateiname, mime, bytes, inhalt, quelle, aktenzeichen, doc_hash)
          VALUES (${k.personId}, ${k.ref}, ${naechster?.id ?? null}, 'vollmacht_pdf', ${`Vollmacht_${datumText.replace(/\./g, "-")}.pdf`}, 'application/pdf', ${pdf.length}, ${pdf}, 'erzeugt', null, ${createHash("sha256").update(pdf).digest("hex")})
          RETURNING id`) as any[];
        await sqlPool`UPDATE fiaon_vollmachten SET pdf_dokument_id = ${Number(d.id)} WHERE id = ${vollmachtId}`;
      } catch (e: any) { console.error("[APP] Vollmacht-PDF:", e?.message || e); }
      // In der Zeitleiste aller Vorgänge, die noch auf Unterschrift oder Versand warten.
      const offene = (await sqlPool`SELECT id FROM fiaon_vorgaenge WHERE person_id = ${k.personId} AND stand IN ('unterschrift_offen','versandbereit')`) as any[];
      for (let i = 0; i < offene.length; i++) await ereignis(Number(offene[i].id), k.personId, "vollmacht", `Vollmacht Nr. ${vollmachtId} erteilt (${umfang.join(", ")}; IP ${ip ?? "unbekannt"}).`, `Vollmacht erteilt, gültig bis ${tag(gueltigBis)}.`).catch(() => {});
      const weiterToken = naechster ? unterschriftTokenErzeugen("antrag", naechster.id) : null;
      return res.json({ ok: true, art: "vollmacht", vollmachtId, gueltigBis: tag(gueltigBis), weiterToken, vorgangId: naechster?.id ?? null,
        text: `Unterschrieben am ${datumText}, ${uhrzeitText} Uhr. Ihre Vollmacht gilt bis ${tag(gueltigBis)}.${weiterToken ? " Als Nächstes unterschreiben Sie Ihren Antrag." : ""}` });
    }

    // ── Antrag ─────────────────────────────────────────────────────────────
    const [v] = (await sqlPool`SELECT * FROM fiaon_vorgaenge WHERE id = ${tk.id} LIMIT 1`) as any[];
    if (!v || v.art === "brief") return res.status(404).json({ ok: false, zustand: "ungueltig" as Zustand, error: "Dieser Link ist ungültig." });
    const personId = Number(v.person_id); const vorgangId = Number(v.id);
    const k = await kundeLaden(personId);
    if (!k) return res.status(404).json({ ok: false, zustand: "ungueltig" as Zustand, error: "Dieser Link ist ungültig." });
    if (String(v.stand) === "zurueckgezogen") return res.status(409).json({ ok: false, zustand: "widerrufen" as Zustand, error: "Diesen Antrag haben Sie zurückgezogen." });
    if (String(v.stand) !== "unterschrift_offen") return res.status(409).json({ ok: false, zustand: "unterschrieben" as Zustand, error: "Dieser Antrag ist schon unterschrieben. Den Stand sehen Sie unter Vorgänge." });
    if (!(await vollmachtDeckt(personId, String(v.art)))) {
      const vollmachtToken = unterschriftTokenErzeugen("vollmacht", personId);
      return res.status(409).json({ ok: false, zustand: "offen" as Zustand, weiterToken: vollmachtToken, error: "Für die Übermittlung fehlt noch Ihre Vollmacht. Bitte unterschreiben Sie zuerst die Vollmacht." });
    }
    const az = String(v.aktenzeichen || aktenzeichenFuer(vorgangId));
    // Die Einmaligkeit hängt am Stand — und der Zustand kippt ZUERST: Zwei
    // gleichzeitige POSTs (Doppeltipp, zwei Tabs) bestehen sonst beide die
    // Prüfung oben und legen zwei PDFs mit verschiedenen Unterschriften in die
    // Akte, von denen der Mitarbeiter das falsche versenden könnte.
    const geaendert = (await sqlPool`UPDATE fiaon_vorgaenge SET stand = 'versandbereit', stand_text = 'Unterschrieben – ein Mitarbeiter versendet und bestätigt den Versand hier.', updated_at = NOW()
                                     WHERE id = ${vorgangId} AND stand = 'unterschrift_offen' RETURNING id`) as any[];
    if (!geaendert.length) return res.status(409).json({ ok: false, zustand: "unterschrieben" as Zustand, error: "Dieser Antrag ist schon unterschrieben. Den Stand sehen Sie unter Vorgänge." });
    let gesamtHtml = ""; let dokId = 0;
    try {
      const html = (await schreibenHtmlLaden(vorgangId)) ?? (await schreibenFuerVorgang(v, k)).html;
      gesamtHtml = unterschriftEinsetzen(html, unterschriftHtml(signaturePng, name, jetztText));
      const pdf = await schreibenAlsPdf(gesamtHtml, String(v.titel), fusszeileFuer(az));
      const [d] = (await sqlPool`
        INSERT INTO fiaon_dokumente (person_id, ref, vorgang_id, art, dateiname, mime, bytes, inhalt, quelle, aktenzeichen, doc_hash)
        VALUES (${personId}, ${k.ref}, ${vorgangId}, 'antrag_pdf', ${`Antrag_${az.replace(/[^0-9A-Za-z-]/g, "_")}.pdf`}, 'application/pdf', ${pdf.length}, ${pdf}, 'erzeugt', ${az}, ${createHash("sha256").update(pdf).digest("hex")})
        RETURNING id`) as any[];
      dokId = Number(d.id);
    } catch (e) {
      // Ohne PDF keine Unterschrift: Stand zurück, der Kunde kann es noch einmal versuchen.
      await sqlPool`UPDATE fiaon_vorgaenge SET stand = 'unterschrift_offen', stand_text = 'Wartet auf Ihre Unterschrift.', updated_at = NOW()
                     WHERE id = ${vorgangId} AND stand = 'versandbereit'`.catch(() => {});
      throw e;
    }
    await ereignis(vorgangId, personId, "unterschrieben", `Unterschrieben als „${name}“ (IP ${ip ?? "unbekannt"}, ${(userAgent ?? "").slice(0, 120)}; Signatur-Hash ${hashVon(`${gesamtHtml}\n${signaturePng}`).slice(0, 16)}; PDF #${dokId}).`, `Von Ihnen unterschrieben am ${datumText}, ${uhrzeitText} Uhr.`);
    const frist = werktageSpaeter(2);
    try {
      const erg = await auftragFuerKunden({
        personId, ref: k.ref, agentId: v.zustaendig_agent_id ? Number(v.zustaendig_agent_id) : null,
        titel: `${k.name}: Antrag versenden und quittieren (${az})`,
        text: `Der Kunde hat „${String(v.titel)}“ unterschrieben (${az}, Vorgang #${vorgangId}). Empfänger: ${String(v.empfaenger_name || "siehe Schreiben")}${v.empfaenger_adresse ? `, ${String(v.empfaenger_adresse).replace(/\n/g, ", ")}` : ""}.${v.empfaenger_adresse ? "" : " ACHTUNG: Empfänger-Anschrift fehlt in der Akte – vor dem Versand beim Kunden erfragen (Bank, Versicherer oder Anbieter mit Anschrift; bei Kündigungen auch Vertrags- bzw. Versicherungsschein-Nummer und Kennzeichen)."} Das unterschriebene PDF liegt in der Akte (Dokument #${dokId}). Bitte versenden (Post oder E-Mail an die Stelle) und danach im Vorgang den Versand bestätigen – erst dann sieht der Kunde „Versandt“ und die Frist läuft. Frist: zwei Werktage (${frist}).`,
        faelligAm: frist, schluessel: `app-antrag-versand:${vorgangId}`, quelle: "kundenbereich", bereich: "pruefen",
        link: `/agent/app-vorgaenge/${vorgangId}`, autorName: "Kundenbereich",
      });
      if (erg.agentId && !v.zustaendig_agent_id) await sqlPool`UPDATE fiaon_vorgaenge SET zustaendig_agent_id = ${erg.agentId} WHERE id = ${vorgangId}`;
    } catch (e: any) { console.error("[APP] Auftrag Versand:", e?.message || e); }
    res.json({ ok: true, art: v.art, vorgangId, aktenzeichen: az, dokumentId: dokId, weiterToken: null,
      text: `Unterschrieben am ${datumText}, ${uhrzeitText} Uhr. Ein Mitarbeiter versendet den Antrag und bestätigt den Versand unter Vorgänge.` });
  } catch (e: any) {
    console.error("[APP] unterschrift speichern:", e?.message || e);
    fehler(res, 500, "Ihre Unterschrift konnte nicht gespeichert werden. Bitte versuchen Sie es noch einmal – nichts ist verloren gegangen.");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MITARBEITER — Basis /agent/app/vorgaenge/:id
// ═══════════════════════════════════════════════════════════════════════════
/** Vorgang für einen Mitarbeiter laden — nur, wenn er an diese Person darf (fiaon-kundenzugriff). */
async function vorgangFuerAgent(req: AgentRequest, res: Response): Promise<any | null> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { fehler(res, 404, "Diesen Vorgang gibt es nicht."); return null; }
  const [v] = (await sqlPool`SELECT v.*, an.regel_schluessel FROM fiaon_vorgaenge v LEFT JOIN fiaon_ansprueche an ON an.id = v.anspruch_id WHERE v.id = ${id} LIMIT 1`) as any[];
  if (!v) { fehler(res, 404, "Diesen Vorgang gibt es nicht."); return null; }
  const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
  const rolle = req.agent?.rolle || await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, Number(v.person_id)))) { fehler(res, 403, "Dieser Kunde wird von jemand anderem betreut."); return null; }
  if (req.agent?.ansicht) { fehler(res, 403, "In der Ansicht lässt sich nichts ändern."); return null; }
  return v;
}

/** Kundensatz eines Mitarbeiters gegen die Wortwand — harte Treffer stoppen. */
function kundensatzPruefen(res: Response, text: string, pflicht: boolean): string | null {
  const t = String(text || "").trim().slice(0, 1000);
  if (pflicht && t.length < 3) { fehler(res, 400, "Bitte einen Satz für den Kunden eingeben."); return null; }
  if (!t) return "";
  const funde = wandPruefen(t);
  if (!wandUrteil(funde).sendbar) {
    fehler(res, 400, `Der Satz für den Kunden enthält Formulierungen, die wir nicht verwenden: ${funde.map((f) => `„${f.treffer}“`).join(", ")}. Bitte umformulieren.`);
    return null;
  }
  return t;
}

/** POST /agent/app/vorgaenge/:id/versandt { empfaenger?, fristTage? } — der Mensch quittiert den Versand. */
router.post("/agent/app/vorgaenge/:id/versandt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const v = await vorgangFuerAgent(req, res); if (!v) return;
    if (String(v.stand) !== "versandbereit") return fehler(res, 409, `Der Vorgang steht auf „${String(v.stand)}“ – quittieren lässt sich nur, was versandbereit ist.`);
    const id = Number(v.id); const personId = Number(v.person_id);
    // Ohne gedeckte Vollmacht keine Übermittlung — ein Widerruf oder Ablauf zwischen Unterschrift und Versand muss hier greifen.
    if (!(await vollmachtDeckt(personId, String(v.art)))) return fehler(res, 409, "Die Vollmacht des Kunden fehlt, ist widerrufen oder umfasst diese Antragsart nicht – nicht versenden. Der Kunde muss zuerst eine neue Vollmacht unterschreiben.");
    const empfaenger = String(req.body?.empfaenger ?? "").trim().slice(0, 200) || String(v.empfaenger_name || "").trim() || null;
    // Frist: als Tage (fristTage) oder als Datum (fristAm, YYYY-MM-DD — so schickt es das Mitarbeiter-Portal); sonst 21 Tage.
    const fristTageRoh = Number(req.body?.fristTage);
    const fristAmRoh = String(req.body?.fristAm ?? "").trim();
    const fristAm = /^\d{4}-\d{2}-\d{2}$/.test(fristAmRoh) && fristAmRoh > heuteIso() ? fristAmRoh
      : tageSpaeter(Number.isInteger(fristTageRoh) && fristTageRoh >= 1 && fristTageRoh <= 180 ? fristTageRoh : 21);
    await sqlPool`UPDATE fiaon_vorgaenge SET stand = 'versandt', stand_text = ${`Versandt am ${heuteText()}${empfaenger ? ` an ${empfaenger}` : ""}. Antwort erwartet bis ${tag(fristAm)}.`},
                         versandt_am = NOW(), frist_am = ${fristAm}, empfaenger_name = ${empfaenger}, zustaendig_agent_id = COALESCE(zustaendig_agent_id, ${req.agent!.id}), updated_at = NOW()
                   WHERE id = ${id}`;
    await sqlPool`UPDATE fiaon_dokumente SET gesendet_am = NOW(), gesendet_an = ${empfaenger}, sende_anzahl = sende_anzahl + 1
                   WHERE vorgang_id = ${id} AND person_id = ${personId} AND art = 'antrag_pdf' AND geloescht_am IS NULL`;
    await ereignis(id, personId, "versandt", `Versand quittiert von ${req.agent!.name}${empfaenger ? ` an ${empfaenger}` : ""}; Frist ${fristAm}.`, `Versandt${empfaenger ? ` an ${empfaenger}` : ""}. Antwort erwartet bis ${tag(fristAm)}.`, req.agent!.id);
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', updated_at = NOW() WHERE schluessel = ${`app-antrag-versand:${id}`} AND status <> 'erledigt'`.catch(() => {});
    void pushBeiEreignis(personId, "vorgang_versandt", { vorgangId: id, titel: ART_TITEL[String(v.art)] ?? String(v.titel), empfaenger, fristAm: tag(fristAm) }).catch(() => {});
    res.json({ ok: true, stand: "versandt", versandtAm: heuteText(), fristAm: tag(fristAm), empfaenger });
  } catch (e: any) {
    console.error("[APP] versandt:", e?.message || e);
    fehler(res, 500, "Der Versand konnte gerade nicht quittiert werden. Bitte gleich noch einmal versuchen.");
  }
});

/** POST /agent/app/vorgaenge/:id/ergebnis { stand, betragCents?, monatlich?, textFuerKunden } — Bescheid gelesen, Ergebnis eingetragen. */
router.post("/agent/app/vorgaenge/:id/ergebnis", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const v = await vorgangFuerAgent(req, res); if (!v) return;
    const stand = String(req.body?.stand ?? "");
    if (stand !== "bewilligt" && stand !== "abgelehnt") return fehler(res, 400, "Das Ergebnis muss „bewilligt“ oder „abgelehnt“ sein.");
    if (["versandt", "nachfrage", "bewilligt", "abgelehnt"].indexOf(String(v.stand)) === -1) return fehler(res, 409, `Der Vorgang steht auf „${String(v.stand)}“ – ein Ergebnis gibt es erst nach dem Versand.`);
    const textFuerKunden = kundensatzPruefen(res, String(req.body?.textFuerKunden ?? ""), true); if (textFuerKunden === null) return;
    const betragRoh = req.body?.betragCents;
    const betragCents = betragRoh === null || betragRoh === undefined || betragRoh === "" ? null : Number(betragRoh);
    if (betragCents !== null && (!Number.isInteger(betragCents) || betragCents < 0 || betragCents > 100_000_000)) return fehler(res, 400, "Der Betrag muss in Cent als ganze Zahl angegeben sein.");
    const monatlich = req.body?.monatlich === undefined || req.body?.monatlich === null ? null : !!req.body.monatlich;
    const id = Number(v.id); const personId = Number(v.person_id);
    await sqlPool`UPDATE fiaon_vorgaenge SET stand = ${stand}, stand_text = ${textFuerKunden}, zustaendig_agent_id = COALESCE(zustaendig_agent_id, ${req.agent!.id}), updated_at = NOW() WHERE id = ${id}`;
    if (v.anspruch_id) {
      await sqlPool`UPDATE fiaon_ansprueche SET stand = ${stand}, betrag_cents = COALESCE(${betragCents}, betrag_cents), monatlich = COALESCE(${monatlich}, monatlich), aktualisiert_am = NOW()
                     WHERE id = ${Number(v.anspruch_id)} AND person_id = ${personId}`;
    }
    await sqlPool`UPDATE fiaon_dokumente SET geprueft_am = NOW(), geprueft_von_agent_id = ${req.agent!.id} WHERE vorgang_id = ${id} AND art = 'bescheid' AND geprueft_am IS NULL`;
    await ereignis(id, personId, stand, `Ergebnis „${stand}“ eingetragen von ${req.agent!.name}${betragCents !== null ? ` (${eurText(betragCents)} ${monatlich === false ? "einmalig" : "im Monat"})` : ""}.`, textFuerKunden, req.agent!.id);
    // Mit dem Ergebnis sind Bescheid-, Fristen- und Eskalations-Aufträge gegenstandslos — keine toten Aufträge auf dem Tisch.
    const schluessel = AUFTRAG_SCHLUESSEL(id);
    for (let i = 0; i < schluessel.length; i++) await auftragSchliessen(schluessel[i], `Ergebnis „${stand}“ eingetragen von ${req.agent!.name}.`);
    if (stand === "abgelehnt") {
      // Der Kundensatz „Abgelehnt am … “ trägt nur, was ein Auftrag dahinter hat: die Ablehnung wird mit dem Kunden besprochen.
      const k = await kundeLaden(personId);
      const az = String(v.aktenzeichen || aktenzeichenFuer(id));
      try {
        await auftragFuerKunden({
          personId, ref: k?.ref ?? null, agentId: req.agent!.id,
          titel: `${k?.name ?? `Person ${personId}`}: Ablehnung besprechen (${az})`,
          text: `Der Antrag „${String(v.titel)}“ (${az}, Vorgang #${id}) wurde abgelehnt. Satz für den Kunden: „${textFuerKunden}“. Bitte mit dem Kunden klären, was daraus folgt (Widerspruch beim Kunden selbst, andere Stelle, Punkt schließen) und das Ergebnis als Notiz im Vorgang festhalten.`,
          faelligAm: werktageSpaeter(2), schluessel: `app-ablehnung:${id}`, quelle: "kundenbereich", bereich: "pruefen",
          link: `/agent/app-vorgaenge/${id}`, autorName: "Kundenbereich",
        });
      } catch (e: any) { console.error("[APP] Auftrag Ablehnung:", e?.message || e); }
    }
    if (stand === "bewilligt") void pushBeiEreignis(personId, "vorgang_bewilligt", { vorgangId: id, titel: ART_TITEL[String(v.art)] ?? String(v.titel), betragCents, monatlich }).catch(() => {});
    res.json({ ok: true, stand, betragCents, monatlich });
  } catch (e: any) {
    console.error("[APP] ergebnis:", e?.message || e);
    fehler(res, 500, "Das Ergebnis konnte gerade nicht gespeichert werden. Bitte gleich noch einmal versuchen.");
  }
});

/**
 * POST /agent/app/vorgaenge/:id/nachgefasst { empfaenger?, text? } — der Mensch
 * quittiert, dass die Nachfrage (Wir-Form, Entwurf aus dem Fristenwächter-Auftrag)
 * bei der Stelle hinausgegangen ist. Erst DANACH liest der Kunde „Wir haben am …
 * nachgefragt.“ — vorher steht nur „Die Nachfrage ist in Arbeit.“ (Hausregel:
 * keine Zusage ohne Datenbedingung; Prüffund 05.09.2026, Abweichung von der Spec).
 * Ohne Vollmacht keine Nachfrage — sie ist eine Handlung des Übermittlers.
 * Der Knopf dazu gehört ins Mitarbeiter-Portal (client/src/pages/agent/app-vorgang.tsx).
 */
router.post("/agent/app/vorgaenge/:id/nachgefasst", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const v = await vorgangFuerAgent(req, res); if (!v) return;
    if (String(v.stand) !== "nachfrage" && String(v.stand) !== "versandt") return fehler(res, 409, `Der Vorgang steht auf „${String(v.stand)}“ – eine Nachfrage gibt es nur, solange auf eine Antwort gewartet wird.`);
    const id = Number(v.id); const personId = Number(v.person_id);
    if (!(await vollmachtDeckt(personId, String(v.art)))) return fehler(res, 409, "Die Vollmacht des Kunden fehlt, ist widerrufen oder umfasst diese Antragsart nicht – ohne Vollmacht keine Nachfrage bei der Stelle.");
    const empfaenger = String(req.body?.empfaenger ?? "").trim().slice(0, 200) || String(v.empfaenger_name || "").trim() || "die Stelle";
    const intern = String(req.body?.text ?? "").trim().slice(0, 1000);
    const heute = heuteText();
    // Aus 'versandt' heraus (Frist noch nicht verstrichen, Mitarbeiter fragt früher nach) kippt der Stand hier auf 'nachfrage'.
    await sqlPool`UPDATE fiaon_vorgaenge SET stand = 'nachfrage', erinnert_am = COALESCE(erinnert_am, NOW()),
                         stand_text = ${`Keine Antwort bis ${tag(v.frist_am) ?? "–"}. Wir haben am ${heute} nachgefragt. Sie müssen nichts tun.`},
                         zustaendig_agent_id = COALESCE(zustaendig_agent_id, ${req.agent!.id}), updated_at = NOW() WHERE id = ${id}`;
    await ereignis(id, personId, "nachfrage", `Nachfrage an ${empfaenger} versendet, quittiert von ${req.agent!.name}.${intern ? ` ${intern}` : ""}`, `Wir haben am ${heute} bei ${empfaenger} nachgefragt. Sie müssen nichts tun.`, req.agent!.id);
    await auftragSchliessen(`nachfass:${id}`, `Nachfrage versendet, quittiert von ${req.agent!.name}.`);
    await auftragSchliessen(`frist7:${id}`, `Nachfrage versendet, quittiert von ${req.agent!.name}.`);
    res.json({ ok: true, stand: "nachfrage", nachgefragtAm: heute, empfaenger });
  } catch (e: any) {
    console.error("[APP] nachgefasst:", e?.message || e);
    fehler(res, 500, "Die Nachfrage konnte gerade nicht quittiert werden. Bitte gleich noch einmal versuchen.");
  }
});

/** POST /agent/app/vorgaenge/:id/notiz { textFuerKunden } — „Das haben wir daraus gemacht“ (Briefe) oder ein Zwischenstand. */
router.post("/agent/app/vorgaenge/:id/notiz", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const v = await vorgangFuerAgent(req, res); if (!v) return;
    const textFuerKunden = kundensatzPruefen(res, String(req.body?.textFuerKunden ?? ""), true); if (textFuerKunden === null) return;
    const id = Number(v.id); const personId = Number(v.person_id);
    await ereignis(id, personId, "notiz", `Notiz für den Kunden von ${req.agent!.name}.`, textFuerKunden, req.agent!.id);
    // Ein Brief, der bis hierhin nur „eingegangen“ war, gilt mit der ersten Notiz als gelesen.
    if (String(v.art) === "brief" && String(v.stand) === "eingegangen") {
      await sqlPool`UPDATE fiaon_vorgaenge SET stand = 'gelesen', stand_text = ${`Gelesen am ${heuteText()}.`}, zustaendig_agent_id = COALESCE(zustaendig_agent_id, ${req.agent!.id}), updated_at = NOW() WHERE id = ${id}`;
    } else {
      await sqlPool`UPDATE fiaon_vorgaenge SET updated_at = NOW() WHERE id = ${id}`;
    }
    res.json({ ok: true, am: zeitText(new Date()), text: textFuerKunden });
  } catch (e: any) {
    console.error("[APP] notiz:", e?.message || e);
    fehler(res, 500, "Die Notiz konnte gerade nicht gespeichert werden. Bitte gleich noch einmal versuchen.");
  }
});

// ── Mitarbeiter: lesen (Seite /agent/app-vorgaenge/:id) ────────────────────────
/** GET /agent/app/vorgaenge/:id — der ganze Vorgang aus Mitarbeitersicht: Kunde, Stand, Dokumente, Verlauf, Schreiben. */
router.get("/agent/app/vorgaenge/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAntraegeTabellen();
    const v = await vorgangFuerAgent(req, res); if (!v) return;
    const id = Number(v.id); const personId = Number(v.person_id);
    const k = await kundeLaden(personId);
    const [a] = (await sqlPool`SELECT a.ref, a.phone, a.email FROM fiaon_applications a WHERE a.person_id = ${personId} AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1`.catch(() => [])) as any[];
    const ereignisse = (await sqlPool`SELECT e.art, e.text, e.text_fuer_kunden, e.am, e.agent_id, ag.name AS agent_name FROM fiaon_vorgang_ereignisse e LEFT JOIN fiaon_agents ag ON ag.id = e.agent_id WHERE e.vorgang_id = ${id} ORDER BY e.am ASC, e.id ASC`) as any[];
    const dokumente = (await sqlPool`SELECT id, art, dateiname, bytes, hochgeladen_am FROM fiaon_dokumente WHERE vorgang_id = ${id} AND geloescht_am IS NULL AND art <> 'schreiben_html' ORDER BY hochgeladen_am ASC`) as any[];
    const regel = v.regel_schluessel ? REGELN.find((r) => r.schluessel === v.regel_schluessel) : null;
    const schreibenHtml = String(v.art) === "brief" ? null : await schreibenHtmlLaden(id);
    const name = k ? [k.vorname, k.nachname].filter(Boolean).join(" ").trim() : "";
    res.json({
      ok: true,
      vorgang: {
        id, art: v.art, artTitel: ART_TITEL[v.art] ?? v.art, titel: v.titel, stand: v.stand, standText: v.stand_text ?? null, aktenzeichen: v.aktenzeichen ?? null,
        empfaengerName: v.empfaenger_name ?? null, empfaengerAdresse: v.empfaenger_adresse ?? null,
        versandtAm: tag(v.versandt_am), fristAm: tag(v.frist_am), erinnertAm: tag(v.erinnert_am), eskaliertAm: tag(v.eskaliert_am), createdAt: tag(v.created_at),
        notizKunde: v.notiz_kunde ?? null, betragCents: v.betrag_cents == null ? null : Number(v.betrag_cents), monatlich: v.monatlich == null ? null : !!v.monatlich,
        kunde: { ref: a?.ref ?? "", name: name || (a?.ref ?? ""), personId, telefon: a?.phone ?? null, email: a?.email ?? null },
        regel: regel ? { titel: regel.titel, stelle: regel.stelle, rechtsgrundlage: regel.rechtsgrundlage } : null,
        dokumente: dokumente.map((d) => ({ id: Number(d.id), art: d.art, dateiname: d.dateiname, am: tag(d.hochgeladen_am), bytes: Number(d.bytes ?? 0) })),
        zeitleiste: ereignisse.map((e) => ({ art: e.art, am: zeitText(e.am), text: e.text || EREIGNIS_SATZ[e.art] || e.art, textFuerKunden: e.text_fuer_kunden ?? null, agentName: e.agent_name ?? null })),
        schreibenHtml,
      },
    });
  } catch (e: any) {
    console.error("[APP] agent vorgang:", e?.message || e);
    fehler(res, 500, STOERUNG);
  }
});

/** GET /agent/app/dokument/:id — ein Dokument aus dem Kundenbereich für den Mitarbeiter (PDF/HTML). */
router.get("/agent/app/dokument/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).end();
    const [d] = (await sqlPool`SELECT dateiname, mime, inhalt FROM fiaon_dokumente WHERE id = ${id} AND geloescht_am IS NULL LIMIT 1`) as any[];
    if (!d) return res.status(404).end();
    res.setHeader("Content-Type", d.mime || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${sauberName(d.dateiname, "dokument.pdf")}"`);
    res.send(Buffer.from(d.inhalt));
  } catch (e: any) {
    console.error("[APP] agent dokument:", e?.message || e);
    res.status(500).end();
  }
});

export default router;
