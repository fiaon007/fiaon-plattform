// ═══════════════════════════════════════════════════════════════════════════
// DER GRÜNDUNGSBOGEN — DATENBANK, ZUGANG, UNTERSCHRIFT (E-526, 17.11.2026)
//
// Mehrere Gesellschafter gründen gemeinsam eine US-LLC; FIAON Global führt die Gründung aus.
// Jeder macht seine Angaben selbst und unterschreibt selbst, getrennt von den anderen.
// Regeln und Wortlaut: shared/fiaon-global-gruendungsbogen.ts (rein). Links: fiaon-gruendungsbogen-token.ts.
// PDF: fiaon-global-gruendungsbogen-pdf.ts. Routen: server/routes/fiaon-global-gruendungsbogen.ts.
//
// ── ZWEI TABELLEN, SONST NICHTS ───────────────────────────────────────────
//   fiaon_global_gruendungsboegen           der Bogen: Kennung, Status, Anrede, Kostenhinweis,
//                                           gemeinsame Angaben (JSONB) und ihre Fassung, Verlauf.
//   fiaon_global_gruendungsbogen_mitglieder je Gesellschafter: Anzeigename, Zieladresse, persönliche
//                                           Angaben, Reisepass, Unterschrift, PDF, überholte Unterschriften.
// Bewusst KEINE Verknüpfung mit Antrag, Person, Akte, Bestellung oder Rechnung — der Bogen steht für
// sich (keine Personenzusammenführung). Angelegt zur Laufzeit über die DDL-Wache (Muster ensureGlobalTabelle).
//
// ── FASSUNGEN UND ÜBERHOLTE UNTERSCHRIFTEN ────────────────────────────────
// Jede inhaltliche Änderung der gemeinsamen Angaben erhöht gesellschaft_fassung. Wer eine ältere Fassung
// unterschrieben hat, wird „überholt“: Zeit, Hash, Ort, IP, Bild und PDF wandern in `ueberholt` (nie
// gelöscht), die Felder der Unterschrift werden leer, und das Mitglied unterschreibt neu. Dasselbe gilt
// für das eigene Mitglied, wenn es nach der Unterschrift seine Angaben oder den Reisepass ändert.
// Gesperrt wird immer zuerst die Zeile des Bogens (FOR UPDATE), dann die Mitglieder — so überholen sich
// Änderung und Unterschrift nie gegenseitig.
//
// ── NACH DER LETZTEN UNTERSCHRIFT ─────────────────────────────────────────
// Status „vollstaendig“, dann GENAU EINMAL (gemeldet_am): eine Aufgabe an die Person, die Gründungen
// bestellt (dieselbe Quelle wie E-520: gruendungEmpfaenger), und eine kurze Mail an die Leitung
// (AUFRUF_MELDUNG_AN) — ohne Anhang und ohne persönliche Daten. Keine Mail mit Dokumenten an Kunden.
// ═══════════════════════════════════════════════════════════════════════════
import { randomBytes, createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { docHash, escapeHtml } from "./fiaon-html-pdf";
import { berlinToday, formatBerlin } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";
import { signaturPruefen } from "./fiaon-kuendigung-mitarbeiter";
import { globalDateiTyp, globalDateiname } from "./fiaon-global-bereich-regeln";
import { gbPdfErzeugen, type GbPdfDaten } from "./fiaon-global-gruendungsbogen-pdf";
import {
  gbBogenToken, gbBogenTokenPruefen, gbMitgliedToken, gbMitgliedTokenPruefen, gbTokenAblauf, gbGemeinsamPfad, gbPersoenlichPfad,
} from "./fiaon-gruendungsbogen-token";
import {
  GB_RECHTSFORM, GB_REISEPASS_MAX_BYTES, GB_REISEPASS_TYPEN, GB_STATUS_TEXT, GB_TEXTE, GB_WORTLAUT_FASSUNG, GB_ZUGANG_MAX_JE_STUNDE,
  EMAIL_MUSTER, alleUnterschrieben, anlagePruefen, angabenFehler, angabenFuerBeleg, angabenNormalisieren, angabenPruefen, aufzaehlung,
  bestaetigungFehlt, bestaetigungsWortlaut, danachSatz, emailMaskieren, emailNormalisieren, gbStaatName, gesellschaftFehler, gesellschaftGleich,
  gesellschaftNormalisieren, gesellschaftPruefen, kennungAus, namenGleich, nameLautPass, ortPruefen, stabilesJson, unterschriftInhaltText,
  unterschriftStatus, usNummerMaskieren, GB_BESTAETIGUNGEN,
  type GbAngaben, type GbGesellschaft, type GbStatus, type GbUnterschriftInhalt,
} from "@shared/fiaon-global-gruendungsbogen";

export const GB_TABELLE = "fiaon_global_gruendungsboegen";
export const GB_TABELLE_MITGLIEDER = "fiaon_global_gruendungsbogen_mitglieder";
export const GB_MAIL_EREIGNIS = "global_gruendungsbogen_zugang";
export const GB_CHEF_PFAD = "/chef/s/gruendungsboegen";

type Fehler = { ok: false; status: number; error: string; feld?: string };
type Erg<T> = ({ ok: true } & T) | Fehler;
type ErgLeer = { ok: true } | Fehler;
const nein = (status: number, error: string, feld?: string): Fehler => ({ ok: false, status, error, ...(feld ? { feld } : {}) });

// ── Schema ───────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
export function ensureGruendungsbogenTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_gruendungsboegen (
          id SERIAL PRIMARY KEY,
          kennung VARCHAR(16) NOT NULL UNIQUE,
          status VARCHAR(20) NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'vollstaendig', 'geschlossen')),
          angelegt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          angelegt_von TEXT,
          gruss TEXT NOT NULL,
          kosten_hinweis TEXT NOT NULL,
          bundesstaat VARCHAR(20) NOT NULL,
          rechtsform VARCHAR(10) NOT NULL DEFAULT 'LLC',
          gesellschaft JSONB NOT NULL DEFAULT '{}'::jsonb,
          gesellschaft_fassung INTEGER NOT NULL DEFAULT 1,
          gesellschaft_geaendert_am TIMESTAMPTZ,
          gesellschaft_geaendert_von TEXT,
          vollstaendig_am TIMESTAMPTZ,
          gemeldet_am TIMESTAMPTZ,
          geschlossen_am TIMESTAMPTZ,
          geschlossen_von TEXT,
          notiz_intern TEXT,
          verlauf JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_gruendungsbogen_mitglieder (
          id SERIAL PRIMARY KEY,
          bogen_id INTEGER NOT NULL REFERENCES fiaon_global_gruendungsboegen(id),
          reihenfolge INTEGER NOT NULL,
          anzeigename TEXT NOT NULL,
          email VARCHAR(200) NOT NULL,
          anteil_vorgabe NUMERIC(5,2),
          angaben JSONB NOT NULL DEFAULT '{}'::jsonb,
          angaben_am TIMESTAMPTZ,
          reisepass BYTEA,
          reisepass_typ VARCHAR(40),
          reisepass_name TEXT,
          reisepass_am TIMESTAMPTZ,
          unterschrift_png BYTEA,
          unterschrift_name TEXT,
          unterschrift_ort TEXT,
          unterschrieben_am TIMESTAMPTZ,
          unterschrift_ip VARCHAR(80),
          unterschrift_ua TEXT,
          unterschrift_fassung INTEGER,
          unterschrift_hash VARCHAR(64),
          pdf BYTEA,
          ueberholt JSONB NOT NULL DEFAULT '[]'::jsonb,
          zugang_angefordert_am TIMESTAMPTZ,
          zugang_anzahl INTEGER NOT NULL DEFAULT 0,
          zugang_fenster_ab TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (bogen_id, reihenfolge)
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_gruendungsbogen_mitglieder_bogen_idx ON fiaon_global_gruendungsbogen_mitglieder (bogen_id)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ── Lesen ────────────────────────────────────────────────────────────────────
const BOGEN_SPALTEN = `id, kennung, status, angelegt_am, angelegt_von, gruss, kosten_hinweis, bundesstaat, rechtsform, gesellschaft,
  gesellschaft_fassung, gesellschaft_geaendert_am, gesellschaft_geaendert_von, vollstaendig_am, gemeldet_am, geschlossen_am, geschlossen_von, notiz_intern`;
const MITGLIED_SPALTEN = `id, bogen_id, reihenfolge, anzeigename, email, anteil_vorgabe, angaben, angaben_am,
  reisepass_typ, reisepass_name, reisepass_am, (reisepass IS NOT NULL) AS hat_reisepass,
  unterschrift_name, unterschrift_ort, unterschrieben_am, unterschrift_ip, unterschrift_fassung, unterschrift_hash, (pdf IS NOT NULL) AS hat_pdf,
  CASE WHEN jsonb_typeof(ueberholt) = 'array' THEN jsonb_array_length(ueberholt) ELSE 0 END AS ueberholt_anzahl,
  zugang_angefordert_am, zugang_anzahl, zugang_fenster_ab`;

interface BogenZeile {
  id: number; kennung: string; status: GbStatus; angelegt_am: Date; angelegt_von: string | null; gruss: string; kosten_hinweis: string;
  bundesstaat: string; rechtsform: string; gesellschaft: unknown; gesellschaft_fassung: number; gesellschaft_geaendert_am: Date | null;
  gesellschaft_geaendert_von: string | null; vollstaendig_am: Date | null; gemeldet_am: Date | null; geschlossen_am: Date | null;
  geschlossen_von: string | null; notiz_intern: string | null;
}
interface MitgliedZeile {
  id: number; bogen_id: number; reihenfolge: number; anzeigename: string; email: string; anteil_vorgabe: string | number | null;
  angaben: unknown; angaben_am: Date | null; reisepass_typ: string | null; reisepass_name: string | null; reisepass_am: Date | null;
  hat_reisepass: boolean; unterschrift_name: string | null; unterschrift_ort: string | null; unterschrieben_am: Date | null;
  unterschrift_ip: string | null; unterschrift_fassung: number | null; unterschrift_hash: string | null; hat_pdf: boolean;
  ueberholt_anzahl: number; zugang_angefordert_am: Date | null; zugang_anzahl: number; zugang_fenster_ab: Date | null;
}

async function bogenLesen(id: number): Promise<BogenZeile | null> {
  await ensureGruendungsbogenTabellen();
  const [b] = (await sqlPool.unsafe(`SELECT ${BOGEN_SPALTEN} FROM fiaon_global_gruendungsboegen WHERE id = $1 LIMIT 1`, [id])) as any[];
  return b ? { ...b, gesellschaft_fassung: Number(b.gesellschaft_fassung) } : null;
}
async function mitgliederLesen(bogenId: number): Promise<MitgliedZeile[]> {
  const z = (await sqlPool.unsafe(`SELECT ${MITGLIED_SPALTEN} FROM fiaon_global_gruendungsbogen_mitglieder WHERE bogen_id = $1 ORDER BY reihenfolge, id`, [bogenId])) as any[];
  return z.map((m) => ({ ...m, id: Number(m.id), ueberholt_anzahl: Number(m.ueberholt_anzahl || 0), zugang_anzahl: Number(m.zugang_anzahl || 0), unterschrift_fassung: m.unterschrift_fassung === null ? null : Number(m.unterschrift_fassung) }));
}
const ids = (ms: MitgliedZeile[]) => ms.map((m) => m.id);
const gesellschaftVon = (b: BogenZeile, ms: MitgliedZeile[]): GbGesellschaft => gesellschaftNormalisieren(b.gesellschaft, ids(ms));
const lage = (m: MitgliedZeile) => ({ id: m.id, unterschriebenAm: m.unterschrieben_am, unterschriftFassung: m.unterschrift_fassung, ueberholtAnzahl: m.ueberholt_anzahl });
const angabenVollstaendig = (m: MitgliedZeile): boolean => angabenFehler(angabenNormalisieren(m.angaben), { heute: berlinToday(), stufe: "unterschrift", reisepass: m.hat_reisepass }).length === 0;
const wunschnameVoll = (g: GbGesellschaft) => (g.wunschname1 ? `${g.wunschname1} ${GB_RECHTSFORM}` : `Ihre ${GB_RECHTSFORM}`);
const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

/**
 * Ein Eintrag im Verlauf des Bogens (nur Namen und Ereignisse — keine persönlichen Angaben, keine Adressen).
 * JSONB immer über „lauf.json(…)“ schreiben, nie als „JSON.stringify(…)::jsonb“: Das legt einen String-Skalar ab
 * (E-238/E-460, „jsonb doppelt verpackt“), und „||“ oder „jsonb_typeof“ gehen dann ins Leere.
 */
function verlaufEintrag(wer: string, was: string): { am: string; wer: string; was: string }[] {
  return [{ am: new Date().toISOString(), wer: String(wer || "System").slice(0, 120), was: String(was).slice(0, 400) }];
}
async function verlaufSchreiben(lauf: any, bogenId: number, wer: string, was: string): Promise<void> {
  await lauf`
    UPDATE fiaon_global_gruendungsboegen
       SET verlauf = COALESCE(CASE WHEN jsonb_typeof(verlauf) = 'array' THEN verlauf END, '[]'::jsonb) || ${lauf.json(verlaufEintrag(wer, was))}, updated_at = NOW()
     WHERE id = ${bogenId}`;
}

/** Unterschriften überholen: alles nach `ueberholt` (nie löschen), Felder leer. Gibt die Namen zurück. */
async function ueberholen(tx: any, bogenId: number, nurMitglied: number | null, grund: string): Promise<string[]> {
  const z = (await tx`
    UPDATE fiaon_global_gruendungsbogen_mitglieder SET
      ueberholt = COALESCE(CASE WHEN jsonb_typeof(ueberholt) = 'array' THEN ueberholt END, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'am', unterschrieben_am, 'fassung', unterschrift_fassung, 'hash', unterschrift_hash, 'name', unterschrift_name,
        'ort', unterschrift_ort, 'ip', unterschrift_ip, 'ua', unterschrift_ua, 'grund', ${grund}::text, 'ueberholtAm', NOW(),
        'pdf', encode(pdf, 'base64'), 'unterschriftPng', encode(unterschrift_png, 'base64'))),
      unterschrift_png = NULL, unterschrift_name = NULL, unterschrift_ort = NULL, unterschrieben_am = NULL, unterschrift_ip = NULL,
      unterschrift_ua = NULL, unterschrift_fassung = NULL, unterschrift_hash = NULL, pdf = NULL
    WHERE bogen_id = ${bogenId} AND unterschrieben_am IS NOT NULL AND (${nurMitglied}::int IS NULL OR id = ${nurMitglied}::int)
    RETURNING id, anzeigename`) as any[];
  return z.map((r) => String(r.anzeigename));
}

// ── Zugang über die Links ────────────────────────────────────────────────────
async function bogenAusToken(bt: unknown): Promise<Erg<{ bogen: BogenZeile; gueltig: boolean }>> {
  const t = gbBogenTokenPruefen(bt);
  if (!t) return nein(404, GB_TEXTE.fehler.link);
  const bogen = await bogenLesen(t.id);
  if (!bogen) return nein(404, GB_TEXTE.fehler.link);
  return { ok: true, bogen, gueltig: t.status === "gueltig" };
}
/**
 * Die persönliche Seite: Der gemeinsame Link muss echt sein (sein Ablauf zählt hier nicht — der persönliche
 * Link wird bei jeder Ausgabe mit einem frischen gemeinsamen Link verschickt), der persönliche muss echt UND
 * gültig sein und zu genau diesem Bogen gehören.
 */
async function mitgliedAusToken(bt: unknown, mt: unknown): Promise<Erg<{ bogen: BogenZeile; mitglieder: MitgliedZeile[]; ich: MitgliedZeile; bogenGueltig: boolean }>> {
  const b = await bogenAusToken(bt);
  if (!b.ok) return b;
  const t = gbMitgliedTokenPruefen(b.bogen.id, mt);
  if (!t) return nein(404, GB_TEXTE.fehler.link);
  if (t.status === "abgelaufen") return { ...nein(410, GB_TEXTE.persoenlich.abgelaufen), ...(b.gueltig ? { gemeinsam: gbGemeinsamPfad(String(bt)) } : {}) } as Fehler;
  const mitglieder = await mitgliederLesen(b.bogen.id);
  const ich = mitglieder.find((m) => m.id === t.id);
  if (!ich) return nein(404, GB_TEXTE.fehler.link);
  return { ok: true, bogen: b.bogen, mitglieder, ich, bogenGueltig: b.gueltig };
}

// ── Die gemeinsame Seite ─────────────────────────────────────────────────────
export async function gbGemeinsamSicht(bt: unknown): Promise<Erg<Record<string, unknown>>> {
  const b = await bogenAusToken(bt);
  if (!b.ok) return b;
  if (!b.gueltig) return nein(410, GB_TEXTE.fehler.linkAbgelaufen);
  const ms = await mitgliederLesen(b.bogen.id);
  const g = gesellschaftVon(b.bogen, ms);
  const fassung = b.bogen.gesellschaft_fassung;
  return {
    ok: true,
    kennung: b.bogen.kennung, status: b.bogen.status, statusText: GB_STATUS_TEXT[b.bogen.status],
    gruss: b.bogen.gruss, kostenHinweis: b.bogen.kosten_hinweis, rechtsform: GB_RECHTSFORM,
    wunschname: wunschnameVoll(g), bundesstaat: { schluessel: g.bundesstaat, name: gbStaatName(g.bundesstaat) }, danach: danachSatz(g.bundesstaat),
    mitglieder: ms.map((m) => {
      const s = unterschriftStatus(lage(m), fassung);
      return { id: m.id, anzeigename: m.anzeigename, angaben: angabenVollstaendig(m) ? "vollstaendig" : "offen", unterschrift: s, unterschriebenAm: s === "unterschrieben" ? iso(m.unterschrieben_am) : null };
    }),
  };
}

// ── Zugang anfordern (Mail an die hinterlegte Adresse) ───────────────────────
const tagLang = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });

