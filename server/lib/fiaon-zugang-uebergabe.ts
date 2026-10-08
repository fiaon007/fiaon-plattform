// ═══════════════════════════════════════════════════════════════════════════
// ZUGANG DIGITAL ÜBERGEBEN — Verschlüsselung und Datenbank (08.10.2026)
//
// Regeln, Stand und Texte: shared/fiaon-zugang-uebergabe.ts. Routen:
// server/routes/fiaon-zugang-uebergabe.ts. Tabelle: db/migrations/107.
//
// ── DIE SICHERHEIT IN FÜNF SÄTZEN ──────────────────────────────────────────
// 1. Das Start-Passwort steht nur als AES-256-GCM-Chiffrat in der Datenbank.
//    Der Schlüssel je Übergabe wird aus ZUGANG_SCHLUESSEL (Umgebung, 32 Byte)
//    UND dem Link-Token abgeleitet (HKDF-SHA-256) — wer Datenbank und Server-
//    Schlüssel hat, aber nicht den Link, kann es trotzdem nicht lesen.
// 2. Vom Token steht nur sein SHA-256 in der Tabelle, vom Code nur ein HMAC
//    mit einem zweiten, ebenfalls aus ZUGANG_SCHLUESSEL abgeleiteten Schlüssel
//    (6 Ziffern wären als reiner Hash in einer Sekunde durchprobiert).
//    Verglichen wird zeitkonstant.
// 3. Fehlt der Schlüssel, wird NICHTS ausgestellt — es gibt keinen Rückfallwert.
// 4. Drei falsche Codes, Ablauf nach 48 Stunden, Bestätigung, Zurückziehen
//    oder eine neue Übergabe an dieselbe Adresse leeren das Chiffrat. Die Zeile
//    bleibt (keine Hard-Deletes) als Nachweis ohne Passwort.
// 5. Keine Zeile dieser Datei schreibt Passwort, Token oder Code in ein
//    Protokoll; Fehlermeldungen nennen nie einen Inhalt.
//
// Jede Funktion, die den Bestand ändert, nimmt `lauf` (AGENTS.md, Falle 3).
// ═══════════════════════════════════════════════════════════════════════════
import {
  createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual,
} from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import {
  UEBERGABE_CODE_STELLEN, UEBERGABE_GUELTIG_STUNDEN, UEBERGABE_MAX_FEHLVERSUCHE, UEBERGABE_PFAD,
  uebergabeEingabePruefen, uebergabeIstGoogle, uebergabeLebt, uebergabeStandAus, uebergabeVorname,
  type UebergabeFeld, type UebergabeStand,
} from "@shared/fiaon-zugang-uebergabe";

type Lauf = any;

// ── Der Schlüssel ───────────────────────────────────────────────────────────
export type SchluesselStand = { ok: true; schluessel: Buffer } | { ok: false; grund: string };

/**
 * ZUGANG_SCHLUESSEL lesen: 32 Byte, base64 (auch base64url). Erzeugen z. B. mit
 * „openssl rand -base64 32". Die Meldung nennt nie den Wert, nur was fehlt.
 */
export function zugangSchluessel(): SchluesselStand {
  const roh = String(process.env.ZUGANG_SCHLUESSEL ?? "").trim();
  if (!roh) {
    return { ok: false, grund: "Der Server-Schlüssel ZUGANG_SCHLUESSEL ist nicht gesetzt. Ohne ihn stellt das System keinen Zugang aus — bitte in Render setzen (32 Byte, base64, z. B. „openssl rand -base64 32“)." };
  }
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(roh)) {
    return { ok: false, grund: "Der Server-Schlüssel ZUGANG_SCHLUESSEL ist kein base64-Text. Bitte neu erzeugen (32 Byte, base64)." };
  }
  const b = Buffer.from(roh.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (b.length !== 32) {
    return { ok: false, grund: `Der Server-Schlüssel ZUGANG_SCHLUESSEL hat ${b.length} statt 32 Byte. Bitte neu erzeugen (32 Byte, base64).` };
  }
  return { ok: true, schluessel: b };
}

