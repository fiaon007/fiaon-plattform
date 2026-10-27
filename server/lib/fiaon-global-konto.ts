// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER PERSÖNLICHE ZUGANG (E-423, 22.10.2026)
//
// Justin: „Der Kunde soll seinen eigenen Zugang bekommen, wo er sich anmeldet —
// mit E-Mail-Authentifizierung, also wir senden einen Code, das fühlt sich
// einfach besser an. Sobald ein Kunde einen Vertrag angenommen hat, soll er sein
// Passwort erstellen. Alle Kunden, die jetzt aktiv sind mit unterschriebenen
// Verträgen (die beiden Bestandskunden), sollen eine Mail mit ihrem eigenen Link
// bekommen, wo sie ihren Zugang festlegen."
//
// ── DER WEG ───────────────────────────────────────────────────────────────
//   Einladung (nach der Annahme automatisch, sonst Chefbüro › Global › Kundenzugänge
//   oder scripts/global-zugang-einladen.ts) → Mail „Zugang einrichten“ (Link 7 Tage)
//   → /business/zugang#e=… : Name und Firma, Passwort zweimal → Code per Mail →
//   Code eingeben → Sitzung (Cookie) → „Mein Auftrag“ bzw. /business/konto.
//   Danach: /business/login — E-Mail + Passwort → Code → Sitzung.
//
// ── GANZ GETRENNT VOM PRIVATKUNDENBEREICH ─────────────────────────────────
// Eigene Tabellen (fiaon_global_konten …), eigenes Cookie (fiaon_global_sitzung),
// eigene Mails. Diese Datei liest fiaon_persons, fiaon_applications und
// fiaon_global_* nur — sie schreibt nie in Privatkunden-Tabellen, legt keine
// Person an und löst keine Privatkunden-Mail, keine Erinnerung und nichts bei
// Mara aus (Wand: scripts/pruef-global-kunde.ts, E-272). Wiederverwendet wird
// nur das Passwort-Verfahren des Hauses (scrypt, passwortHashen in
// fiaon-kunde-session.ts) — ohne dessen Klartext-Rückfall.
//
// ── WAS EIN KONTO SIEHT ───────────────────────────────────────────────────
// Die VERKNÜPFUNGEN in fiaon_global_konto_refs: art „auftrag“ (eine Akte in
// fiaon_global_auftraege) oder „angebot“ (eine Annahme in fiaon_global_angebote —
// deren auftrag_ref gehört automatisch dazu, auch wenn die Akte erst später
// entsteht). Eine Person kann mehrere Aufträge und Angebote haben.
//
// ── NICHTS WIRD GELÖSCHT ──────────────────────────────────────────────────
// Sitzungen enden (beendet_am), Codes verfallen (verworfen_am/eingeloest_am),
// Verknüpfungen werden entfernt (entfernt_am). Jede Anmeldung, jeder falsche
// Versuch und jede Einladung steht in fiaon_global_konto_protokoll.
//
// Tabellen: db/migrations/122_global_konten.sql — dieselbe DDL in ensureGlobalKonto.
// ═══════════════════════════════════════════════════════════════════════════
import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { escapeHtml } from "./fiaon-html-pdf";
import { passwortHashen, passwortPasst, istGehasht } from "./fiaon-kunde-session";
import {
  KONTO_CODE_MINUTEN, KONTO_EINLADUNG_TAGE, KONTO_PASSWORT_LINK_MINUTEN, KONTO_PFADE, KONTO_SAETZE, KONTO_SITZUNG_KURZ_STUNDEN,
  KONTO_SITZUNG_TAGE, KONTO_FEHLVERSUCHE, KONTO_SPERRE_MINUTEN, emailMaske, kontoEmail, kontoWeiterSicher, passwortBewerten,
  type KontoMail, type KontoSprache,
} from "@shared/fiaon-global-konto";
import {
  KONTO_COOKIE, KONTO_VORGANG_MUSTER, kontoCodeErzeugen, kontoCodeEingabe, kontoCodeGueltigBis, kontoCodeHash, kontoCodeNeuUrteil,
  kontoCodeUrteil, kontoFenster, kontoLinkErzeugen, kontoLinkPruefen, kontoNonceErzeugen, kontoSitzungErzeugen, kontoSitzungHash,
  kontoSperre, kontoVorgangErzeugen, kontoVorgangHash, type KontoLinkArt,
} from "./fiaon-global-konto-regeln";
import { paket as katalogPaket } from "@shared/fiaon-pakete";

type Lauf = typeof sqlPool;
export type KontoStatus = "eingeladen" | "aktiv" | "gesperrt";
export type KontoZeile = {
  id: number; email: string; name: string | null; anrede: string | null; nachname: string | null; firma: string | null; sprache: KontoSprache;
  passwort_hash: string | null; status: KontoStatus; einladung_nonce: string | null; passwort_nonce: string | null;
  eingeladen_am: Date | null; einladung_anzahl: number; eingerichtet_am: Date | null; letzte_anmeldung_am: Date | null;
  fehlversuche: number; gesperrt_bis: Date | null;
};
type Erg<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; status: number; error: string; code?: string };
const nein = (status: number, error: string, code?: string) => ({ ok: false as const, status, error, ...(code ? { code } : {}) });
const spr = (s: unknown): KontoSprache => (String(s ?? "").toLowerCase() === "en" ? "en" : "de");
const S = (s: KontoSprache) => KONTO_SAETZE[s];
function json<T>(v: unknown, leer: T): T {
  let x: unknown = v;
  for (let i = 0; i < 2 && typeof x === "string"; i++) { try { x = JSON.parse(x); } catch { return leer; } }
  return (x && typeof x === "object" ? x : leer) as T;
}