/** Mail mit dem persönlichen Link — zwei Wege wie E-441, Link nie im Klartext im Protokoll. */
async function zugangMailSenden(bogen: BogenZeile, g: GbGesellschaft, m: MitgliedZeile, url: string, bis: Date, ausgeloestVon: string): Promise<{ ok: boolean; grund: string | null }> {
  const nutzlast: Record<string, string> = {
    email: m.email,
    anrede_zeile: escapeHtml(`Guten Tag ${m.anzeigename}`),
    wunschname: escapeHtml(wunschnameVoll(g)),
    kennung: bogen.kennung,
    zugang_url: url,
    gueltig_text: tagLang(bis),
  };
  const K = await import("./fiaon-global-konto");
  const klar = K.kontoKlartextImProtokoll();
  // Lokaler Prüfstand (127.0.0.1, nie Produktion, Schalter gesetzt) ohne Mail-Schlüssel: nichts verschicken, nur protokollieren.
  const nurProtokoll = !process.env.BREVO_API_KEY && klar;
  let ok = false; let messageId: string | null = null; const gruende: string[] = []; const genommen: Array<"brevo" | "google"> = [];
  if (nurProtokoll) { ok = true; gruende.push("Prüfstand: nicht verschickt, nur protokolliert (kein BREVO_API_KEY)"); }
  else {
    const wunsch = K.kontoMailWegFuer(m.email);
    const reihe: Array<"brevo" | "google"> = !process.env.BREVO_API_KEY ? ["brevo"] : wunsch === "google" ? ["google", "brevo"] : ["brevo", "google"];
    for (const w of reihe) {
      const erg = await K.kontoMailUeber(w, GB_MAIL_EREIGNIS, nutzlast);
      if (erg.ok) { ok = true; genommen.push(w); if (w === "brevo") messageId = erg.messageId; if (erg.grund) gruende.push(erg.grund); break; }
      gruende.push(`${w}: ${erg.grund || "unbekannt"}`);
    }
  }
  const ueber = genommen[0] ?? "brevo";
  const grund = [...gruende, ok && ueber === "google" ? "Weg: Google Workspace" : null].filter(Boolean).join(" · ") || null;
  try {
    const { mailProtokoll } = await import("./fiaon-mail-log");
    await mailProtokoll({
      event: GB_MAIL_EREIGNIS, personId: null, empfaenger: m.email,
      status: nurProtokoll ? "uebersprungen" : ok ? "versandt" : "fehlgeschlagen", grund: ok ? grund : (grund || "unbekannt"),
      payload: { ...nutzlast, zugang_url: klar ? url : "[verborgen]", versandweg: ueber }, ausgeloestVon, brevoMessageId: messageId,
    });
  } catch (e) { console.error("[GRUENDUNGSBOGEN] Mailprotokoll:", e); }
  return { ok, grund: ok ? null : (grund || "unbekannt") };
}