const INFO_PASSWORT = "fiaon-zugang-uebergabe/passwort/v1";
const INFO_CODE = "fiaon-zugang-uebergabe/code/v1";

function ableiten(master: Buffer, salz: Buffer, info: string): Buffer {
  return Buffer.from(hkdfSync("sha256", master, salz, info, 32));
}

const b64u = (b: Buffer) => b.toString("base64url");

// ── Token und Code ──────────────────────────────────────────────────────────
/** 32 Zufallsbyte → 43 Zeichen base64url. */
export function tokenErzeugen(): string {
  return randomBytes(32).toString("base64url");
}

/** Nur die Form prüfen — ein falsch geformtes Token erreicht die Datenbank nie. */
export function tokenGeformt(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(`fiaon-zugang-uebergabe:${token}`).digest("hex");
}

/** Sechs Ziffern, gleichverteilt (randomInt, nicht Math.random). */
export function codeErzeugen(): string {
  return String(randomInt(0, 10 ** UEBERGABE_CODE_STELLEN)).padStart(UEBERGABE_CODE_STELLEN, "0");
}

export function codeGeformt(code: unknown): code is string {
  return typeof code === "string" && new RegExp(`^\\d{${UEBERGABE_CODE_STELLEN}}$`).test(code);
}

export function codeHmac(code: string, tHash: string, master: Buffer): string {
  return createHmac("sha256", ableiten(master, Buffer.alloc(0), INFO_CODE)).update(`${tHash}:${code}`).digest("hex");
}