// ═══ SCHEMA ══════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
let angeboteDa = false;
export function ensureGlobalKonto(lauf: Lauf = sqlPool): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_global_konten (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL CHECK (email = LOWER(email)),
          name TEXT, anrede TEXT, nachname TEXT, firma TEXT,
          sprache TEXT NOT NULL DEFAULT 'de' CHECK (sprache IN ('de', 'en')),
          passwort_hash TEXT CHECK (passwort_hash IS NULL OR passwort_hash LIKE 'scrypt$%'),
          status TEXT NOT NULL DEFAULT 'eingeladen' CHECK (status IN ('eingeladen', 'aktiv', 'gesperrt')),
          einladung_nonce TEXT, passwort_nonce TEXT,
          eingeladen_am TIMESTAMPTZ, einladung_anzahl INTEGER NOT NULL DEFAULT 0, einladung_von TEXT,
          eingerichtet_am TIMESTAMPTZ, passwort_geaendert_am TIMESTAMPTZ, letzte_anmeldung_am TIMESTAMPTZ,
          fehlversuche INTEGER NOT NULL DEFAULT 0, gesperrt_bis TIMESTAMPTZ,
          quelle TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_global_konten_email_uidx ON fiaon_global_konten (email)`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_global_konto_refs (
          id BIGSERIAL PRIMARY KEY,
          konto_id BIGINT NOT NULL REFERENCES fiaon_global_konten(id),
          art TEXT NOT NULL CHECK (art IN ('auftrag', 'angebot')),
          ref TEXT NOT NULL,
          quelle TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          entfernt_am TIMESTAMPTZ,
          UNIQUE (konto_id, art, ref)
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_global_konto_refs_ref_idx ON fiaon_global_konto_refs (ref)`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_global_konto_codes (
          id BIGSERIAL PRIMARY KEY,
          konto_id BIGINT NOT NULL REFERENCES fiaon_global_konten(id),
          zweck TEXT NOT NULL CHECK (zweck IN ('anmeldung', 'einrichtung', 'passwort')),
          vorgang_hash TEXT NOT NULL UNIQUE,
          code_hash TEXT NOT NULL,
          gueltig_bis TIMESTAMPTZ NOT NULL,
          versuche INTEGER NOT NULL DEFAULT 0,
          neu_gesendet INTEGER NOT NULL DEFAULT 0,
          letzter_versand_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          bleiben BOOLEAN NOT NULL DEFAULT TRUE,
          neues_passwort_hash TEXT,
          link_nonce TEXT,
          eingeloest_am TIMESTAMPTZ, verworfen_am TIMESTAMPTZ,
          ip TEXT, user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_global_konto_codes_konto_idx ON fiaon_global_konto_codes (konto_id, created_at DESC)`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_global_konto_sitzungen (
          id BIGSERIAL PRIMARY KEY,
          konto_id BIGINT NOT NULL REFERENCES fiaon_global_konten(id),
          token_hash TEXT NOT NULL UNIQUE,
          bleiben BOOLEAN NOT NULL DEFAULT TRUE,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          zuletzt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          gueltig_bis TIMESTAMPTZ NOT NULL,
          beendet_am TIMESTAMPTZ, beendet_grund TEXT,
          ip TEXT, user_agent TEXT
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_global_konto_sitzungen_konto_idx ON fiaon_global_konto_sitzungen (konto_id, beendet_am)`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_global_konto_protokoll (
          id BIGSERIAL PRIMARY KEY,
          konto_id BIGINT,
          email_hash TEXT,
          ereignis TEXT NOT NULL,
          erfolg BOOLEAN NOT NULL DEFAULT TRUE,
          ip TEXT, user_agent TEXT,
          details JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_global_konto_protokoll_konto_idx ON fiaon_global_konto_protokoll (konto_id, created_at DESC)`;
      const [t] = (await lauf`SELECT to_regclass('public.fiaon_global_angebote') AS angebote`) as any[];
      angeboteDa = !!t?.angebote;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ═══ PROTOKOLL ═══════════════════════════════════════════════════════════════
const emailHash = (email: string) => createHash("sha256").update(`global-konto-email.${email}`).digest("hex");
/** Eine Zeile ins Anmeldeprotokoll — nie die Adresse im Klartext, wenn es kein Konto dazu gibt. Wirft nie. */
export async function kontoProtokoll(e: { kontoId?: number | null; email?: string | null; ereignis: string; erfolg?: boolean; ip?: string | null; ua?: string | null; details?: Record<string, unknown> }): Promise<void> {
  try {
    await sqlPool`
      INSERT INTO fiaon_global_konto_protokoll (konto_id, email_hash, ereignis, erfolg, ip, user_agent, details)
      VALUES (${e.kontoId ?? null}, ${e.email ? emailHash(e.email) : null}, ${e.ereignis}, ${e.erfolg !== false}, ${e.ip ?? null},
              ${String(e.ua ?? "").slice(0, 300) || null}, ${e.details ? sqlPool.json(e.details as any) : null})`;
  } catch (err) { console.error("[GLOBAL-KONTO] Protokoll:", err instanceof Error ? err.message : err); }
}

// ═══ DIE MAILS ═══════════════════════════════════════════════════════════════
/** „Guten Tag Herr Muster“ / „Dear Mr Muster“ — wie die übrigen Global-Mails. */
export function kontoAnredeZeile(k: Pick<KontoZeile, "anrede" | "nachname" | "name" | "sprache">): string {
  const nach = String(k.nachname || "").trim();
  const voll = String(k.name || "").trim();
  if (k.sprache === "en") {
    if ((k.anrede === "Herr" || k.anrede === "Frau") && nach) return `Dear ${k.anrede === "Herr" ? "Mr" : "Ms"} ${nach}`;
    return voll ? `Dear ${voll}` : "Good day";
  }
  if ((k.anrede === "Herr" || k.anrede === "Frau") && nach) return `Guten Tag ${k.anrede} ${nach}`;
  return voll ? `Guten Tag ${voll}` : "Guten Tag";
}

/** Die Nutzlast einer Zugangs-Mail — REIN, damit der Prüfstand jede Vorlage mit echten Feldern rendern kann. */
export function kontoMailNutzlast(k: Pick<KontoZeile, "email" | "anrede" | "nachname" | "name" | "firma" | "sprache">, zusatz: Record<string, string> = {}): Record<string, string> {
  const en = k.sprache === "en";
  return {
    email: k.email,
    sprache: k.sprache,
    anrede_zeile: escapeHtml(kontoAnredeZeile(k as any)),
    kunde: escapeHtml(String(k.firma || k.name || (en ? "your order" : "Ihren Auftrag"))),
    ...zusatz,
  };
}

/** Code und Links gehören nicht ins Protokoll. Nur lokal (127.0.0.1, nie Produktion) darf ein Prüfstand sie lesen. */
export function kontoKlartextImProtokoll(): boolean {
  if (process.env.GLOBAL_KONTO_PROTOKOLL_KLARTEXT !== "1" || process.env.NODE_ENV === "production") return false;
  try { return ["127.0.0.1", "localhost"].includes(new URL(String(process.env.DATABASE_URL || "")).hostname); } catch { return false; }
}
const GEHEIME_FELDER = ["login_code", "einrichten_url", "passwort_url"];

/**
 * Schickt eine der drei Zugangs-Mails — direkt über den Motor, nie über Make, immer ins Protokoll (fiaon_mail_log).
 *
 * DIE AUTOMATIK-WAND (E-301/E-272): An die Kundin eines Firmenangebots geht sonst keine automatische Mail
 * (firmaGlobalMailSperre in fiaon-global-firma-post.ts). Diese drei sind dort AUSDRÜCKLICH ausgenommen
 * (KONTO_MAILS in FIRMA_ANGEFORDERT): Ein Code, den die Kundin selbst anfordert, und die Einladung nach IHRER
 * Annahme sind keine Werbung und keine Erinnerung, sondern die Tür zu ihrem eigenen Bereich. Die Wand wird hier
 * trotzdem gefragt — fällt die Ausnahme dort je weg, sperrt sie hier sichtbar (Protokoll „uebersprungen“), statt
 * still zu versenden; der Prüfstand pruef-global-login.ts hält die Ausnahme fest.
 */
export async function kontoMailSenden(event: KontoMail, k: KontoZeile, zusatz: Record<string, string>, opts: { ausgeloestVon?: string; weg?: KontoMailWeg } = {}): Promise<{ ok: boolean; grund: string | null }> {
  const nutzlast = kontoMailNutzlast(k, zusatz);
  const von = opts.ausgeloestVon ?? "System (FIAON Global, Zugang)";
  let ok = false; let grund: string | null = null; let messageId: string | null = null; let gesperrt = false; let ueber: KontoMailWeg = "brevo";
  try {
    const F = await import("./fiaon-global-firma-post");
    if (await F.firmaGlobalMailSperre(event, null, k.email, von)) { gesperrt = true; grund = F.FIRMA_KEINE_AUTOMATIK; }
  } catch (e) { console.error("[GLOBAL-KONTO] Automatik-Wand nicht prüfbar — lasse durch:", e instanceof Error ? e.message : e); }
  // Lokaler Prüfstand (127.0.0.1, nie Produktion, Schalter gesetzt) OHNE Mail-Schlüssel: nichts verschicken, aber den Weg
  // weitergehen lassen — die Mail steht mit Inhalt im Protokoll („uebersprungen“), der Prüfstand liest den Code dort.
  const nurProtokoll = !gesperrt && !process.env.BREVO_API_KEY && kontoKlartextImProtokoll();
  if (nurProtokoll) { ok = true; grund = "Prüfstand: nicht verschickt, nur protokolliert (kein BREVO_API_KEY)"; }
  if (!gesperrt && !nurProtokoll) {
    // E-441 (27.10.2026): Zwei Wege. Brevo nahm Codes an iCloud an („sent“), stellte sie aber über eine Stunde nicht zu —
    // der Kunde kam nicht weiter. Apple-Postfächer gehen deshalb zuerst über Google Workspace (Postfach des Absenders),
    // alle anderen zuerst über Brevo; scheitert ein Weg, nimmt der andere die Mail. „Code neu senden“ heißt meist: der
    // erste kam nicht an — dann geht derselbe Code über BEIDE Wege.
    // Ohne Brevo-Schlüssel (Prüfstand, Vorschau) bleibt es beim alten Weg — dort soll auch Google nichts verschicken.
    const an = String(nutzlast.email ?? "").trim();
    const wunsch = opts.weg ?? kontoMailWegFuer(k.email);
    const reihe: Array<"brevo" | "google"> = !process.env.BREVO_API_KEY || !adresseSiehtGueltigAus(an) ? ["brevo"]
      : wunsch === "brevo" ? ["brevo", "google"] : ["google", "brevo"];
    const gruende: string[] = []; const genommen: Array<"brevo" | "google"> = [];
    for (const w of reihe) {
      const erg = await kontoMailUeber(w, event, nutzlast);
      if (erg.ok) {
        ok = true; genommen.push(w); if (w === "brevo") messageId = erg.messageId;
        if (erg.grund) gruende.push(erg.grund);
        if (wunsch !== "beide") break;
      } else gruende.push(`${w}: ${erg.grund || "unbekannt"}`);
    }
    ueber = genommen.length > 1 ? "beide" : genommen[0] ?? "brevo";
    grund = [...gruende, ok && ueber !== "brevo" ? `Weg: ${ueber === "beide" ? "Brevo und Google Workspace" : "Google Workspace"}` : null].filter(Boolean).join(" · ") || null;
  }
  try {
    const klar = kontoKlartextImProtokoll();
    const payload: Record<string, unknown> = { ...nutzlast, versandweg: ueber };
    if (!klar) for (const f of GEHEIME_FELDER) if (payload[f]) payload[f] = "[verborgen]";
    const { mailProtokoll } = await import("./fiaon-mail-log");
    await mailProtokoll({
      event, personId: null, empfaenger: k.email,
      status: nurProtokoll ? "uebersprungen" : ok ? "versandt" : gesperrt ? "uebersprungen" : "fehlgeschlagen", grund: ok ? grund : (grund || "unbekannt"),
      payload, ausgeloestVon: von, brevoMessageId: messageId,
    });
  } catch (e) { console.error(`[GLOBAL-KONTO] Mailprotokoll ${event}:`, e); }
  return { ok, grund: ok ? null : (grund || "unbekannt") };
}

/** „beide“ = derselbe Code über Brevo UND Google Workspace (nach „Code neu senden“). Steht als payload.versandweg im Protokoll. */
export type KontoMailWeg = "brevo" | "google" | "beide";
/** Apple-Postfächer (iCloud) bekommen Zugangs-Mails zuerst über Google Workspace (E-441). */
export function kontoMailWegFuer(email: string): KontoMailWeg {
  return /@(icloud|me|mac)\.com$/i.test(String(email || "").trim()) ? "google" : "brevo";
}
// Dieselbe Regel wie der Motor (mailDirektSenden): genau eine Adresse, ohne Leerzeichen — sonst geht auf keinem Weg etwas raus.
const adresseSiehtGueltigAus = (an: string) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(an);
async function kontoMailUeber(weg: "brevo" | "google", event: KontoMail, nutzlast: Record<string, unknown>): Promise<{ ok: boolean; messageId: string | null; grund: string | null }> {
  try {
    if (weg === "brevo") {
      const { mailDirektSenden } = await import("../mail/motor");
      const erg = await mailDirektSenden(event, nutzlast);
      return { ok: erg.ok, messageId: erg.messageId ?? null, grund: erg.ok ? (erg.grund ?? null) : (erg.grund || "unbekannt") };
    }
    const { mailRendern } = await import("../mail/motor");
    const G = await import("./fiaon-gmail");
    if (!G.gmailBereit()) return { ok: false, messageId: null, grund: "GOOGLE_SA_KEY fehlt" };
    const mail = mailRendern(event, nutzlast);
    if (!mail) return { ok: false, messageId: null, grund: `Keine Vorlage für '${event}' im Motor.` };
    const an = String(nutzlast.email ?? "").trim();
    // Wie Brevo höchstens 15 Sekunden — hängt Google, kommt der andere Weg dran, statt dass der Kunde wartet.
    const id = await Promise.race([
      G.neueMailSenden(mail.absender.email, { vonName: mail.absender.name, an, betreff: mail.betreff, text: mail.text, html: mail.html }),
      new Promise<string>((_, nein) => setTimeout(() => nein(new Error("Google: keine Antwort in 15 Sekunden")), 15_000)),
    ]);
    if (!id) return { ok: false, messageId: null, grund: "Google hat keine Nachrichten-ID geliefert" };
    // Code und Links sollen nicht im Gesendet-Ordner des Postfachs stehen bleiben (dort lesen Team und Postmeister mit):
    // die Kopie geht in den Papierkorb (gmail.modify, kein endgültiges Löschen). Scheitert das, ist die Mail trotzdem raus.
    await G.nachrichtInPapierkorb(mail.absender.email, id).catch((e) => console.error("[GLOBAL-KONTO] Gesendet-Kopie nicht im Papierkorb:", e instanceof Error ? e.message : e));
    return { ok: true, messageId: id, grund: null };
  } catch (e) { return { ok: false, messageId: null, grund: e instanceof Error ? e.message : String(e) }; }
}

const tagText = (d: Date, s: KontoSprache) => d.toLocaleDateString(s === "en" ? "en-GB" : "de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
const CODE_ANLASS: Record<"anmeldung" | "einrichtung" | "passwort", Record<KontoSprache, string>> = {
  anmeldung: { de: "für die Anmeldung", en: "for signing in" },
  einrichtung: { de: "zum Bestätigen Ihres neuen Zugangs", en: "to confirm your new access" },
  passwort: { de: "zum Bestätigen Ihres neuen Passworts", en: "to confirm your new password" },
};

// ═══ KONTO ═══════════════════════════════════════════════════════════════════
const KONTO_SPALTEN = `id, email, name, anrede, nachname, firma, sprache, passwort_hash, status, einladung_nonce, passwort_nonce, eingeladen_am,
  einladung_anzahl, eingerichtet_am, letzte_anmeldung_am, fehlversuche, gesperrt_bis`;
function kontoAus(z: any): KontoZeile | null {
  if (!z) return null;
  return { ...z, id: Number(z.id), sprache: spr(z.sprache), einladung_anzahl: Number(z.einladung_anzahl || 0), fehlversuche: Number(z.fehlversuche || 0) } as KontoZeile;
}
export async function kontoLesen(id: number, lauf: Lauf = sqlPool): Promise<KontoZeile | null> {
  await ensureGlobalKonto();
  const [z] = (await lauf.unsafe(`SELECT ${KONTO_SPALTEN} FROM fiaon_global_konten WHERE id = $1`, [id])) as any[];
  return kontoAus(z);
}
export async function kontoNachEmail(email: string, lauf: Lauf = sqlPool): Promise<KontoZeile | null> {
  await ensureGlobalKonto();
  const [z] = (await lauf.unsafe(`SELECT ${KONTO_SPALTEN} FROM fiaon_global_konten WHERE email = $1`, [email])) as any[];
  return kontoAus(z);
}

export interface KundeAngaben { email: string; name?: string | null; anrede?: string | null; nachname?: string | null; firma?: string | null; sprache?: KontoSprache; refs: { art: "auftrag" | "angebot"; ref: string }[] }

/** Legt das Konto an (Status „eingeladen“, ohne Passwort) oder findet es. Name und Firma füllen nur Lücken. */
export async function kontoSicherstellen(k: KundeAngaben, quelle: string, lauf: Lauf = sqlPool): Promise<KontoZeile> {
  await ensureGlobalKonto();
  const email = kontoEmail(k.email);
  if (!email) throw new Error("keine gültige E-Mail-Adresse");
  const [z] = (await lauf.unsafe(`
    INSERT INTO fiaon_global_konten (email, name, anrede, nachname, firma, sprache, quelle)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(fiaon_global_konten.name, EXCLUDED.name), anrede = COALESCE(fiaon_global_konten.anrede, EXCLUDED.anrede),
      nachname = COALESCE(fiaon_global_konten.nachname, EXCLUDED.nachname), firma = COALESCE(fiaon_global_konten.firma, EXCLUDED.firma),
      updated_at = NOW()
    RETURNING ${KONTO_SPALTEN}`,
  [email, k.name?.trim() || null, k.anrede?.trim() || null, k.nachname?.trim() || null, k.firma?.trim() || null, k.sprache ?? "de", quelle])) as any[];
  const konto = kontoAus(z)!;
  for (const r of k.refs) await refVerknuepfen(konto.id, r.art, r.ref, quelle, lauf);
  return konto;
}

export async function refVerknuepfen(kontoId: number, art: "auftrag" | "angebot", ref: string, quelle: string, lauf: Lauf = sqlPool): Promise<boolean> {
  const r = String(ref || "").trim();
  if (!r) return false;
  const neu = (await lauf`
    INSERT INTO fiaon_global_konto_refs (konto_id, art, ref, quelle) VALUES (${kontoId}, ${art}, ${r}, ${quelle})
    ON CONFLICT (konto_id, art, ref) DO UPDATE SET entfernt_am = NULL
    RETURNING (xmax = 0) AS neu`) as any[];
  return !!neu[0]?.neu;
}

// ═══ WER GEHÖRT WOZU — aus Angebot, Akte oder Adresse ═════════════════════════
/** Name, Firma und Adresse aus dem Kundenblock eines Angebots (Individual, Begleit, Firma, Kapital — alle Formen). */
export function kundeAusAngebotJson(kundeRoh: unknown): { email: string | null; name: string | null; anrede: string | null; nachname: string | null; firma: string | null } {
  const k = json<Record<string, any>>(kundeRoh, {});
  const v = k.vertretung && typeof k.vertretung === "object" ? k.vertretung : k;
  const vor = String(v.vorname || "").trim(); const nach = String(v.nachname || "").trim();
  const firma = k.firma && typeof k.firma === "object" ? String(k.firma.name || "").trim() : (k.art === "firma" && typeof k.firma === "string" ? k.firma.trim() : "");
  return {
    email: kontoEmail(k.email),
    name: [vor, nach].filter(Boolean).join(" ") || (typeof k.name === "string" ? k.name.trim() : "") || null,
    anrede: v.anrede ? String(v.anrede).trim() : null, nachname: nach || null, firma: firma || null,
  };
}

/** Aus einer angenommenen Annahme: die Angaben für das Konto. Kooperationsverträge (IA-KOOP-) haben ihren eigenen Partnerbereich. */
export async function kundeAusAngebot(angebotRef: string, lauf: Lauf = sqlPool): Promise<KundeAngaben | null> {
  await ensureGlobalKonto();
  if (!angeboteDa) return null;
  const [a] = (await lauf`
    SELECT angebot_ref, fassung, status, kunde, sprache, auftrag_ref FROM fiaon_global_angebote WHERE angebot_ref = ${angebotRef} LIMIT 1`) as any[];
  if (!a || String(a.status) !== "angenommen" || String(a.fassung || "").startsWith("IA-KOOP-")) return null;
  const k = kundeAusAngebotJson(a.kunde);
  if (!k.email) return null;
  return { ...k, email: k.email, sprache: spr(a.sprache), refs: [{ art: "angebot", ref: String(a.angebot_ref) }, ...(a.auftrag_ref ? [{ art: "auftrag" as const, ref: String(a.auftrag_ref) }] : [])] };
}

/** Aus einer Akte (fiaon_global_auftraege): die Angaben für das Konto — die Adresse des Auftrags, nie eine geratene. */
export async function kundeAusAuftrag(ref: string, lauf: Lauf = sqlPool): Promise<KundeAngaben | null> {
  await ensureGlobalKonto();
  const [g] = (await lauf`
    SELECT g.ref, g.email, g.firma, g.firma_name, g.ansprechpartner, g.vertrag_sprache, g.status, g.angebot_id,
           a.contact_email, a.email AS antrag_email
      FROM fiaon_global_auftraege g LEFT JOIN fiaon_applications a ON a.ref = g.ref
     WHERE g.ref = ${ref} LIMIT 1`) as any[];
  if (!g || String(g.status) === "storniert") return null;
  const ap = json<Record<string, any>>(g.ansprechpartner, {});
  const firma = json<Record<string, any>>(g.firma, {});
  const email = kontoEmail(g.email) ?? kontoEmail(ap.email) ?? kontoEmail(g.contact_email) ?? kontoEmail(g.antrag_email);
  if (!email) return null;
  const vor = String(ap.vorname || "").trim(); const nach = String(ap.nachname || "").trim();
  return {
    email, name: [vor, nach].filter(Boolean).join(" ") || null, anrede: ap.anrede ? String(ap.anrede) : null, nachname: nach || null,
    firma: firma.art === "privat" ? null : (String(firma.name || g.firma_name || "").trim() || null),
    sprache: spr(g.vertrag_sprache), refs: [{ art: "auftrag", ref: String(g.ref) }],
  };
}

const ANGEBOT_EMAIL_SQL = `LOWER(TRIM(COALESCE(a.kunde->>'email', CASE WHEN jsonb_typeof(a.kunde) = 'string' THEN (a.kunde #>> '{}')::jsonb ->> 'email' END, '')))`;

/**
 * Alles, was zu einer Adresse gehört: Akten (Adresse der Akte, der Bestellung oder der Person) und angenommene Angebote
 * (ohne Kooperation). Für Chefbüro und Einladungs-Skript — die Adresse ist der Suchschlüssel, eingeladen wird an sie.
 */
export async function kandidatenFuerEmail(emailRoh: string, lauf: Lauf = sqlPool): Promise<{ auftraege: { ref: string; titel: string; status: string }[]; angebote: { ref: string; fassung: string; auftragRef: string | null; angenommenAm: string | null }[] }> {
  await ensureGlobalKonto();
  const email = kontoEmail(emailRoh);
  if (!email) return { auftraege: [], angebote: [] };
  const [t] = (await lauf`SELECT to_regclass('public.fiaon_global_auftraege') AS akten`) as any[];
  const auftraege = t?.akten ? ((await lauf`
    SELECT g.ref, g.paket_key, g.firma_name, g.status, a.pack_name
      FROM fiaon_global_auftraege g
      LEFT JOIN fiaon_applications a ON a.ref = g.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE g.status <> 'storniert'
       AND ${email} IN (LOWER(TRIM(COALESCE(g.email, ''))), LOWER(TRIM(COALESCE(g.ansprechpartner->>'email', ''))), LOWER(TRIM(COALESCE(a.email, ''))),
                        LOWER(TRIM(COALESCE(a.contact_email, ''))), LOWER(TRIM(COALESCE(p.primary_email, ''))))
     ORDER BY g.created_at`) as any[]) : [];
  const angebote = angeboteDa ? ((await lauf.unsafe(`
    SELECT a.angebot_ref, a.fassung, a.auftrag_ref, a.angenommen_am FROM fiaon_global_angebote a
     WHERE a.status = 'angenommen' AND a.fassung NOT LIKE 'IA-KOOP-%' AND ${ANGEBOT_EMAIL_SQL} = $1
     ORDER BY a.angenommen_am`, [email])) as any[]) : [];
  return {
    auftraege: auftraege.map((g) => ({ ref: String(g.ref), titel: String(((katalogPaket(g.paket_key)?.preisJeAngebot ? g.pack_name : "") || katalogPaket(g.paket_key)?.label || g.pack_name || g.paket_key)), status: String(g.status) })),
    angebote: angebote.map((a) => ({ ref: String(a.angebot_ref), fassung: String(a.fassung), auftragRef: a.auftrag_ref ? String(a.auftrag_ref) : null, angenommenAm: a.angenommen_am ? new Date(a.angenommen_am).toISOString() : null })),
  };
}

// ═══ EINLADUNG ═══════════════════════════════════════════════════════════════
export function kontoZugangPfad(s: KontoSprache, art: KontoLinkArt, token: string): string {
  return `${KONTO_PFADE[s].zugang}#${art === "einladung" ? "e" : "p"}=${encodeURIComponent(token)}`;
}

/**
 * Schickt die Einladung — mit FRISCHER Einmal-Marke (ein älterer Einladungslink gilt danach nicht mehr).
 *
 * `nurLink` (Justin, 22.10.2026, für die Bestandskunden): KEINE Systemmail — der Link wird nur erzeugt und
 * zurückgegeben, damit die Assistenz ihn in eine persönliche Mail (Gmail-Entwurf) setzt. Vermerkt wird es trotzdem:
 * im Anmeldeprotokoll („einladung_link“, von Hand verschickt) und im Verlauf jeder verknüpften Akte und jedes Angebots.
 */
export async function einladungSenden(kontoId: number, opts: { von?: string; nurLink?: boolean } = {}): Promise<{ ok: boolean; grund: string | null; gueltigBis?: string; link?: string }> {
  const nonce = kontoNonceErzeugen();
  const [z] = (await sqlPool.unsafe(`
    UPDATE fiaon_global_konten SET einladung_nonce = $2, eingeladen_am = NOW(), einladung_anzahl = einladung_anzahl + 1, einladung_von = $3, updated_at = NOW()
     WHERE id = $1 AND status <> 'gesperrt' RETURNING ${KONTO_SPALTEN}`, [kontoId, nonce, opts.von ?? "System"])) as any[];
  const k = kontoAus(z);
  if (!k) return { ok: false, grund: "Zugang gesperrt oder nicht gefunden" };
  const ttl = KONTO_EINLADUNG_TAGE * 24 * 60 * 60 * 1000;
  const bis = new Date(Date.now() + ttl);
  const token = kontoLinkErzeugen("einladung", k.id, nonce, ttl);
  const link = absoluteUrl(kontoZugangPfad(k.sprache, "einladung", token));
  if (opts.nurLink) {
    await kontoProtokoll({ kontoId: k.id, ereignis: "einladung_link", details: { von: opts.von ?? "System", versand: "von Hand (persönliche Mail)", gueltigBis: bis.toISOString() } });
    await einladungImVerlauf(k.id, `Einladungslink „Zugang einrichten“ erzeugt (gültig bis ${tagText(bis, "de")}) — von Hand verschickt, keine Systemmail (${opts.von ?? "System"}).`, opts.von ?? "System");
    return { ok: true, grund: null, gueltigBis: bis.toISOString(), link };
  }
  const mail = await kontoMailSenden("global_zugang_einladung", k, {
    einrichten_url: link,
    email_anzeige: escapeHtml(k.email),
    gueltig_text: escapeHtml(tagText(bis, k.sprache)),
  }, { ausgeloestVon: opts.von });
  await kontoProtokoll({ kontoId: k.id, ereignis: "einladung", erfolg: mail.ok, details: { von: opts.von ?? "System", grund: mail.grund } });
  if (mail.ok) await einladungImVerlauf(k.id, `Einladung „Zugang einrichten“ per E-Mail an ${k.email} geschickt (gültig bis ${tagText(bis, "de")}).`, opts.von ?? "System");
  return { ok: mail.ok, grund: mail.grund, gueltigBis: bis.toISOString() };
}

/** Vermerk im Verlauf jeder verknüpften Akte (Kundenverlauf) und jedes verknüpften Angebots. Wirft nie. */
async function einladungImVerlauf(kontoId: number, text: string, wer: string): Promise<void> {
  try {
    const refs = (await sqlPool`SELECT art, ref FROM fiaon_global_konto_refs WHERE konto_id = ${kontoId} AND entfernt_am IS NULL`) as any[];
    const A = await import("./fiaon-global-auftrag");
    for (const r of refs.filter((x) => x.art === "auftrag")) await A.globalVerlauf(String(r.ref), `FIAON Global: ${text}`);
    if (angeboteDa) {
      const ang = (await sqlPool`SELECT id FROM fiaon_global_angebote WHERE angebot_ref = ANY(${refs.filter((x) => x.art === "angebot").map((x) => String(x.ref))})`) as any[];
      if (ang.length) { const W = await import("./fiaon-global-angebot"); for (const a of ang) await W.verlaufAngebot(Number(a.id), wer, text); }
    }
  } catch (e) { console.error("[GLOBAL-KONTO] Verlauf der Einladung:", e instanceof Error ? e.message : e); }
}

/**
 * Nach der Annahme eines Vertrags (Paketauftrag, Individual-, Begleit-, Firmen-, Kapital-Angebot): Konto anlegen,
 * Auftrag/Angebot verknüpfen, Einladung schicken — außer der Zugang ist schon eingerichtet (dann nur verknüpfen:
 * der neue Auftrag steht beim nächsten Anmelden in seiner Übersicht) oder er wurde in den letzten 24 Stunden schon
 * eingeladen. Wirft nie: Eine Annahme darf an dieser Mail nicht scheitern.
 */
export async function globalKontoNachAnnahme(q: { angebotRef?: string | null; auftragRef?: string | null }, opts: { von?: string } = {}): Promise<{ ergebnis: "eingeladen" | "verknuepft" | "keine_adresse" | "fehler"; grund?: string }> {
  try {
    const kunde = q.angebotRef ? await kundeAusAngebot(q.angebotRef) : q.auftragRef ? await kundeAusAuftrag(q.auftragRef) : null;
    if (!kunde) return { ergebnis: "keine_adresse" };
    const konto = await kontoSicherstellen(kunde, q.angebotRef ? "annahme_angebot" : "annahme_auftrag");
    if (konto.status !== "eingeladen") return { ergebnis: "verknuepft" };
    if (konto.eingeladen_am && Date.now() - new Date(konto.eingeladen_am).getTime() < 24 * 60 * 60 * 1000) return { ergebnis: "verknuepft" };
    const mail = await einladungSenden(konto.id, { von: opts.von ?? "System (FIAON Global, Annahme)" });
    return mail.ok ? { ergebnis: "eingeladen" } : { ergebnis: "fehler", grund: mail.grund ?? undefined };
  } catch (e) {
    console.error("[GLOBAL-KONTO] Einladung nach der Annahme:", e instanceof Error ? e.message : e);
    return { ergebnis: "fehler", grund: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Von Hand (Chefbüro, Skript): alles zur Adresse verknüpfen und die Einladung schicken. Ein eingerichteter Zugang wird
 * nicht neu eingeladen — dann hilft „Passwort vergessen“.
 */
export async function globalKontoEinladen(emailRoh: string, von: string, opts: { trocken?: boolean; nurLink?: boolean } = {}): Promise<Erg<{ meldung: string; konto: { id: number | null; status: string }; refs: { art: string; ref: string }[]; link?: string; gueltigBis?: string }>> {
  const email = kontoEmail(emailRoh);
  if (!email) return nein(400, "Bitte eine gültige E-Mail-Adresse angeben.");
  const kand = await kandidatenFuerEmail(email);
  const refs = [
    ...kand.auftraege.map((a) => ({ art: "auftrag" as const, ref: a.ref })),
    ...kand.angebote.flatMap((a) => [{ art: "angebot" as const, ref: a.ref }, ...(a.auftragRef ? [{ art: "auftrag" as const, ref: a.auftragRef }] : [])]),
  ].filter((r, i, alle) => alle.findIndex((x) => x.art === r.art && x.ref === r.ref) === i);
  if (!refs.length) return nein(404, "Zu dieser Adresse gibt es keinen Global-Auftrag und kein angenommenes Angebot.");
  const vorher = await kontoNachEmail(email);
  if (vorher?.status === "aktiv") return nein(409, `Der Zugang ist schon eingerichtet (seit ${vorher.eingerichtet_am ? new Date(vorher.eingerichtet_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "—"}). Anmelden: fiaon.com/business/login — bei vergessenem Passwort hilft „Passwort vergessen“.`);
  if (vorher?.status === "gesperrt") return nein(409, "Dieser Zugang ist gesperrt.");
  if (opts.trocken) return { ok: true, meldung: `Trockenlauf: würde ${opts.nurLink ? `einen Einladungslink für ${email} erzeugen (ohne Mail)` : `${email} einladen`}.`, konto: { id: vorher?.id ?? null, status: vorher?.status ?? "keins" }, refs };
  // Name und Firma: aus dem ersten Angebot, sonst aus der ersten Akte.
  const quelle = kand.angebote[0] ? await kundeAusAngebot(kand.angebote[0].ref) : kand.auftraege[0] ? await kundeAusAuftrag(kand.auftraege[0].ref) : null;
  const konto = await kontoSicherstellen({ ...(quelle ?? {}), email, refs }, "von_hand");
  const mail = await einladungSenden(konto.id, { von, nurLink: opts.nurLink });
  if (!mail.ok) return nein(502, `Die Einladung ging nicht raus: ${mail.grund}`);
  if (opts.nurLink) return { ok: true, meldung: `Einladungslink für ${email} erzeugt — gültig bis ${tagText(new Date(mail.gueltigBis!), "de")}, einmal verwendbar. Es ging KEINE Mail raus; bitte persönlich schicken.`, konto: { id: konto.id, status: "eingeladen" }, refs, link: mail.link, gueltigBis: mail.gueltigBis };
  return { ok: true, meldung: `Einladung an ${email} geschickt — der Link gilt bis ${tagText(new Date(mail.gueltigBis!), "de")}.`, konto: { id: konto.id, status: "eingeladen" }, refs };
}

// ═══ ANMELDUNG ═══════════════════════════════════════════════════════════════
const sperre = kontoSperre();
const anmeldenJeIp = kontoFenster(30, 15 * 60_000);
const vergessenJeIp = kontoFenster(5, 15 * 60_000);
const vergessenJeEmail = kontoFenster(3, 60 * 60_000);
const codeJeIp = kontoFenster(30, 15 * 60_000);
/** Nur für Prüfstände: alle Bremsen leeren. */
export function kontoBremsenLeeren(): void { sperre.leeren(); anmeldenJeIp.leeren(); vergessenJeIp.leeren(); vergessenJeEmail.leeren(); codeJeIp.leeren(); }

// Ein Vergleichs-Hash, damit eine unbekannte Adresse genauso lange rechnet wie eine bekannte (keine Zeitmessung als Verrat).
let attrappe: string | null = null;
const attrappeHash = () => (attrappe ??= passwortHashen("fiaon-global-konto-attrappe-" + Date.now()));

async function codeAnlegen(k: KontoZeile, zweck: "anmeldung" | "einrichtung" | "passwort", ein: { bleiben: boolean; ip: string; ua: string; neuesPasswortHash?: string | null; linkNonce?: string | null }):
  Promise<{ vorgang: string; mailOk: boolean }> {
  const vorgang = kontoVorgangErzeugen();
  const code = kontoCodeErzeugen();
  // Ein neuer Vorgang macht die offenen desselben Kontos ungültig — es gilt immer nur der letzte Code.
  await sqlPool`UPDATE fiaon_global_konto_codes SET verworfen_am = NOW() WHERE konto_id = ${k.id} AND eingeloest_am IS NULL AND verworfen_am IS NULL`;
  await sqlPool`
    INSERT INTO fiaon_global_konto_codes (konto_id, zweck, vorgang_hash, code_hash, gueltig_bis, bleiben, neues_passwort_hash, link_nonce, ip, user_agent)
    VALUES (${k.id}, ${zweck}, ${kontoVorgangHash(vorgang)}, ${kontoCodeHash(vorgang, code)}, ${kontoCodeGueltigBis()}, ${ein.bleiben},
            ${ein.neuesPasswortHash ?? null}, ${ein.linkNonce ?? null}, ${ein.ip || null}, ${ein.ua.slice(0, 300) || null})`;
  const mail = await kontoMailSenden("global_login_code", k, { login_code: code, code_anlass: escapeHtml(CODE_ANLASS[zweck][k.sprache]) });
  await kontoProtokoll({ kontoId: k.id, ereignis: "code_gesendet", erfolg: mail.ok, ip: ein.ip, ua: ein.ua, details: { zweck, grund: mail.grund } });
  return { vorgang, mailOk: mail.ok };
}

export interface Anfrage { ip: string; ua: string; sprache?: KontoSprache }

/** Schritt 1: E-Mail und Passwort. Antwortet für unbekannte Adresse und falsches Passwort GLEICH. */
export async function kontoAnmelden(b: { email?: unknown; passwort?: unknown; bleiben?: unknown }, a: Anfrage): Promise<Erg<{ vorgang: string; maske: string; mailFehler?: boolean }>> {
  await ensureGlobalKonto();
  const s = a.sprache ?? "de";
  if (anmeldenJeIp.zuViel(a.ip || "?")) return nein(429, S(s).zuViele, "zu_viele");
  const email = kontoEmail(b.email);
  const passwort = String(b.passwort ?? "");
  if (!email || !passwort || passwort.length > 500) return nein(401, S(s).anmeldungFalsch, "falsch");
  if (sperre.gesperrt(email)) { await kontoProtokoll({ email, ereignis: "anmeldung_gesperrt", erfolg: false, ip: a.ip, ua: a.ua }); return nein(429, S(s).gesperrt, "gesperrt"); }
  const k = await kontoNachEmail(email);
  if (k?.gesperrt_bis && new Date(k.gesperrt_bis).getTime() > Date.now()) {
    await kontoProtokoll({ kontoId: k.id, ereignis: "anmeldung_gesperrt", erfolg: false, ip: a.ip, ua: a.ua });
    return nein(429, S(s).gesperrt, "gesperrt");
  }
  const darf = !!k && k.status === "aktiv" && istGehasht(k.passwort_hash);
  const passt = passwortPasst(darf ? k!.passwort_hash : attrappeHash(), passwort) && darf;
  if (!passt) {
    const n = sperre.fehlversuch(email);
    if (k) {
      await sqlPool`
        UPDATE fiaon_global_konten SET fehlversuche = fehlversuche + 1,
               gesperrt_bis = CASE WHEN ${n} >= ${KONTO_FEHLVERSUCHE} THEN NOW() + make_interval(mins => ${KONTO_SPERRE_MINUTEN}) ELSE gesperrt_bis END, updated_at = NOW()
         WHERE id = ${k.id}`;
    }
    await kontoProtokoll({ kontoId: k?.id ?? null, email: k ? null : email, ereignis: "anmeldung_falsch", erfolg: false, ip: a.ip, ua: a.ua, details: { versuch: n } });
    return nein(401, S(s).anmeldungFalsch, "falsch");
  }
  sperre.loeschen(email);
  await sqlPool`UPDATE fiaon_global_konten SET fehlversuche = 0, gesperrt_bis = NULL WHERE id = ${k!.id} AND (fehlversuche > 0 OR gesperrt_bis IS NOT NULL)`;
  const c = await codeAnlegen(k!, "anmeldung", { bleiben: b.bleiben !== false, ip: a.ip, ua: a.ua });
  return { ok: true, vorgang: c.vorgang, maske: emailMaske(k!.email, k!.sprache), ...(c.mailOk ? {} : { mailFehler: true }) };
}

/** Schritt 2: der Code. Bei Erfolg: Sitzung (Cookie setzt die Route) und das Ziel. */
export async function kontoCodePruefen(b: { vorgang?: unknown; code?: unknown }, a: Anfrage): Promise<Erg<{ sitzung: string; bleiben: boolean; weiter: string; kontoId: number }>> {
  await ensureGlobalKonto();
  const s = a.sprache ?? "de";
  if (codeJeIp.zuViel(a.ip || "?")) return nein(429, S(s).zuViele, "zu_viele");
  const vorgang = String(b.vorgang ?? "");
  if (!KONTO_VORGANG_MUSTER.test(vorgang)) return nein(400, S(s).codeVerbraucht, "verbraucht");
  const code = kontoCodeEingabe(b.code);
  const [z] = (await sqlPool`SELECT * FROM fiaon_global_konto_codes WHERE vorgang_hash = ${kontoVorgangHash(vorgang)} LIMIT 1`) as any[];
  if (!z) return nein(400, S(s).codeVerbraucht, "verbraucht");
  const k = await kontoLesen(Number(z.konto_id));
  const ks = k?.sprache ?? s;
  if (!k || k.status === "gesperrt") return nein(400, S(ks).codeVerbraucht, "verbraucht");
  const u = kontoCodeUrteil(z, vorgang, code);
  if (u.urteil === "verbraucht") return nein(400, S(ks).codeVerbraucht, "verbraucht");
  if (u.urteil === "abgelaufen") return nein(400, S(ks).codeAbgelaufen, "abgelaufen");
  if (u.urteil === "falsch" || u.urteil === "gesperrt") {
    await sqlPool`UPDATE fiaon_global_konto_codes SET versuche = versuche + 1, verworfen_am = CASE WHEN ${u.rest} <= 0 THEN NOW() ELSE verworfen_am END WHERE id = ${z.id} AND eingeloest_am IS NULL`;
    await kontoProtokoll({ kontoId: k.id, ereignis: "code_falsch", erfolg: false, ip: a.ip, ua: a.ua, details: { zweck: z.zweck, rest: u.rest } });
    return nein(400, S(ks).codeFalsch(u.rest), u.rest > 0 ? "falsch" : "gesperrt");
  }
  // Einlösen: genau einmal (ein Doppelklick findet die Zeile nicht mehr frei).
  const [frei] = (await sqlPool`UPDATE fiaon_global_konto_codes SET eingeloest_am = NOW() WHERE id = ${z.id} AND eingeloest_am IS NULL AND verworfen_am IS NULL RETURNING id`) as any[];
  if (!frei) return nein(400, S(ks).codeVerbraucht, "verbraucht");
  if (z.zweck === "einrichtung" || z.zweck === "passwort") {
    // Die Marke des Links muss noch die aktuelle sein — sonst hat inzwischen ein neuerer Link diesen abgelöst.
    const markeSpalte = z.zweck === "einrichtung" ? "einladung_nonce" : "passwort_nonce";
    const [neu] = (await sqlPool.unsafe(`
      UPDATE fiaon_global_konten SET passwort_hash = $2, status = 'aktiv', eingerichtet_am = COALESCE(eingerichtet_am, NOW()), passwort_geaendert_am = NOW(),
             ${markeSpalte} = NULL, fehlversuche = 0, gesperrt_bis = NULL, updated_at = NOW()
       WHERE id = $1 AND status <> 'gesperrt' AND ${markeSpalte} = $3 RETURNING id`, [k.id, z.neues_passwort_hash, z.link_nonce])) as any[];
    if (!neu) return nein(400, S(ks).linkUngueltig, "link");
    // Neues Passwort = alle anderen Sitzungen enden (wer das alte kannte, ist draußen).
    await sqlPool`UPDATE fiaon_global_konto_sitzungen SET beendet_am = NOW(), beendet_grund = 'passwort_neu' WHERE konto_id = ${k.id} AND beendet_am IS NULL`;
    await kontoProtokoll({ kontoId: k.id, ereignis: z.zweck === "einrichtung" ? "eingerichtet" : "passwort_geaendert", ip: a.ip, ua: a.ua });
  }
  sperre.loeschen(k.email);
  const sitzung = await sitzungAnlegen(k.id, z.bleiben !== false, a);
  await sqlPool`UPDATE fiaon_global_konten SET letzte_anmeldung_am = NOW(), updated_at = NOW() WHERE id = ${k.id}`;
  await kontoProtokoll({ kontoId: k.id, ereignis: "anmeldung", ip: a.ip, ua: a.ua, details: { zweck: z.zweck, bleiben: z.bleiben !== false } });
  return { ok: true, sitzung, bleiben: z.bleiben !== false, weiter: await kontoStartziel(k.id, k.sprache), kontoId: k.id };
}

/** „Code neu senden“ — frühestens nach 60 Sekunden, höchstens dreimal je Vorgang. Der vorige Code gilt danach nicht mehr. */
export async function kontoCodeNeu(b: { vorgang?: unknown }, a: Anfrage): Promise<Erg<{ meldung: string; mailFehler?: boolean }>> {
  await ensureGlobalKonto();
  const s = a.sprache ?? "de";
  const vorgang = String(b.vorgang ?? "");
  if (!KONTO_VORGANG_MUSTER.test(vorgang)) return nein(400, S(s).codeVerbraucht, "verbraucht");
  const [z] = (await sqlPool`SELECT * FROM fiaon_global_konto_codes WHERE vorgang_hash = ${kontoVorgangHash(vorgang)} LIMIT 1`) as any[];
  if (!z || z.eingeloest_am) return nein(400, S(s).codeVerbraucht, "verbraucht");
  const k = await kontoLesen(Number(z.konto_id));
  if (!k || k.status === "gesperrt") return nein(400, S(s).codeVerbraucht, "verbraucht");
  // Ist inzwischen ein NEUERER Vorgang da (zweite Anmeldung in einem anderen Fenster), gilt dieser nicht mehr.
  const [neuer] = (await sqlPool`SELECT 1 AS x FROM fiaon_global_konto_codes WHERE konto_id = ${k.id} AND id > ${z.id} LIMIT 1`) as any[];
  if (neuer) return nein(400, S(k.sprache).codeVerbraucht, "verbraucht");
  const u = kontoCodeNeuUrteil(z.letzter_versand_am, Number(z.neu_gesendet || 0));
  if (u.genug) return nein(429, S(k.sprache).codeNeuGenug, "genug");
  if (!u.erlaubt) return nein(429, S(k.sprache).codeNeuWarten(u.warten), "warten");
  const code = kontoCodeErzeugen();
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_konto_codes SET code_hash = ${kontoCodeHash(vorgang, code)}, gueltig_bis = ${kontoCodeGueltigBis()}, versuche = 0, verworfen_am = NULL,
           neu_gesendet = neu_gesendet + 1, letzter_versand_am = NOW()
     WHERE id = ${z.id} AND eingeloest_am IS NULL AND neu_gesendet = ${Number(z.neu_gesendet || 0)} RETURNING id`) as any[];
  if (!frei) return nein(429, S(k.sprache).codeNeuWarten(60), "warten");
  const zweck = (["anmeldung", "einrichtung", "passwort"].includes(String(z.zweck)) ? z.zweck : "anmeldung") as "anmeldung" | "einrichtung" | "passwort";
  // „Code neu senden“ heißt meist: der erste kam nicht an — darum derselbe Code über beide Wege (E-441).
  const mail = await kontoMailSenden("global_login_code", k, { login_code: code, code_anlass: escapeHtml(CODE_ANLASS[zweck][k.sprache]) }, { weg: "beide" });
  await kontoProtokoll({ kontoId: k.id, ereignis: "code_neu", erfolg: mail.ok, ip: a.ip, ua: a.ua, details: { zweck, grund: mail.grund } });
  return { ok: true, meldung: S(k.sprache).codeNeuOk, ...(mail.ok ? {} : { mailFehler: true }) };
}

/** „Passwort vergessen“ — antwortet immer gleich, schickt nur an eine Adresse mit Konto. */
export async function kontoPasswortVergessen(b: { email?: unknown }, a: Anfrage): Promise<{ ok: true; text: string }> {
  const s = a.sprache ?? "de";
  const antwort = { ok: true as const, text: S(s).vergessenOk };
  try {
    await ensureGlobalKonto();
    const email = kontoEmail(b.email);
    if (!email || vergessenJeIp.zuViel(a.ip || "?") || vergessenJeEmail.zuViel(email)) return antwort;
    const k = await kontoNachEmail(email);
    if (!k || k.status === "gesperrt") { await kontoProtokoll({ email, ereignis: "vergessen_ohne_konto", erfolg: false, ip: a.ip, ua: a.ua }); return antwort; }
    const nonce = kontoNonceErzeugen();
    await sqlPool`UPDATE fiaon_global_konten SET passwort_nonce = ${nonce}, updated_at = NOW() WHERE id = ${k.id}`;
    const token = kontoLinkErzeugen("passwort", k.id, nonce, KONTO_PASSWORT_LINK_MINUTEN * 60_000);
    const mail = await kontoMailSenden("global_passwort_neu", k, { passwort_url: absoluteUrl(kontoZugangPfad(k.sprache, "passwort", token)) }, { ausgeloestVon: "Kunde (Passwort vergessen)" });
    await kontoProtokoll({ kontoId: k.id, ereignis: "vergessen", erfolg: mail.ok, ip: a.ip, ua: a.ua, details: { grund: mail.grund } });
  } catch (e) { console.error("[GLOBAL-KONTO] Passwort vergessen:", e instanceof Error ? e.message : e); }
  return antwort;
}

/** Was die Seite „Zugang einrichten“ / „Neues Passwort“ über den Link wissen darf. */
export async function kontoLinkLesen(b: { token?: unknown }, a: Anfrage): Promise<Erg<{ art: KontoLinkArt; email: string; name: string | null; firma: string | null; sprache: KontoSprache }>> {
  await ensureGlobalKonto();
  const s = a.sprache ?? "de";
  const p = kontoLinkPruefen(b.token);
  if (!p.ok) return p.grund === "abgelaufen" ? nein(410, S(s).linkAbgelaufen, "abgelaufen") : nein(400, S(s).linkUngueltig, "ungueltig");
  const k = await kontoLesen(p.kontoId);
  const marke = p.art === "einladung" ? k?.einladung_nonce : k?.passwort_nonce;
  if (!k || k.status === "gesperrt") return nein(400, S(s).linkUngueltig, "ungueltig");
  if (p.art === "einladung" && k.status === "aktiv") return { ...nein(409, S(k.sprache).linkUngueltig, "schon_eingerichtet"), email: k.email } as any;
  if (!marke || marke !== p.nonce) return nein(400, S(k.sprache).linkUngueltig, "ungueltig");
  return { ok: true, art: p.art, email: k.email, name: k.name, firma: k.firma, sprache: k.sprache };
}

/** Passwort festlegen (Einladung oder „vergessen“) → Code per Mail. Gespeichert wird erst mit dem richtigen Code. */
export async function kontoPasswortSetzen(b: { token?: unknown; passwort?: unknown; wiederholung?: unknown; bleiben?: unknown }, a: Anfrage): Promise<Erg<{ vorgang: string; maske: string; mailFehler?: boolean }>> {
  const l = await kontoLinkLesen({ token: b.token }, a);
  if (!l.ok) return l;
  const p = kontoLinkPruefen(b.token);
  if (!p.ok) return nein(400, S(l.sprache).linkUngueltig, "ungueltig");
  const k = (await kontoLesen(p.kontoId))!;
  const urteil = passwortBewerten(b.passwort, { email: k.email, wiederholung: b.wiederholung });
  if (!urteil.ok) return nein(400, S(k.sprache).passwort[urteil.fehler!], `passwort_${urteil.fehler}`);
  const c = await codeAnlegen(k, p.art === "einladung" ? "einrichtung" : "passwort", {
    bleiben: b.bleiben !== false, ip: a.ip, ua: a.ua, neuesPasswortHash: passwortHashen(String(b.passwort)), linkNonce: p.nonce,
  });
  return { ok: true, vorgang: c.vorgang, maske: emailMaske(k.email, k.sprache), ...(c.mailOk ? {} : { mailFehler: true }) };
}

// ═══ SITZUNG ═════════════════════════════════════════════════════════════════
const sitzungMs = (bleiben: boolean) => bleiben ? KONTO_SITZUNG_TAGE * 864e5 : KONTO_SITZUNG_KURZ_STUNDEN * 36e5;

async function sitzungAnlegen(kontoId: number, bleiben: boolean, a: Anfrage): Promise<string> {
  const token = kontoSitzungErzeugen();
  await sqlPool`
    INSERT INTO fiaon_global_konto_sitzungen (konto_id, token_hash, bleiben, gueltig_bis, ip, user_agent)
    VALUES (${kontoId}, ${kontoSitzungHash(token)}, ${bleiben}, ${new Date(Date.now() + sitzungMs(bleiben))}, ${a.ip || null}, ${a.ua.slice(0, 300) || null})`;
  return token;
}

/** httpOnly, SameSite=Lax, in der Produktion nur über HTTPS. „Angemeldet bleiben“ = 30 Tage, sonst bis der Browser schließt. */
export function kontoCookieSetzen(res: Response, token: string, bleiben: boolean): void {
  res.cookie(KONTO_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    ...(bleiben ? { maxAge: KONTO_SITZUNG_TAGE * 864e5 } : {}),
  });
}
export function kontoCookieLoeschen(res: Response): void {
  res.clearCookie(KONTO_COOKIE, { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
}

export interface KontoSitzung { sitzungId: number; kontoId: number; email: string; name: string | null; firma: string | null; sprache: KontoSprache; bleiben: boolean }

/**
 * Die Sitzung aus dem Cookie — oder null. Gleitend: Wer aktiv ist, bleibt angemeldet (höchstens alle zehn Minuten ein
 * Schreibzugriff, damit nicht jede Abfrage des Portals die Tabelle anfasst). `res` stellt das Cookie neu aus.
 */
export async function kontoSitzungLesen(req: Request, res?: Response): Promise<KontoSitzung | null> {
  const token = String((req as any).cookies?.[KONTO_COOKIE] ?? "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  await ensureGlobalKonto();
  const [z] = (await sqlPool`
    SELECT s.id, s.konto_id, s.bleiben, s.zuletzt_am, k.email, k.name, k.firma, k.sprache
      FROM fiaon_global_konto_sitzungen s JOIN fiaon_global_konten k ON k.id = s.konto_id
     WHERE s.token_hash = ${kontoSitzungHash(token)} AND s.beendet_am IS NULL AND s.gueltig_bis > NOW() AND k.status = 'aktiv'
     LIMIT 1`) as any[];
  if (!z) return null;
  const bleiben = z.bleiben !== false;
  if (Date.now() - new Date(z.zuletzt_am).getTime() > 10 * 60_000) {
    await sqlPool`UPDATE fiaon_global_konto_sitzungen SET zuletzt_am = NOW(), gueltig_bis = ${new Date(Date.now() + sitzungMs(bleiben))} WHERE id = ${z.id}`
      .catch((e) => console.error("[GLOBAL-KONTO] Sitzung verlängern:", e instanceof Error ? e.message : e));
    if (res && bleiben) kontoCookieSetzen(res, token, true);
  }
  return { sitzungId: Number(z.id), kontoId: Number(z.konto_id), email: String(z.email), name: z.name ?? null, firma: z.firma ?? null, sprache: spr(z.sprache), bleiben };
}

export async function kontoAbmelden(req: Request, res: Response): Promise<void> {
  const token = String((req as any).cookies?.[KONTO_COOKIE] ?? "");
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
    await ensureGlobalKonto();
    const [z] = (await sqlPool`
      UPDATE fiaon_global_konto_sitzungen SET beendet_am = NOW(), beendet_grund = 'abgemeldet'
       WHERE token_hash = ${kontoSitzungHash(token)} AND beendet_am IS NULL RETURNING konto_id`) as any[];
    if (z) await kontoProtokoll({ kontoId: Number(z.konto_id), ereignis: "abgemeldet" });
  }
  kontoCookieLoeschen(res);
}

// ═══ WAS DARF EIN KONTO SEHEN ════════════════════════════════════════════════
/** Darf dieses Konto die Akte `ref` sehen? Direkt verknüpft — oder über ein verknüpftes Angebot, dessen Auftrag sie ist. */
export async function kontoDarfRef(kontoId: number, ref: string): Promise<boolean> {
  await ensureGlobalKonto();
  const [z] = (await sqlPool.unsafe(`
    SELECT 1 AS ja FROM fiaon_global_konto_refs r
     WHERE r.konto_id = $1 AND r.entfernt_am IS NULL
       AND ((r.art = 'auftrag' AND r.ref = $2)
         ${angeboteDa ? "OR (r.art = 'angebot' AND EXISTS (SELECT 1 FROM fiaon_global_angebote a WHERE a.angebot_ref = r.ref AND a.auftrag_ref = $2))" : ""})
     LIMIT 1`, [kontoId, ref])) as any[];
  return !!z;
}

/** Hat die Akte `ref` einen EINGERICHTETEN Zugang? Dann öffnet der alte Link das Portal nicht mehr — er führt zur Anmeldung. */
export async function refAktivesKonto(ref: string): Promise<{ kontoId: number; email: string; sprache: KontoSprache } | null> {
  await ensureGlobalKonto();
  const [z] = (await sqlPool.unsafe(`
    SELECT k.id, k.email, k.sprache FROM fiaon_global_konto_refs r JOIN fiaon_global_konten k ON k.id = r.konto_id
     WHERE r.entfernt_am IS NULL AND k.status = 'aktiv'
       AND ((r.art = 'auftrag' AND r.ref = $1)
         ${angeboteDa ? "OR (r.art = 'angebot' AND EXISTS (SELECT 1 FROM fiaon_global_angebote a WHERE a.angebot_ref = r.ref AND a.auftrag_ref = $1))" : ""})
     ORDER BY k.letzte_anmeldung_am DESC NULLS LAST LIMIT 1`, [ref])) as any[];
  return z ? { kontoId: Number(z.id), email: String(z.email), sprache: spr(z.sprache) } : null;
}

const ANGEBOT_ART = (fassung: string, s: KontoSprache): string => {
  const f = String(fassung || "");
  const de = f.startsWith("IA-BEGLEIT-") ? "Begleitvertrag" : f.startsWith("IA-FIRMA-") ? "Firmenangebot" : f.startsWith("IA-KAPITAL-") ? "Kapital-Angebot" : "Individualvereinbarung";
  const en = f.startsWith("IA-BEGLEIT-") ? "Support agreement" : f.startsWith("IA-FIRMA-") ? "Company offer" : f.startsWith("IA-KAPITAL-") ? "Capital offer" : "Individual agreement";
  return s === "en" ? en : de;
};

/** Die Übersicht nach der Anmeldung: alle Aufträge (Akten) und die angenommenen Angebote ohne eigene Akte. */
export async function kontoUebersicht(kontoId: number): Promise<{ konto: { email: string; name: string | null; firma: string | null; sprache: KontoSprache }; auftraege: Record<string, unknown>[]; angebote: Record<string, unknown>[] }> {
  await ensureGlobalKonto();
  const k = (await kontoLesen(kontoId))!;
  const refs = (await sqlPool`SELECT art, ref FROM fiaon_global_konto_refs WHERE konto_id = ${kontoId} AND entfernt_am IS NULL`) as any[];
  const angebotRefs = refs.filter((r) => r.art === "angebot").map((r) => String(r.ref));
  const angebote = angeboteDa && angebotRefs.length ? ((await sqlPool`
    SELECT id, angebot_ref, fassung, status, auftrag_ref, angenommen_am, (vertrag_pdf IS NOT NULL) AS hat_vertrag
      FROM fiaon_global_angebote WHERE angebot_ref = ANY(${angebotRefs}) ORDER BY angenommen_am`) as any[]) : [];
  const akten = Array.from(new Set([...refs.filter((r) => r.art === "auftrag").map((r) => String(r.ref)), ...angebote.map((a) => a.auftrag_ref).filter(Boolean).map(String)]));
  const zeilen = akten.length ? ((await sqlPool`
    SELECT g.ref, g.paket_key, g.firma_name, g.firma, g.status, g.created_at, g.gesellschaft, a.pack_name, a.payment_status
      FROM fiaon_global_auftraege g LEFT JOIN fiaon_applications a ON a.ref = g.ref
     WHERE g.ref = ANY(${akten}) ORDER BY g.created_at`) as any[]) : [];
  const s = k.sprache;
  return {
    konto: { email: k.email, name: k.name, firma: k.firma, sprache: s },
    auftraege: zeilen.map((g) => {
      const gs = json<Record<string, any>>(g.gesellschaft, {});
      const st = String(g.status) === "storniert" ? "storniert" : String(g.status) === "abgeschlossen" ? "abgeschlossen" : String(g.status) === "gestartet" ? "gestartet" : String(g.payment_status) === "paid" || String(g.status) === "bezahlt" ? "bezahlt" : "offen";
      return {
        // Wie globalAuftragSicht: beim Individualangebot der Name des Teils, sonst das Paket aus dem Katalog.
        ref: String(g.ref), titel: String(((katalogPaket(g.paket_key)?.preisJeAngebot ? g.pack_name : "") || katalogPaket(g.paket_key)?.label || g.pack_name || "FIAON Global")),
        firma: String(json<Record<string, any>>(g.firma, {}).name || g.firma_name || ""), gesellschaft: gs.name ? String(gs.name) : null,
        status: st, seit: g.created_at ? new Date(g.created_at).toISOString() : null,
        url: `${KONTO_PFADE[s].auftrag}/${encodeURIComponent(String(g.ref))}`,
      };
    }),
    angebote: angebote.filter((a) => !a.auftrag_ref && String(a.status) === "angenommen").map((a) => ({
      id: Number(a.id), ref: String(a.angebot_ref), titel: ANGEBOT_ART(String(a.fassung), s),
      angenommenAm: a.angenommen_am ? new Date(a.angenommen_am).toISOString() : null,
      vertragUrl: a.hat_vertrag ? `/api/fiaon/global/konto/angebot/${Number(a.id)}/vertrag.pdf` : null,
    })),
  };
}

/** Wohin nach der Anmeldung: genau EINE Akte und kein Angebot ohne Akte → direkt dorthin, sonst die Übersicht. */
export async function kontoStartziel(kontoId: number, s: KontoSprache, wunsch?: unknown): Promise<string> {
  const w = kontoWeiterSicher(wunsch);
  if (w) {
    const ref = w.match(/\/auftrag\/([A-Za-z0-9-]+)/)?.[1];
    if (!ref || await kontoDarfRef(kontoId, ref)) return w;
  }
  const u = await kontoUebersicht(kontoId).catch(() => null);
  if (u && u.auftraege.length === 1 && u.angebote.length === 0) return String(u.auftraege[0].url);
  return KONTO_PFADE[s].konto;
}

/** Das Vertrags-PDF eines angenommenen Angebots — nur für ein Konto, das damit verknüpft ist. */
export async function kontoAngebotVertrag(kontoId: number, id: number): Promise<{ pdf: Buffer; dateiname: string } | null> {
  await ensureGlobalKonto();
  if (!angeboteDa || !Number.isInteger(id) || id <= 0) return null;
  const [a] = (await sqlPool`
    SELECT a.angebot_ref, a.vertrag_pdf FROM fiaon_global_angebote a
      JOIN fiaon_global_konto_refs r ON r.art = 'angebot' AND r.ref = a.angebot_ref AND r.konto_id = ${kontoId} AND r.entfernt_am IS NULL
     WHERE a.id = ${id} AND a.status = 'angenommen' LIMIT 1`) as any[];
  return a?.vertrag_pdf ? { pdf: Buffer.from(a.vertrag_pdf), dateiname: `FIAON_Global_Vertrag_${String(a.angebot_ref).replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf` } : null;
}

/**
 * Banner im Portal („Richten Sie Ihren persönlichen Zugang ein“): Wer das Portal mit seinem GÜLTIGEN Link offen hat und
 * noch keinen eingerichteten Zugang besitzt, bekommt den Einrichtungs-Link direkt — die Bestätigung per Code geht an die
 * Adresse des Auftrags, nie an eine andere. Bestehende Einladungsmarke wird weiterverwendet (ein gemailter Link bleibt gültig).
 */
export async function kontoEinrichtenAusPortal(ref: string): Promise<Erg<{ pfad: string }>> {
  const kunde = await kundeAusAuftrag(ref);
  if (!kunde) return nein(404, "Zu diesem Auftrag gibt es keine E-Mail-Adresse.");
  const konto = await kontoSicherstellen(kunde, "portal");
  if (konto.status !== "eingeladen") return nein(409, S(konto.sprache).linkUngueltig, "schon_eingerichtet");
  let nonce = konto.einladung_nonce;
  if (!nonce) {
    nonce = kontoNonceErzeugen();
    await sqlPool`UPDATE fiaon_global_konten SET einladung_nonce = ${nonce}, updated_at = NOW() WHERE id = ${konto.id} AND einladung_nonce IS NULL`;
    const frisch = await kontoLesen(konto.id);
    nonce = frisch?.einladung_nonce ?? nonce;
  }
  const token = kontoLinkErzeugen("einladung", konto.id, nonce!, KONTO_EINLADUNG_TAGE * 864e5);
  await kontoProtokoll({ kontoId: konto.id, ereignis: "einrichten_aus_portal", details: { ref } });
  return { ok: true, pfad: kontoZugangPfad(konto.sprache, "einladung", token) };
}

// ═══ CHEFBÜRO: DIE LISTE DER KUNDENZUGÄNGE ═══════════════════════════════════
/** Jede Adresse mit Global-Akte (ohne Test, ohne Storno) oder angenommenem Angebot (ohne Kooperation) — mit Stand des Zugangs. */
export async function kontoZugaengeListe(): Promise<{ email: string; name: string | null; firma: string | null; refs: string[]; status: "keins" | KontoStatus; eingeladenAm: string | null; einladungen: number; eingerichtetAm: string | null; letzteAnmeldungAm: string | null }[]> {
  await ensureGlobalKonto();
  const akten = (await sqlPool`
    SELECT g.ref, g.email, g.firma, g.firma_name, g.ansprechpartner, g.vertrag_sprache FROM fiaon_global_auftraege g
     WHERE g.status <> 'storniert' AND g.ist_test_am IS NULL`.catch(async () => (await sqlPool`
    SELECT g.ref, g.email, g.firma, g.firma_name, g.ansprechpartner, g.vertrag_sprache FROM fiaon_global_auftraege g WHERE g.status <> 'storniert'`))) as any[];
  const angebote = angeboteDa ? ((await sqlPool`
    SELECT angebot_ref, kunde, auftrag_ref FROM fiaon_global_angebote WHERE status = 'angenommen' AND fassung NOT LIKE 'IA-KOOP-%'`) as any[]) : [];
  const konten = (await sqlPool.unsafe(`SELECT ${KONTO_SPALTEN} FROM fiaon_global_konten`)) as any[];
  const je = new Map<string, { email: string; name: string | null; firma: string | null; refs: Set<string> }>();
  const dazu = (email: string | null, name: string | null, firma: string | null, ref: string) => {
    if (!email) return;
    const x = je.get(email) ?? { email, name: null, firma: null, refs: new Set<string>() };
    x.name = x.name ?? name; x.firma = x.firma ?? firma; x.refs.add(ref); je.set(email, x);
  };
  for (const g of akten) {
    const ap = json<Record<string, any>>(g.ansprechpartner, {}); const f = json<Record<string, any>>(g.firma, {});
    dazu(kontoEmail(g.email) ?? kontoEmail(ap.email), [ap.vorname, ap.nachname].filter(Boolean).join(" ") || null, f.art === "privat" ? null : (f.name || g.firma_name || null), String(g.ref));
  }
  for (const a of angebote) { const k = kundeAusAngebotJson(a.kunde); dazu(k.email, k.name, k.firma, String(a.angebot_ref)); }
  for (const z of konten) if (!je.has(String(z.email))) dazu(String(z.email), z.name ?? null, z.firma ?? null, "—");
  const kontoJe = new Map(konten.map((z) => [String(z.email), kontoAus(z)!]));
  return Array.from(je.values()).map((x) => {
    const k = kontoJe.get(x.email);
    return {
      email: x.email, name: k?.name ?? x.name, firma: k?.firma ?? x.firma, refs: Array.from(x.refs).filter((r) => r !== "—"),
      status: k ? k.status : "keins" as const,
      eingeladenAm: k?.eingeladen_am ? new Date(k.eingeladen_am).toISOString() : null, einladungen: k?.einladung_anzahl ?? 0,
      eingerichtetAm: k?.eingerichtet_am ? new Date(k.eingerichtet_am).toISOString() : null,
      letzteAnmeldungAm: k?.letzte_anmeldung_am ? new Date(k.letzte_anmeldung_am).toISOString() : null,
    };
  }).sort((a, b) => (a.status === "aktiv" ? 1 : 0) - (b.status === "aktiv" ? 1 : 0) || String(a.name || a.email).localeCompare(String(b.name || b.email), "de"));
}

// ═══ DIE TÜR ZUM PORTAL („Mein Auftrag“) ═════════════════════════════════════
export interface PortalZutritt { ref: string; weg: "sitzung" | "token" | "vorschau"; sitzung: KontoSitzung | null }

/**
 * Wer darf das Portal einer Akte öffnen (alle Kunden-Routen unter /global/mein-auftrag/:ref und /global/auftrag/:ref)?
 *   1. Eine SITZUNG eines Kontos, das mit der Akte verknüpft ist — immer.
 *   2. Die Vorschau der Leitung (gültiger Link + Chefbüro-Anmeldung, `vorschau`) — immer, auch bei eingerichtetem Zugang.
 *   3. Der signierte LINK (?t=) — nur, solange zur Akte KEIN Zugang eingerichtet ist. Ist einer eingerichtet, führt der Link
 *      zur Anmeldung: 401 `anmelden`, bei gültigem Link mit der Adresse zum Vorbelegen (der Link war an sie gemailt).
 * Fehler schreibt die Funktion selbst; Rückgabe null = Antwort ist raus.
 */
export async function globalPortalZutritt(req: Request, res: Response, opts: { vorschau: boolean; ungueltig: string; abgelaufen: string }): Promise<PortalZutritt | null> {
  const ref = String(req.params.ref || "").trim();
  res.setHeader("Cache-Control", "private, no-store");
  const sitzung = await kontoSitzungLesen(req, res).catch((e) => { console.error("[GLOBAL-KONTO] Sitzung lesen:", e instanceof Error ? e.message : e); return null; });
  if (sitzung && ref && await kontoDarfRef(sitzung.kontoId, ref)) return { ref, weg: "sitzung", sitzung };
  const { globalTokenPruefen } = await import("./fiaon-global-auftrag");
  const urteil = globalTokenPruefen(ref, req.query.t);
  if (urteil === "gueltig" && opts.vorschau) return { ref, weg: "vorschau", sitzung: null };
  const aktiv = ref ? await refAktivesKonto(ref).catch((e) => { console.error("[GLOBAL-KONTO] Zugang der Akte lesen:", e instanceof Error ? e.message : e); return null; }) : null;
  if (aktiv) {
    res.status(401).json({ ok: false, code: "anmelden", error: KONTO_SAETZE[aktiv.sprache].sitzungFehlt, sprache: aktiv.sprache, ...(urteil === "gueltig" ? { email: aktiv.email } : {}) });
    return null;
  }
  if (!urteil) { res.status(403).json({ ok: false, code: "ungueltig", error: opts.ungueltig }); return null; }
  if (urteil === "abgelaufen") { res.status(410).json({ ok: false, code: "abgelaufen", error: opts.abgelaufen }); return null; }
  return { ref, weg: "token", sitzung: null };
}