/** Frischer gemeinsamer und persönlicher Link für ein Mitglied (absolut). */
function persoenlicherLink(bogenId: number, mitgliedId: number): { url: string; bis: Date } {
  const bt = gbBogenToken(bogenId);
  const mt = gbMitgliedToken(bogenId, mitgliedId);
  return { url: absoluteUrl(gbPersoenlichPfad(bt, mt)), bis: gbTokenAblauf(mt) ?? new Date() };
}

async function zugangSenden(bogen: BogenZeile, m: MitgliedZeile, ms: MitgliedZeile[], wer: { name: string; leitung: boolean }): Promise<Erg<{ an: string }>> {
  // Drossel je Mitglied — dieselbe Regel wie zugangDrossel (shared), hier atomar in EINER Anweisung.
  if (!wer.leitung) {
    const [z] = (await sqlPool`
      UPDATE fiaon_global_gruendungsbogen_mitglieder SET
        zugang_anzahl = CASE WHEN zugang_fenster_ab IS NULL OR zugang_fenster_ab <= NOW() - INTERVAL '1 hour' THEN 1 ELSE zugang_anzahl + 1 END,
        zugang_fenster_ab = CASE WHEN zugang_fenster_ab IS NULL OR zugang_fenster_ab <= NOW() - INTERVAL '1 hour' THEN NOW() ELSE zugang_fenster_ab END,
        zugang_angefordert_am = NOW()
      WHERE id = ${m.id} AND bogen_id = ${bogen.id}
        AND (zugang_fenster_ab IS NULL OR zugang_fenster_ab <= NOW() - INTERVAL '1 hour' OR zugang_anzahl < ${GB_ZUGANG_MAX_JE_STUNDE})
      RETURNING id`) as any[];
    if (!z) return nein(429, GB_TEXTE.fehler.zuViel);
  } else {
    await sqlPool`UPDATE fiaon_global_gruendungsbogen_mitglieder SET zugang_angefordert_am = NOW() WHERE id = ${m.id} AND bogen_id = ${bogen.id}`;
  }
  const g = gesellschaftVon(bogen, ms);
  const { url, bis } = persoenlicherLink(bogen.id, m.id);
  const mail = await zugangMailSenden(bogen, g, m, url, bis, wer.leitung ? `Chefbüro (${wer.name})` : `System (Gründungsbogen, angefordert auf der gemeinsamen Seite)`);
  await verlaufSchreiben(sqlPool, bogen.id, wer.name, mail.ok
    ? `Persönlicher Zugang für ${m.anzeigename} ${wer.leitung ? "von der Leitung gesendet" : "angefordert und gesendet"}.`
    : `Persönlicher Zugang für ${m.anzeigename} angefordert — die Mail ging nicht raus.`).catch(() => {});
  if (!mail.ok) {
    console.error(`[GRUENDUNGSBOGEN] ${bogen.kennung}: Zugangs-Mail an Mitglied ${m.id} nicht versandt: ${mail.grund}`);
    return nein(502, GB_TEXTE.fehler.mail);
  }
  return { ok: true, an: emailMaskieren(m.email) };
}