/** Zeitkonstanter Vergleich zweier Hex-Werte gleicher Länge. */
export function codePasst(code: string, tHash: string, gespeichert: string, master: Buffer): boolean {
  const a = Buffer.from(codeHmac(code, tHash, master), "hex");
  const b = Buffer.from(String(gespeichert || ""), "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

// ── Verschlüsselung ─────────────────────────────────────────────────────────
/** v1.<iv 12 B>.<tag 16 B>.<chiffre> — alles base64url. Die Tabelle lässt nur diese Form zu (Migration 107). */
export function passwortVerschluesseln(klartext: string, token: string, master: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", ableiten(master, Buffer.from(token, "utf8"), INFO_PASSWORT), iv);
  c.setAAD(Buffer.from(tokenHash(token), "utf8"));
  const chiffre = Buffer.concat([c.update(klartext, "utf8"), c.final()]);
  return `v1.${b64u(iv)}.${b64u(c.getAuthTag())}.${b64u(chiffre)}`;
}

/** Wirft bei jedem Fehler dieselbe Meldung ohne Inhalt (falscher Schlüssel, falsches Token, verändert). */
export function passwortEntschluesseln(geheim: string, token: string, master: Buffer): string {
  const teile = String(geheim || "").split(".");
  if (teile.length !== 4 || teile[0] !== "v1") throw new Error("Chiffrat unlesbar");
  try {
    const d = createDecipheriv("aes-256-gcm", ableiten(master, Buffer.from(token, "utf8"), INFO_PASSWORT), Buffer.from(teile[1], "base64url"));
    d.setAAD(Buffer.from(tokenHash(token), "utf8"));
    d.setAuthTag(Buffer.from(teile[2], "base64url"));
    return Buffer.concat([d.update(Buffer.from(teile[3], "base64url")), d.final()]).toString("utf8");
  } catch {
    throw new Error("Chiffrat unlesbar");
  }
}

export function uebergabeLink(token: string): string {
  return absoluteUrl(`${UEBERGABE_PFAD}#${token}`);
}

// ── Tabelle ─────────────────────────────────────────────────────────────────
// Migration 107 läuft beim Start (npm start → db:migrate:sql). Fehlt sie
// trotzdem (lokaler Prüfstand, Start ohne Lauf), führt der Wächter GENAU
// dieselbe Datei aus — eine Definition, ein Ort (Muster ensureSocialTabellen).
// Eine neue Tabelle sperrt nichts Bestehendes; trotzdem mit kurzem Sperrlimit.
let bereit: Promise<void> | null = null;
export function ensureZugangUebergabeTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const r = (await sqlPool`SELECT to_regclass('public.fiaon_zugang_uebergaben') AS t`) as any[];
      if (r[0]?.t) return;
      const datei = path.resolve(process.cwd(), "db", "migrations", "107_zugang_uebergabe.sql");
      // SET ohne LOCAL bliebe an der Verbindung des Pools hängen — hier nur für diese Transaktion.
      const text = readFileSync(datei, "utf8").replace(/^SET lock_timeout\b/m, "SET LOCAL lock_timeout");
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx.unsafe(text);
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/** In einer Transaktion arbeiten — oder in der des Aufrufers, wenn er schon eine mitbringt. */
async function inTransaktion<T>(lauf: Lauf, arbeit: (tx: Lauf) => Promise<T>): Promise<T> {
  if (lauf === sqlPool) return (await sqlPool.begin(async (tx: any) => await arbeit(tx))) as T;
  return await arbeit(lauf);
}

// ── Ausstellen ──────────────────────────────────────────────────────────────
export interface Aussteller { agentId: number | null; name: string; stufe: string }

export type AusstellenErgebnis =
  | { ok: true; id: number; token: string; code: string; link: string; gueltigBis: string; ersetzt: number[] }
  | { ok: false; status: number; code: "SCHLUESSEL_FEHLT" | "EINGABE"; fehler: string; feld?: UebergabeFeld };

/**
 * Eine Übergabe ausstellen. Gibt Link und Code GENAU EINMAL zurück — danach
 * kennt sie niemand mehr, auch der Server nicht (nur ihre Prüfsummen).
 * Jede noch offene Übergabe an dieselbe Adresse (und `ersetzt`, falls genannt)
 * wird im selben Zug geleert: ein Zugang, ein gültiger Link.
 */
export async function uebergabeAusstellen(
  roh: Record<string, unknown>, von: Aussteller, opts: { ersetzt?: number | null } = {}, lauf: Lauf = sqlPool,
): Promise<AusstellenErgebnis> {
  const s = zugangSchluessel();
  if (!s.ok) return { ok: false, status: 503, code: "SCHLUESSEL_FEHLT", fehler: s.grund };
  const p = uebergabeEingabePruefen(roh as any);
  if (!p.ok) return { ok: false, status: 400, code: "EINGABE", fehler: p.fehler, feld: p.feld };
  const e = p.wert;

  const token = tokenErzeugen();
  const code = codeErzeugen();
  const tHash = tokenHash(token);
  const geheim = passwortVerschluesseln(e.passwort, token, s.schluessel);
  const cHmac = codeHmac(code, tHash, s.schluessel);
  const ersetzt = Number.isInteger(opts.ersetzt) && Number(opts.ersetzt) > 0 ? Number(opts.ersetzt) : 0;

  await ensureZugangUebergabeTabelle();
  return await inTransaktion(lauf, async (tx) => {
    const [z] = (await tx`
      INSERT INTO fiaon_zugang_uebergaben (
        token_hash, code_hmac, name, rolle, zugang, anmeldeadresse,
        ansprech_name, ansprech_funktion, ansprech_email, ansprech_telefon,
        passwort_geheim, gueltig_bis, ausgestellt_von_agent_id, ausgestellt_von_name, ausgestellt_von_stufe)
      VALUES (
        ${tHash}, ${cHmac}, ${e.name}, ${e.rolle || null}, ${e.zugang}, ${e.anmeldeadresse},
        ${e.ansprechName}, ${e.ansprechFunktion || null}, ${e.ansprechEmail || null}, ${e.ansprechTelefon || null},
        ${geheim}, NOW() + make_interval(hours => ${UEBERGABE_GUELTIG_STUNDEN}),
        ${von.agentId}, ${von.name}, ${von.stufe})
      RETURNING id, gueltig_bis`) as any[];
    const alt = (await tx`
      UPDATE fiaon_zugang_uebergaben
         SET passwort_geheim = NULL, geloescht_am = NOW(), geloescht_grund = 'ersetzt', ersetzt_durch_id = ${z.id}
       WHERE id <> ${z.id} AND passwort_geheim IS NOT NULL
         AND (LOWER(zugang) = ${e.zugang} OR id = ${ersetzt})
      RETURNING id`) as any[];
    return {
      ok: true as const, id: Number(z.id), token, code, link: uebergabeLink(token),
      gueltigBis: new Date(z.gueltig_bis).toISOString(), ersetzt: alt.map((a) => Number(a.id)),
    };
  });
}

// ── Liste fürs Chefbüro (ohne Chiffrat, ohne Prüfsummen) ───────────────────
export interface UebergabeZeile {
  id: number; name: string; rolle: string | null; zugang: string; anmeldeadresse: string;
  ansprechName: string | null; ansprechFunktion: string | null; ansprechEmail: string | null; ansprechTelefon: string | null;
  fehlversuche: number; gueltigBis: string; ausgestelltAm: string; ausgestelltVon: string | null;
  angesehenAm: string | null; angesehenZuletztAm: string | null; ansichten: number;
  bestaetigtAm: string | null; gesperrtAm: string | null; geloeschtAm: string | null; geloeschtGrund: string | null;
  zurueckgezogenVon: string | null; ersetztDurch: number | null; passwortLiegt: boolean; stand: UebergabeStand;
}

const iso = (d: unknown) => (d == null ? null : new Date(d as any).toISOString());

export async function uebergabenListe(lauf: Lauf = sqlPool): Promise<UebergabeZeile[]> {
  await ensureZugangUebergabeTabelle();
  await abgelaufeneLoeschen(lauf);
  const rows = (await lauf`
    SELECT id, name, rolle, zugang, anmeldeadresse, ansprech_name, ansprech_funktion, ansprech_email, ansprech_telefon,
           fehlversuche, gueltig_bis, ausgestellt_am, ausgestellt_von_name, angesehen_am, angesehen_zuletzt_am, ansichten,
           bestaetigt_am, gesperrt_am, geloescht_am, geloescht_grund, zurueckgezogen_von_name, ersetzt_durch_id,
           (passwort_geheim IS NOT NULL) AS passwort_liegt
      FROM fiaon_zugang_uebergaben
     ORDER BY ausgestellt_am DESC, id DESC
     LIMIT 100`) as any[];
  const jetzt = Date.now();
  return rows.map((r) => ({
    id: Number(r.id), name: r.name, rolle: r.rolle, zugang: r.zugang, anmeldeadresse: r.anmeldeadresse,
    ansprechName: r.ansprech_name, ansprechFunktion: r.ansprech_funktion, ansprechEmail: r.ansprech_email, ansprechTelefon: r.ansprech_telefon,
    fehlversuche: Number(r.fehlversuche), gueltigBis: iso(r.gueltig_bis)!, ausgestelltAm: iso(r.ausgestellt_am)!,
    ausgestelltVon: r.ausgestellt_von_name, angesehenAm: iso(r.angesehen_am), angesehenZuletztAm: iso(r.angesehen_zuletzt_am),
    ansichten: Number(r.ansichten), bestaetigtAm: iso(r.bestaetigt_am), gesperrtAm: iso(r.gesperrt_am),
    geloeschtAm: iso(r.geloescht_am), geloeschtGrund: r.geloescht_grund, zurueckgezogenVon: r.zurueckgezogen_von_name,
    ersetztDurch: r.ersetzt_durch_id == null ? null : Number(r.ersetzt_durch_id), passwortLiegt: !!r.passwort_liegt,
    stand: uebergabeStandAus(r, jetzt),
  }));
}

/** Zurückziehen: Passwort leeren, Link tot. Nur, solange noch eines liegt. */
export async function uebergabeZurueckziehen(id: number, vonName: string, lauf: Lauf = sqlPool): Promise<{ ok: boolean; fehler?: string }> {
  await ensureZugangUebergabeTabelle();
  const r = (await lauf`
    UPDATE fiaon_zugang_uebergaben
       SET passwort_geheim = NULL, geloescht_am = NOW(), geloescht_grund = 'zurueckgezogen', zurueckgezogen_von_name = ${vonName}
     WHERE id = ${id} AND passwort_geheim IS NOT NULL
    RETURNING id`) as any[];
  if (r.length) return { ok: true };
  const [da] = (await lauf`SELECT id FROM fiaon_zugang_uebergaben WHERE id = ${id}`) as any[];
  return { ok: false, fehler: da ? "Diese Übergabe ist schon abgeschlossen — es liegt kein Passwort mehr." : "Diese Übergabe gibt es nicht." };
}

/** Abgelaufene leeren. Läuft im Takt (routes.ts) und vor jeder Liste. Gibt die Zahl zurück. */
export async function abgelaufeneLoeschen(lauf: Lauf = sqlPool): Promise<number> {
  await ensureZugangUebergabeTabelle();
  const r = (await lauf`
    UPDATE fiaon_zugang_uebergaben
       SET passwort_geheim = NULL, geloescht_am = NOW(), geloescht_grund = 'abgelaufen'
     WHERE passwort_geheim IS NOT NULL AND gueltig_bis <= NOW()
    RETURNING id`) as any[];
  return r.length;
}

// ── Die Empfängerseite ──────────────────────────────────────────────────────
export interface UebergabeAnzeige {
  vorname: string; name: string; rolle: string | null; zugang: string; anmeldeadresse: string; google: boolean;
  passwort: string;
  ansprech: { name: string | null; funktion: string | null; email: string | null; telefon: string | null };
  ausgestelltVon: string | null; ausgestelltAm: string; gueltigBis: string;
}

export type EmpfaengerErgebnis =
  | { art: "ok"; anzeige: UebergabeAnzeige }
  | { art: "bestaetigt"; vorname: string; bestaetigtAm: string }
  | { art: "falsch"; rest: number }
  | { art: "zu"; stand: UebergabeStand }
  | { art: "unbekannt" }
  | { art: "format" }
  | { art: "schluessel"; grund: string }
  | { art: "unlesbar" };

/** Was der Link VOR dem Code verrät: nur den Stand, keinen Namen. */
export async function uebergabeStandLesen(token: unknown, lauf: Lauf = sqlPool):
  Promise<{ art: "unbekannt" } | { art: "stand"; stand: UebergabeStand; gueltigBis: string; rest: number }> {
  if (!tokenGeformt(token)) return { art: "unbekannt" };
  await ensureZugangUebergabeTabelle();
  const tHash = tokenHash(token);
  await lauf`
    UPDATE fiaon_zugang_uebergaben
       SET passwort_geheim = NULL, geloescht_am = NOW(), geloescht_grund = 'abgelaufen'
     WHERE token_hash = ${tHash} AND passwort_geheim IS NOT NULL AND gueltig_bis <= NOW()`;
  const [z] = (await lauf`
    SELECT gueltig_bis, angesehen_am, bestaetigt_am, gesperrt_am, geloescht_grund, fehlversuche
      FROM fiaon_zugang_uebergaben WHERE token_hash = ${tHash}`) as any[];
  if (!z) return { art: "unbekannt" };
  return {
    art: "stand", stand: uebergabeStandAus(z), gueltigBis: iso(z.gueltig_bis)!,
    rest: Math.max(0, UEBERGABE_MAX_FEHLVERSUCHE - Number(z.fehlversuche)),
  };
}

/**
 * Token + Code prüfen — unter Zeilensperre (FOR UPDATE), damit zwei
 * gleichzeitige falsche Codes nicht beide als „zweiter Versuch" zählen.
 * `aktion` „oeffnen" entschlüsselt und zeigt; „bestaetigen" leert das Passwort.
 */
async function mitCode(token: unknown, code: unknown, aktion: "oeffnen" | "bestaetigen", lauf: Lauf): Promise<EmpfaengerErgebnis> {
  if (!tokenGeformt(token)) return { art: "unbekannt" };
  if (!codeGeformt(code)) return { art: "format" };
  const s = zugangSchluessel();
  if (!s.ok) return { art: "schluessel", grund: s.grund };
  await ensureZugangUebergabeTabelle();
  const tHash = tokenHash(token);
  return await inTransaktion(lauf, async (tx) => {
    const [z] = (await tx`SELECT * FROM fiaon_zugang_uebergaben WHERE token_hash = ${tHash} FOR UPDATE`) as any[];
    if (!z) return { art: "unbekannt" as const };
    const stand = uebergabeStandAus(z);
    if (stand === "abgelaufen" && z.passwort_geheim) {
      await tx`UPDATE fiaon_zugang_uebergaben SET passwort_geheim = NULL, geloescht_am = NOW(), geloescht_grund = 'abgelaufen' WHERE id = ${z.id}`;
    }
    if (!uebergabeLebt(stand)) return { art: "zu" as const, stand };

    if (!codePasst(code, tHash, z.code_hmac, s.schluessel)) {
      const n = Number(z.fehlversuche) + 1;
      if (n >= UEBERGABE_MAX_FEHLVERSUCHE) {
        await tx`
          UPDATE fiaon_zugang_uebergaben
             SET fehlversuche = ${n}, passwort_geheim = NULL, gesperrt_am = NOW(), geloescht_am = NOW(), geloescht_grund = 'gesperrt'
           WHERE id = ${z.id}`;
        return { art: "zu" as const, stand: "gesperrt" as const };
      }
      await tx`UPDATE fiaon_zugang_uebergaben SET fehlversuche = ${n} WHERE id = ${z.id}`;
      return { art: "falsch" as const, rest: UEBERGABE_MAX_FEHLVERSUCHE - n };
    }

    if (aktion === "bestaetigen") {
      const [b] = (await tx`
        UPDATE fiaon_zugang_uebergaben
           SET passwort_geheim = NULL, bestaetigt_am = NOW(), geloescht_am = NOW(), geloescht_grund = 'bestaetigt',
               angesehen_am = COALESCE(angesehen_am, NOW())
         WHERE id = ${z.id}
        RETURNING bestaetigt_am`) as any[];
      return { art: "bestaetigt" as const, vorname: uebergabeVorname(z.name), bestaetigtAm: iso(b.bestaetigt_am)! };
    }

    let passwort: string;
    try { passwort = passwortEntschluesseln(z.passwort_geheim, token, s.schluessel); }
    catch { return { art: "unlesbar" as const }; }
    await tx`
      UPDATE fiaon_zugang_uebergaben
         SET angesehen_am = COALESCE(angesehen_am, NOW()), angesehen_zuletzt_am = NOW(), ansichten = ansichten + 1
       WHERE id = ${z.id}`;
    return {
      art: "ok" as const,
      anzeige: {
        vorname: uebergabeVorname(z.name), name: z.name, rolle: z.rolle, zugang: z.zugang, anmeldeadresse: z.anmeldeadresse,
        google: uebergabeIstGoogle(z.anmeldeadresse), passwort,
        ansprech: { name: z.ansprech_name, funktion: z.ansprech_funktion, email: z.ansprech_email, telefon: z.ansprech_telefon },
        ausgestelltVon: z.ausgestellt_von_name, ausgestelltAm: iso(z.ausgestellt_am)!, gueltigBis: iso(z.gueltig_bis)!,
      },
    };
  });
}

export function uebergabeOeffnen(token: unknown, code: unknown, lauf: Lauf = sqlPool): Promise<EmpfaengerErgebnis> {
  return mitCode(token, code, "oeffnen", lauf);
}

export function uebergabeBestaetigen(token: unknown, code: unknown, lauf: Lauf = sqlPool): Promise<EmpfaengerErgebnis> {
  return mitCode(token, code, "bestaetigen", lauf);
}