export async function gbZugangAnfordern(bt: unknown, mitgliedIdRoh: unknown): Promise<Erg<{ an: string }>> {
  const b = await bogenAusToken(bt);
  if (!b.ok) return b;
  if (!b.gueltig) return nein(410, GB_TEXTE.fehler.linkAbgelaufen);
  const ms = await mitgliederLesen(b.bogen.id);
  const m = ms.find((x) => x.id === Number(mitgliedIdRoh));
  if (!m) return nein(404, GB_TEXTE.fehler.link);
  return zugangSenden(b.bogen, m, ms, { name: m.anzeigename, leitung: false });
}

// ── Die persönliche Seite ────────────────────────────────────────────────────
function ichSicht(m: MitgliedZeile, fassung: number) {
  const a = angabenNormalisieren(m.angaben);
  const s = unterschriftStatus(lage(m), fassung);
  return {
    id: m.id, anzeigename: m.anzeigename, email: m.email,
    // Die US-Steuernummer kommt nie zurück in den Browser — nur maskiert.
    angaben: { ...a, usSteuernummer: "" }, usSteuernummerMaskiert: a.usSteuernummerVorhanden === true ? usNummerMaskieren(a.usSteuernummer) : "",
    reisepass: m.hat_reisepass ? { name: m.reisepass_name, typ: m.reisepass_typ, am: iso(m.reisepass_am) } : null,
    unterschrift: s === "unterschrieben" ? { am: iso(m.unterschrieben_am), amText: formatBerlin(m.unterschrieben_am), name: m.unterschrift_name, ort: m.unterschrift_ort, fassung: m.unterschrift_fassung, hash: m.unterschrift_hash } : null,
    status: s, ueberholtAnzahl: m.ueberholt_anzahl, hatPdf: m.hat_pdf && s === "unterschrieben",
  };
}

export async function gbMitgliedSicht(bt: unknown, mt: unknown): Promise<Erg<Record<string, unknown>>> {
  const r = await mitgliedAusToken(bt, mt);
  if (!r.ok) return r;
  const { bogen, mitglieder, ich } = r;
  const fassung = bogen.gesellschaft_fassung;
  const g = gesellschaftVon(bogen, mitglieder);
  const heute = berlinToday();
  return {
    ok: true,
    kennung: bogen.kennung, status: bogen.status, statusText: GB_STATUS_TEXT[bogen.status], gruss: bogen.gruss,
    kostenHinweis: bogen.kosten_hinweis, rechtsform: GB_RECHTSFORM, fassung, gesellschaft: g,
    geaendert: bogen.gesellschaft_geaendert_am ? { am: iso(bogen.gesellschaft_geaendert_am), von: bogen.gesellschaft_geaendert_von } : null,
    danach: danachSatz(g.bundesstaat),
    mitglieder: mitglieder.map((m) => {
      const s = unterschriftStatus(lage(m), fassung);
      return { id: m.id, anzeigename: m.anzeigename, reihenfolge: m.reihenfolge, ich: m.id === ich.id, angabenVollstaendig: angabenVollstaendig(m), unterschrift: s, unterschriebenAm: s === "unterschrieben" ? iso(m.unterschrieben_am) : null };
    }),
    ich: ichSicht(ich, fassung),
    bestaetigungen: GB_BESTAETIGUNGEN.map((b) => ({ schluessel: b.schluessel, titel: b.titel, text: b.text(bogen.kosten_hinweis), link: b.link ?? null })),
    pflichtFehlt: [
      ...gesellschaftFehler(g, ids(mitglieder), "unterschrift"),
      ...angabenFehler(angabenNormalisieren(ich.angaben), { heute, stufe: "unterschrift", reisepass: ich.hat_reisepass }),
    ],
    heute,
    gemeinsam: r.bogenGueltig ? gbGemeinsamPfad(String(bt)) : null,
  };
}

// ── Gemeinsame Angaben speichern ─────────────────────────────────────────────
export async function gbGesellschaftSpeichern(bt: unknown, mt: unknown, body: any): Promise<Erg<{ fassung: number; unveraendert: boolean; ueberholt: string[] }>> {
  const r = await mitgliedAusToken(bt, mt);
  if (!r.ok) return r;
  if (r.bogen.status !== "offen") return nein(409, GB_TEXTE.persoenlich.gesperrt);
  const p = gesellschaftPruefen(body?.gesellschaft, ids(r.mitglieder), "speichern");
  if (!p.ok) return nein(400, p.error, p.feld);
  const erwartet = Number(body?.fassung);
  return await sqlPool.begin(async (tx: any) => {
    const [b] = await tx`SELECT id, status, gesellschaft, gesellschaft_fassung FROM fiaon_global_gruendungsboegen WHERE id = ${r.bogen.id} FOR UPDATE`;
    if (!b || b.status !== "offen") return nein(409, GB_TEXTE.persoenlich.gesperrt);
    const jetzt = Number(b.gesellschaft_fassung);
    if (erwartet !== jetzt) return nein(409, GB_TEXTE.fehler.fassung, "fassung");
    const alt = gesellschaftNormalisieren(b.gesellschaft, ids(r.mitglieder));
    if (gesellschaftGleich(alt, p.daten)) return { ok: true as const, fassung: jetzt, unveraendert: true, ueberholt: [] as string[] };
    const neu = jetzt + 1;
    await tx`
      UPDATE fiaon_global_gruendungsboegen
         SET gesellschaft = ${tx.json(p.daten)}, gesellschaft_fassung = ${neu}, gesellschaft_geaendert_am = NOW(),
             gesellschaft_geaendert_von = ${r.ich.anzeigename}, updated_at = NOW()
       WHERE id = ${r.bogen.id}`;
    const weg = await ueberholen(tx, r.bogen.id, null, `Gemeinsame Angaben geändert (Fassung ${jetzt} → ${neu}) durch ${r.ich.anzeigename}`);
    await verlaufSchreiben(tx, r.bogen.id, r.ich.anzeigename,
      `Gemeinsame Angaben geändert (Fassung ${jetzt} → ${neu}).${weg.length ? ` Neu unterschreiben müssen: ${aufzaehlung(weg)}.` : ""}`);
    return { ok: true as const, fassung: neu, unveraendert: false, ueberholt: weg };
  });
}

// ── Persönliche Angaben speichern (Zwischenspeichern jederzeit) ──────────────
export async function gbAngabenSpeichern(bt: unknown, mt: unknown, body: any): Promise<Erg<{ fehlt: { feld: string; text: string }[]; ueberholtSelbst: boolean; unveraendert: boolean; usSteuernummerMaskiert: string }>> {
  const r = await mitgliedAusToken(bt, mt);
  if (!r.ok) return r;
  if (r.bogen.status !== "offen") return nein(409, GB_TEXTE.persoenlich.gesperrt);
  const heute = berlinToday();
  const p = angabenPruefen(body?.angaben, heute);
  if (!p.ok) return nein(400, p.error, p.feld);
  return await sqlPool.begin(async (tx: any) => {
    const [b] = await tx`SELECT status FROM fiaon_global_gruendungsboegen WHERE id = ${r.bogen.id} FOR UPDATE`;
    if (!b || b.status !== "offen") return nein(409, GB_TEXTE.persoenlich.gesperrt);
    const [m] = await tx`SELECT angaben, (reisepass IS NOT NULL) AS hat_reisepass FROM fiaon_global_gruendungsbogen_mitglieder WHERE id = ${r.ich.id} FOR UPDATE`;
    const alt = angabenNormalisieren(m?.angaben);
    const neu: GbAngaben = { ...p.daten };
    // Die Nummer kommt nur maskiert in den Browser: Ein leeres Feld bei „Ja“ heißt „wie bisher“.
    if (neu.usSteuernummerVorhanden === true && !neu.usSteuernummer && alt.usSteuernummerVorhanden === true) neu.usSteuernummer = alt.usSteuernummer;
    const fehlt = angabenFehler(neu, { heute, stufe: "unterschrift", reisepass: !!m?.hat_reisepass });
    const maske = neu.usSteuernummerVorhanden === true ? usNummerMaskieren(neu.usSteuernummer) : "";
    if (stabilesJson(alt) === stabilesJson(neu)) return { ok: true as const, fehlt, ueberholtSelbst: false, unveraendert: true, usSteuernummerMaskiert: maske };
    await tx`UPDATE fiaon_global_gruendungsbogen_mitglieder SET angaben = ${tx.json(neu)}, angaben_am = NOW() WHERE id = ${r.ich.id}`;
    const weg = await ueberholen(tx, r.bogen.id, r.ich.id, "Eigene Angaben nach der Unterschrift geändert");
    if (weg.length) await verlaufSchreiben(tx, r.bogen.id, r.ich.anzeigename, `${r.ich.anzeigename} hat die eigenen Angaben nach der Unterschrift geändert — neue Unterschrift nötig.`);
    return { ok: true as const, fehlt, ueberholtSelbst: weg.length > 0, unveraendert: false, usSteuernummerMaskiert: maske };
  });
}

// ── Reisepass hochladen ──────────────────────────────────────────────────────
export async function gbReisepassSpeichern(bt: unknown, mt: unknown, datei: { buffer?: Buffer; originalname?: string; size?: number } | null): Promise<Erg<{ reisepass: { name: string; typ: string; am: string }; ueberholtSelbst: boolean }>> {
  const r = await mitgliedAusToken(bt, mt);
  if (!r.ok) return r;
  if (r.bogen.status !== "offen") return nein(409, GB_TEXTE.persoenlich.gesperrt);
  const buf = datei?.buffer;
  if (!buf || !buf.length || buf.length > GB_REISEPASS_MAX_BYTES) return nein(400, GB_TEXTE.fehler.datei, "reisepass");
  // Am INHALT erkannt (Magic Bytes), nie am Namen oder am gemeldeten Typ — HEIC wird hier nicht angenommen.
  const typ = globalDateiTyp(buf);
  if (!typ || !(GB_REISEPASS_TYPEN as readonly string[]).includes(typ.mime)) return nein(400, GB_TEXTE.fehler.datei, "reisepass");
  const name = globalDateiname(datei?.originalname || "Reisepass", typ.endung);
  return await sqlPool.begin(async (tx: any) => {
    const [b] = await tx`SELECT status FROM fiaon_global_gruendungsboegen WHERE id = ${r.bogen.id} FOR UPDATE`;
    if (!b || b.status !== "offen") return nein(409, GB_TEXTE.persoenlich.gesperrt);
    const [z] = await tx`
      UPDATE fiaon_global_gruendungsbogen_mitglieder SET reisepass = ${buf}, reisepass_typ = ${typ.mime}, reisepass_name = ${name}, reisepass_am = NOW()
       WHERE id = ${r.ich.id} RETURNING reisepass_am`;
    const weg = await ueberholen(tx, r.bogen.id, r.ich.id, "Reisepass nach der Unterschrift ersetzt");
    await verlaufSchreiben(tx, r.bogen.id, r.ich.anzeigename, `${r.ich.anzeigename} hat die Bildseite des Reisepasses hochgeladen${weg.length ? " — neue Unterschrift nötig" : ""}.`);
    return { ok: true as const, reisepass: { name, typ: typ.mime, am: new Date(z.reisepass_am).toISOString() }, ueberholtSelbst: weg.length > 0 };
  });
}

// ── Unterschreiben ───────────────────────────────────────────────────────────
export async function gbUnterschreiben(bt: unknown, mt: unknown, body: any, kontext: { ip: string; userAgent: string }): Promise<Erg<{ unterschriebenAm: string; amText: string; vollstaendig: boolean }>> {
  const r = await mitgliedAusToken(bt, mt);
  if (!r.ok) return r;
  const { bogen, mitglieder, ich } = r;
  if (bogen.status !== "offen") return nein(409, GB_TEXTE.persoenlich.gesperrt);
  const fassung = bogen.gesellschaft_fassung;
  if (Number(body?.fassung) !== fassung) return nein(409, GB_TEXTE.fehler.fassungUnterschrift, "fassung");
  if (unterschriftStatus(lage(ich), fassung) === "unterschrieben") return nein(409, GB_TEXTE.fehler.schonUnterschrieben);
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(kontext.ip, kontext.userAgent).roboter) return nein(400, GB_TEXTE.fehler.roboter, "unterschriftPng");

  const g = gesellschaftVon(bogen, mitglieder);
  const heute = berlinToday();
  const gFehlt = gesellschaftFehler(g, ids(mitglieder), "unterschrift");
  if (gFehlt.length) return nein(400, gFehlt[0].text, gFehlt[0].feld);
  const angaben = angabenNormalisieren(ich.angaben);
  const aFehlt = angabenFehler(angaben, { heute, stufe: "unterschrift", reisepass: ich.hat_reisepass });
  if (aFehlt.length) return nein(400, aFehlt[0].text, aFehlt[0].feld);
  const fehltB = bestaetigungFehlt(body?.bestaetigungen);
  if (fehltB) return nein(400, `Bitte bestätigen Sie: ${GB_BESTAETIGUNGEN.find((x) => x.schluessel === fehltB)?.titel}.`, `bestaetigungen.${fehltB}`);
  const ort = ortPruefen(body?.ort);
  if (!ort) return nein(400, "Bitte geben Sie den Ort an, an dem Sie unterschreiben.", "ort");
  const soll = nameLautPass(angaben);
  if (!namenGleich(body?.name, soll)) return nein(400, GB_TEXTE.persoenlich.nameFalsch(soll), "name");
  const png = signaturPruefen(body?.unterschriftPng);
  if (!png) return nein(400, GB_TEXTE.fehler.unterschrift, "unterschriftPng");

  // Der Reisepass gehört über seine Prüfsumme zum unterschriebenen Inhalt (das Bild selbst steht nicht im PDF).
  const [rp] = (await sqlPool`SELECT reisepass, reisepass_name, reisepass_am, angaben_am FROM fiaon_global_gruendungsbogen_mitglieder WHERE id = ${ich.id}`) as any[];
  if (!rp?.reisepass) return nein(400, "Bitte laden Sie die Bildseite Ihres Reisepasses hoch.", "reisepass");
  const reisepassSha256 = createHash("sha256").update(rp.reisepass as Buffer).digest("hex");
  const am = new Date();
  const beleg = angabenFuerBeleg(angaben);
  const bestaetigungen = bestaetigungsWortlaut(bogen.kosten_hinweis);
  const name = String(body?.name ?? "").replace(/\s+/g, " ").trim();
  const inhalt: GbUnterschriftInhalt = {
    kennung: bogen.kennung, fassung, wortlautFassung: GB_WORTLAUT_FASSUNG, rechtsform: GB_RECHTSFORM, kostenHinweis: bogen.kosten_hinweis,
    gesellschaft: g, mitglieder: mitglieder.map((m) => ({ id: m.id, name: m.anzeigename })),
    ich: { id: ich.id, anzeigename: ich.anzeigename, email: ich.email }, angaben: beleg, reisepassSha256, bestaetigungen,
    name, ort, zeitIso: am.toISOString(), ip: kontext.ip,
  };
  const hash = docHash(unterschriftInhaltText(inhalt));
  const pdfDaten: GbPdfDaten = {
    kennung: bogen.kennung, fassung, wortlautFassung: GB_WORTLAUT_FASSUNG, kostenHinweis: bogen.kosten_hinweis, gesellschaft: g,
    mitglieder: inhalt.mitglieder, ich: inhalt.ich, angaben: beleg,
    reisepass: { name: String(rp.reisepass_name || "Reisepass"), am: rp.reisepass_am, sha256: reisepassSha256 },
    bestaetigungen, unterschrift: { png, name, ort, am, ip: kontext.ip, hash },
  };
  let pdf: Buffer;
  try {
    pdf = await gbPdfErzeugen(pdfDaten);
    if (!pdf || pdf.length < 1000) throw new Error("PDF leer");
  } catch (e) {
    console.error(`[GRUENDUNGSBOGEN] ${bogen.kennung}: PDF für Mitglied ${ich.id}:`, e);
    return nein(500, GB_TEXTE.fehler.pdf);
  }

  const erg = await sqlPool.begin(async (tx: any) => {
    const [b] = await tx`SELECT status, gesellschaft_fassung FROM fiaon_global_gruendungsboegen WHERE id = ${bogen.id} FOR UPDATE`;
    if (!b || b.status !== "offen") return nein(409, GB_TEXTE.persoenlich.gesperrt);
    if (Number(b.gesellschaft_fassung) !== fassung) return nein(409, GB_TEXTE.fehler.fassungUnterschrift, "fassung");
    const [m] = await tx`SELECT unterschrieben_am, unterschrift_fassung, angaben_am, reisepass_am FROM fiaon_global_gruendungsbogen_mitglieder WHERE id = ${ich.id} FOR UPDATE`;
    // Hat sich zwischen Lesen und Speichern etwas geändert (zweites Fenster), gilt die Unterschrift nicht.
    if (iso(m?.angaben_am) !== iso(rp.angaben_am) || iso(m?.reisepass_am) !== iso(rp.reisepass_am)) return nein(409, "Ihre Angaben haben sich gerade geändert. Bitte laden Sie die Seite neu und unterschreiben Sie dann.");
    if (m?.unterschrieben_am && Number(m.unterschrift_fassung) === fassung) return nein(409, GB_TEXTE.fehler.schonUnterschrieben);
    await tx`
      UPDATE fiaon_global_gruendungsbogen_mitglieder SET
        unterschrift_png = ${Buffer.from(png.slice("data:image/png;base64,".length), "base64")}, unterschrift_name = ${name}, unterschrift_ort = ${ort},
        unterschrieben_am = ${am}, unterschrift_ip = ${String(kontext.ip || "").slice(0, 80)}, unterschrift_ua = ${String(kontext.userAgent || "").slice(0, 500)},
        unterschrift_fassung = ${fassung}, unterschrift_hash = ${hash}, pdf = ${pdf}
      WHERE id = ${ich.id}`;
    await verlaufSchreiben(tx, bogen.id, ich.anzeigename, `${ich.anzeigename} hat Fassung ${fassung} unterschrieben.`);
    const alle = (await tx`SELECT id, unterschrieben_am, unterschrift_fassung FROM fiaon_global_gruendungsbogen_mitglieder WHERE bogen_id = ${bogen.id}`) as any[];
    const fertig = alleUnterschrieben(alle.map((x) => ({ id: Number(x.id), unterschriebenAm: x.unterschrieben_am, unterschriftFassung: x.unterschrift_fassung === null ? null : Number(x.unterschrift_fassung) })), fassung);
    let vollstaendig = false;
    if (fertig) {
      const [v] = await tx`UPDATE fiaon_global_gruendungsboegen SET status = 'vollstaendig', vollstaendig_am = NOW(), updated_at = NOW() WHERE id = ${bogen.id} AND status = 'offen' RETURNING id`;
      if (v) { vollstaendig = true; await verlaufSchreiben(tx, bogen.id, "System", `Alle Gesellschafter haben Fassung ${fassung} unterschrieben — Bogen vollständig.`); }
    }
    return { ok: true as const, unterschriebenAm: am.toISOString(), amText: formatBerlin(am), vollstaendig };
  });
  if (erg.ok && erg.vollstaendig) {
    void gbMelden(bogen.id).catch((e) => console.error(`[GRUENDUNGSBOGEN] ${bogen.kennung}: Meldung an Team und Leitung:`, e));
  }
  return erg;
}

/** Das eigene PDF (nur die aktuelle, gültige Unterschrift). */
export async function gbPdfLesen(bt: unknown, mt: unknown): Promise<Erg<{ pdf: Buffer; dateiname: string }>> {
  const r = await mitgliedAusToken(bt, mt);
  if (!r.ok) return r;
  if (unterschriftStatus(lage(r.ich), r.bogen.gesellschaft_fassung) !== "unterschrieben") return nein(404, "Es gibt noch kein unterschriebenes Dokument.");
  const [z] = (await sqlPool`SELECT pdf FROM fiaon_global_gruendungsbogen_mitglieder WHERE id = ${r.ich.id}`) as any[];
  if (!z?.pdf) return nein(404, "Es gibt noch kein unterschriebenes Dokument.");
  return { ok: true, pdf: z.pdf as Buffer, dateiname: `Gruendungsauftrag_${r.bogen.kennung}_Fassung_${r.bogen.gesellschaft_fassung}.pdf` };
}

// ── Nach der letzten Unterschrift: Aufgabe + Mail an die Leitung (genau einmal) ──
export function gbAufgabeSchluessel(kennung: string): string {
  return `global:gruendungsbogen:${String(kennung).toUpperCase()}`;
}
export async function gbMelden(bogenId: number): Promise<{ gemeldet: boolean; grund?: string }> {
  const [marke] = (await sqlPool`
    UPDATE fiaon_global_gruendungsboegen SET gemeldet_am = NOW(), updated_at = NOW()
     WHERE id = ${bogenId} AND status = 'vollstaendig' AND gemeldet_am IS NULL RETURNING id`) as any[];
  if (!marke) return { gemeldet: false, grund: "schon gemeldet oder nicht vollständig" };
  const bogen = await bogenLesen(bogenId);
  if (!bogen) return { gemeldet: false, grund: "Bogen fehlt" };
  const ms = await mitgliederLesen(bogenId);
  const g = gesellschaftVon(bogen, ms);
  const link = `${GB_CHEF_PFAD}?bogen=${encodeURIComponent(bogen.kennung)}`;
  const staat = gbStaatName(g.bundesstaat);
  try {
    const { gruendungEmpfaenger } = await import("./fiaon-global-gruendung-auftrag");
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const emp = await gruendungEmpfaenger();
    await auftragFuerKunden({
      personId: null, ref: null,
      titel: `Gründungsbogen ${bogen.kennung}: alle unterschrieben — ${wunschnameVoll(g)} gründen (${staat})`,
      text: [
        `Alle ${ms.length} Gesellschafter haben den Gründungsbogen ${bogen.kennung} unterschrieben (Fassung ${bogen.gesellschaft_fassung}).`,
        `Wunschname: ${wunschnameVoll(g)} · Ausweichnamen: ${[g.wunschname2, g.wunschname3].filter(Boolean).map((n) => `${n} ${GB_RECHTSFORM}`).join(", ") || "—"}`,
        `Bundesstaat: ${staat} · Führung: ${g.fuehrung === "manager" ? "manager-managed" : "member-managed"}`,
        "Alle Angaben, Reisepässe und die unterschriebenen PDFs stehen im Chefbüro unter Gründungsbögen (nur Leitung). Bitte die Gründung danach wie gewohnt bestellen.",
        `Öffnen: ${link}`,
      ].join("\n"),
      schluessel: gbAufgabeSchluessel(bogen.kennung), quelle: "global", bereich: "sonstiges", link, autorName: "System", dringend: true,
      ...(emp ? { agentId: emp.id } : { anBetreiber: true }),
      anlageText: "Angelegt vom System: Alle Gesellschafter haben den Gründungsbogen unterschrieben.",
    });
  } catch (e) {
    console.error(`[GRUENDUNGSBOGEN] ${bogen.kennung}: Aufgabe nicht angelegt — Marke zurück:`, e);
    await sqlPool`UPDATE fiaon_global_gruendungsboegen SET gemeldet_am = NULL WHERE id = ${bogenId}`.catch(() => {});
    return { gemeldet: false, grund: "Aufgabe nicht angelegt" };
  }
  try {
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const { AUFRUF_MELDUNG_AN } = await import("./fiaon-global-angebot-aufrufe");
    const v = await eigeneMailSenden({
      an: AUFRUF_MELDUNG_AN, name: "Justin",
      betreff: `Gründungsbogen ${bogen.kennung}: alle haben unterschrieben — ${wunschnameVoll(g)}`,
      text: [
        `Alle Gesellschafter haben den Gründungsbogen ${bogen.kennung} für ${wunschnameVoll(g)} (${staat}) unterschrieben.`,
        "Die Aufgabe „gründen“ liegt bei der Person, die Gründungen bestellt. Angaben und PDFs stehen im Chefbüro.",
      ].join("\n\n"),
      knoepfe: [{ text: "Gründungsbogen öffnen", url: absoluteUrl(link) }],
    } as any).catch((e: unknown) => ({ ok: false, grund: String(e) }) as { ok: boolean; grund?: string });
    if (!v.ok) console.error(`[GRUENDUNGSBOGEN] ${bogen.kennung}: Mail an die Leitung nicht versandt: ${String((v as any).grund ?? "")}`);
  } catch (e) { console.error(`[GRUENDUNGSBOGEN] ${bogen.kennung}: Mail an die Leitung:`, e); }
  await verlaufSchreiben(sqlPool, bogenId, "System", "Aufgabe an die zuständige Person angelegt, Leitung per Mail informiert.").catch(() => {});
  return { gemeldet: true };
}

// ═══ CHEFBÜRO (Leitung) ═══════════════════════════════════════════════════════
/** Anlegen — dieselbe Funktion für das Formular im Chefbüro und das Skript scripts/gruendungsbogen-anlegen.ts. */
export async function gbAnlegen(roh: unknown, wer: string): Promise<Erg<{ id: number; kennung: string; link: string }>> {
  await ensureGruendungsbogenTabellen();
  const p = anlagePruefen(roh);
  if (!p.ok) return nein(400, p.error, p.feld);
  const d = p.daten;
  for (let versuch = 0; versuch < 6; versuch++) {
    const kennung = kennungAus(randomBytes(6));
    try {
      const erg = await sqlPool.begin(async (tx: any) => {
        const [b] = await tx`
          INSERT INTO fiaon_global_gruendungsboegen (kennung, status, angelegt_von, gruss, kosten_hinweis, bundesstaat, rechtsform, gesellschaft, gesellschaft_fassung, notiz_intern, verlauf)
          VALUES (${kennung}, 'offen', ${wer}, ${d.gruss}, ${d.kostenHinweis}, ${d.bundesstaat}, ${GB_RECHTSFORM}, '{}'::jsonb, 1, ${d.notizIntern || null},
                  ${tx.json(verlaufEintrag(wer, `Gründungsbogen angelegt (${d.mitglieder.length} Gesellschafter).`))})
          RETURNING id`;
        const mids: number[] = [];
        for (let i = 0; i < d.mitglieder.length; i++) {
          const m = d.mitglieder[i];
          const [z] = await tx`
            INSERT INTO fiaon_global_gruendungsbogen_mitglieder (bogen_id, reihenfolge, anzeigename, email, anteil_vorgabe)
            VALUES (${b.id}, ${i + 1}, ${m.anzeigename}, ${m.email}, ${m.anteil}) RETURNING id`;
          mids.push(Number(z.id));
        }
        const g: GbGesellschaft = {
          wunschname1: d.wunschname, wunschname2: "", wunschname3: "", bundesstaat: d.bundesstaat, gegenstand: d.gegenstand,
          fuehrung: d.fuehrung, manager: [], anteile: Object.fromEntries(mids.map((id, i) => [String(id), d.mitglieder[i].anteil])),
          responsibleParty: null, website: "", anmerkungen: "",
        };
        await tx`UPDATE fiaon_global_gruendungsboegen SET gesellschaft = ${tx.json(g)} WHERE id = ${b.id}`;
        return { id: Number(b.id) };
      });
      return { ok: true, id: erg.id, kennung, link: absoluteUrl(gbGemeinsamPfad(gbBogenToken(erg.id))) };
    } catch (e: any) {
      if (String(e?.code) === "23505" && /kennung/.test(String(e?.constraint_name ?? e?.detail ?? e?.message ?? ""))) continue;
      throw e;
    }
  }
  return nein(500, "Keine freie Kennung gefunden — bitte noch einmal versuchen.");
}

/** Die Liste der Leitung. */
export async function gbChefListe(): Promise<Record<string, unknown>[]> {
  await ensureGruendungsbogenTabellen();
  const boegen = (await sqlPool.unsafe(`SELECT ${BOGEN_SPALTEN} FROM fiaon_global_gruendungsboegen ORDER BY angelegt_am DESC LIMIT 300`)) as any[];
  if (!boegen.length) return [];
  const alle = (await sqlPool.unsafe(`SELECT ${MITGLIED_SPALTEN} FROM fiaon_global_gruendungsbogen_mitglieder WHERE bogen_id = ANY($1::int[]) ORDER BY reihenfolge, id`, [boegen.map((b) => Number(b.id))])) as any[];
  return boegen.map((b) => {
    const ms = alle.filter((m) => Number(m.bogen_id) === Number(b.id)).map((m) => ({ ...m, id: Number(m.id), ueberholt_anzahl: Number(m.ueberholt_anzahl || 0), unterschrift_fassung: m.unterschrift_fassung === null ? null : Number(m.unterschrift_fassung) })) as MitgliedZeile[];
    const g = gesellschaftNormalisieren(b.gesellschaft, ms.map((m) => m.id));
    const fassung = Number(b.gesellschaft_fassung);
    return {
      id: Number(b.id), kennung: b.kennung, status: b.status, statusText: GB_STATUS_TEXT[b.status as GbStatus] ?? b.status,
      wunschname: wunschnameVoll(g), bundesstaat: gbStaatName(g.bundesstaat), fassung, angelegtAm: iso(b.angelegt_am), vollstaendigAm: iso(b.vollstaendig_am),
      mitglieder: ms.map((m) => ({ id: m.id, anzeigename: m.anzeigename, angabenVollstaendig: angabenVollstaendig(m), unterschrift: unterschriftStatus(lage(m), fassung) })),
    };
  });
}

/** Alle Angaben eines Bogens — nur für die Leitung (requireChef). */
export async function gbChefDetail(id: number): Promise<Erg<Record<string, unknown>>> {
  const bogen = await bogenLesen(id);
  if (!bogen) return nein(404, "Diesen Gründungsbogen gibt es nicht.");
  const ms = await mitgliederLesen(id);
  const [extra] = (await sqlPool`SELECT verlauf FROM fiaon_global_gruendungsboegen WHERE id = ${id}`) as any[];
  const ueberholt = (await sqlPool`
    SELECT id, COALESCE((SELECT jsonb_agg(x - 'pdf' - 'unterschriftPng') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(ueberholt) = 'array' THEN ueberholt ELSE '[]'::jsonb END) x), '[]'::jsonb) AS liste
      FROM fiaon_global_gruendungsbogen_mitglieder WHERE bogen_id = ${id}`) as any[];
  const g = gesellschaftVon(bogen, ms);
  const fassung = bogen.gesellschaft_fassung;
  const heute = berlinToday();
  const alsListe = (v: unknown): any[] => { let x: any = v; for (let i = 0; i < 2 && typeof x === "string"; i++) { try { x = JSON.parse(x); } catch { return []; } } return Array.isArray(x) ? x : []; };
  return {
    ok: true,
    bogen: {
      id: bogen.id, kennung: bogen.kennung, status: bogen.status, statusText: GB_STATUS_TEXT[bogen.status], gruss: bogen.gruss, kostenHinweis: bogen.kosten_hinweis,
      bundesstaatVorgabe: gbStaatName(bogen.bundesstaat), rechtsform: GB_RECHTSFORM, fassung, gesellschaft: g, wunschname: wunschnameVoll(g),
      angelegtAm: iso(bogen.angelegt_am), angelegtVon: bogen.angelegt_von, vollstaendigAm: iso(bogen.vollstaendig_am), gemeldetAm: iso(bogen.gemeldet_am),
      geschlossenAm: iso(bogen.geschlossen_am), geschlossenVon: bogen.geschlossen_von, notizIntern: bogen.notiz_intern ?? "",
      geaendert: bogen.gesellschaft_geaendert_am ? { am: iso(bogen.gesellschaft_geaendert_am), von: bogen.gesellschaft_geaendert_von } : null,
      verlauf: alsListe(extra?.verlauf).slice(-200).reverse(),
      gesellschaftFehlt: gesellschaftFehler(g, ids(ms), "unterschrift"),
    },
    mitglieder: ms.map((m) => {
      const a = angabenNormalisieren(m.angaben);
      return {
        id: m.id, reihenfolge: m.reihenfolge, anzeigename: m.anzeigename, email: m.email, anteilVorgabe: m.anteil_vorgabe === null ? null : Number(m.anteil_vorgabe),
        angaben: a, angabenAm: iso(m.angaben_am),
        angabenFehlt: angabenFehler(a, { heute, stufe: "unterschrift", reisepass: m.hat_reisepass }),
        reisepass: m.hat_reisepass ? { name: m.reisepass_name, typ: m.reisepass_typ, am: iso(m.reisepass_am) } : null,
        unterschrift: m.unterschrieben_am ? { am: iso(m.unterschrieben_am), name: m.unterschrift_name, ort: m.unterschrift_ort, ip: m.unterschrift_ip, fassung: m.unterschrift_fassung, hash: m.unterschrift_hash } : null,
        status: unterschriftStatus(lage(m), fassung), hatPdf: m.hat_pdf,
        ueberholt: alsListe(ueberholt.find((u) => Number(u.id) === m.id)?.liste),
        zugang: { zuletzt: iso(m.zugang_angefordert_am), anzahlImFenster: m.zugang_anzahl, fensterAb: iso(m.zugang_fenster_ab) },
      };
    }),
    link: absoluteUrl(gbGemeinsamPfad(gbBogenToken(bogen.id))),
  };
}

export async function gbChefIdAusKennung(kennung: string): Promise<number | null> {
  await ensureGruendungsbogenTabellen();
  const [z] = (await sqlPool`SELECT id FROM fiaon_global_gruendungsboegen WHERE kennung = ${String(kennung).toUpperCase()} LIMIT 1`) as any[];
  return z ? Number(z.id) : null;
}

export async function gbChefLink(id: number): Promise<Erg<{ link: string }>> {
  const b = await bogenLesen(id);
  if (!b) return nein(404, "Diesen Gründungsbogen gibt es nicht.");
  return { ok: true, link: absoluteUrl(gbGemeinsamPfad(gbBogenToken(b.id))) };
}

export async function gbChefZugangSenden(id: number, mitgliedId: number, wer: string): Promise<Erg<{ an: string }>> {
  const b = await bogenLesen(id);
  if (!b) return nein(404, "Diesen Gründungsbogen gibt es nicht.");
  const ms = await mitgliederLesen(id);
  const m = ms.find((x) => x.id === mitgliedId);
  if (!m) return nein(404, "Dieses Mitglied gibt es in diesem Bogen nicht.");
  return zugangSenden(b, m, ms, { name: wer, leitung: true });
}

export async function gbChefSchliessen(id: number, wer: string): Promise<ErgLeer> {
  await ensureGruendungsbogenTabellen();
  const [z] = (await sqlPool`
    UPDATE fiaon_global_gruendungsboegen SET status = 'geschlossen', geschlossen_am = NOW(), geschlossen_von = ${wer}, updated_at = NOW()
     WHERE id = ${id} AND status <> 'geschlossen' RETURNING id`) as any[];
  if (!z) return nein(409, "Der Bogen ist schon geschlossen oder existiert nicht.");
  await verlaufSchreiben(sqlPool, id, wer, "Bogen von der Leitung geschlossen.");
  return { ok: true };
}

export async function gbChefNotiz(id: number, notiz: unknown, wer: string): Promise<ErgLeer> {
  await ensureGruendungsbogenTabellen();
  const text = String(notiz ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 4000);
  const [z] = (await sqlPool`UPDATE fiaon_global_gruendungsboegen SET notiz_intern = ${text || null}, updated_at = NOW() WHERE id = ${id} RETURNING id`) as any[];
  if (!z) return nein(404, "Diesen Gründungsbogen gibt es nicht.");
  await verlaufSchreiben(sqlPool, id, wer, "Interne Notiz geändert.");
  return { ok: true };
}

/** Zieladresse eines Mitglieds korrigieren (Tippfehler beim Anlegen). Der Verlauf nennt keine Adressen. */
export async function gbChefEmailAendern(id: number, mitgliedId: number, emailRoh: unknown, wer: string): Promise<ErgLeer> {
  const b = await bogenLesen(id);
  if (!b) return nein(404, "Diesen Gründungsbogen gibt es nicht.");
  if (b.status === "geschlossen") return nein(409, "Der Bogen ist geschlossen.");
  const email = emailNormalisieren(emailRoh);
  if (!EMAIL_MUSTER.test(email)) return nein(400, "Bitte eine gültige E-Mail-Adresse angeben.", "email");
  const ms = await mitgliederLesen(id);
  const m = ms.find((x) => x.id === mitgliedId);
  if (!m) return nein(404, "Dieses Mitglied gibt es in diesem Bogen nicht.");
  if (ms.some((x) => x.id !== mitgliedId && x.email.toLowerCase() === email)) return nein(400, "Diese Adresse hat schon ein anderer Gesellschafter — jeder braucht eine eigene.", "email");
  await sqlPool`UPDATE fiaon_global_gruendungsbogen_mitglieder SET email = ${email} WHERE id = ${mitgliedId} AND bogen_id = ${id}`;
  await verlaufSchreiben(sqlPool, id, wer, `Zieladresse von ${m.anzeigename} geändert.`);
  return { ok: true };
}

export async function gbChefDatei(id: number, mitgliedId: number, art: "reisepass" | "pdf"): Promise<Erg<{ inhalt: Buffer; typ: string; name: string }>> {
  await ensureGruendungsbogenTabellen();
  const [z] = (await sqlPool`
    SELECT m.reisepass, m.reisepass_typ, m.reisepass_name, m.pdf, m.unterschrift_fassung, m.anzeigename, b.kennung
      FROM fiaon_global_gruendungsbogen_mitglieder m JOIN fiaon_global_gruendungsboegen b ON b.id = m.bogen_id
     WHERE m.id = ${mitgliedId} AND m.bogen_id = ${id} LIMIT 1`) as any[];
  if (!z) return nein(404, "Nicht gefunden.");
  if (art === "reisepass") {
    if (!z.reisepass) return nein(404, "Kein Reisepass hochgeladen.");
    return { ok: true, inhalt: z.reisepass as Buffer, typ: String(z.reisepass_typ || "application/octet-stream"), name: String(z.reisepass_name || "Reisepass") };
  }
  if (!z.pdf) return nein(404, "Noch kein unterschriebenes PDF.");
  return { ok: true, inhalt: z.pdf as Buffer, typ: "application/pdf", name: `Gruendungsauftrag_${z.kennung}_Fassung_${z.unterschrift_fassung}_${String(z.anzeigename).replace(/[^A-Za-z0-9]+/g, "_")}.pdf` };
}

/** „Meldung nachholen“, falls die Aufgabe nach der letzten Unterschrift nicht angelegt werden konnte. */
export async function gbChefMeldungNachholen(id: number): Promise<Erg<{ meldung: string }>> {
  const b = await bogenLesen(id);
  if (!b) return nein(404, "Diesen Gründungsbogen gibt es nicht.");
  if (b.status !== "vollstaendig") return nein(409, "Erst wenn alle unterschrieben haben.");
  if (b.gemeldet_am) return { ok: true, meldung: "Schon gemeldet." };
  const r = await gbMelden(id);
  return r.gemeldet ? { ok: true, meldung: "Aufgabe angelegt, Leitung informiert." } : nein(500, `Nicht gemeldet: ${r.grund ?? "unbekannt"}`);
}
