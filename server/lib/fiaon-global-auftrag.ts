// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER BESTELLWEG (17.09.2026, E-188)
//
// Justin: „Direktkauf: Vertrag, Rechnung, Zahlung aufs Bankkonto = Start."
//
// ── WAS HIER STEHT ────────────────────────────────────────────────────────
// Ein Unternehmen bestellt auf /business/start eines der vier Global-Pakete
// (2.499 bis 35.999 €, einmalig). Dahinter läuft EINE Kette:
//   1. prüfen (Paket aus dem Katalog, DE/AT/CH, vier Bestätigungen, echte
//      Unterschrift vom Pad),
//   2. den Auftrag als PDF ausfertigen (fiaon-global-vertrag.ts) — ohne PDF
//      keine Annahme, wie bei jeder Unterschrift im Haus,
//   3. den ANTRAG anlegen wie das Firmen-Cockpit es tut: Loopback auf
//      POST /api/fiaon/application (type business, status submitted) — dort
//      sitzen Namensreinigung, Personenbindung und Lead-Konversion, und die
//      werden nicht kopiert,
//   4. die AUFTRAGSAKTE schreiben (fiaon_global_auftraege: wer, was, wann,
//      von welcher Adresse, mit welcher Unterschrift, in welcher Fassung),
//   5. die BESTELLUNG anlegen über bestellungFuerAntrag (fiaon-antrag.ts):
//      Betrag aus dem Katalog, Verwendungszweck, Fälligkeit, fortlaufende
//      Rechnungsnummer — dieselbe Funktion wie POST /payment-order,
//   6. Aufgabe an die zuständige Person, Betreuer eintragen, EINE Mail an den
//      Kunden mit Vertrag und Rechnung als PDF und dem Weg zur Zahlungsseite.
// Und nach dem Zahlungseingang (globalNachZahlung, gerufen aus onCustomerPaid):
// Aufgabe „US-Struktur starten", DANN Status „gestartet" und die Startmail.
//
// ── WAS BEWUSST NICHT PASSIERT ────────────────────────────────────────────
//   · Die Akte ersetzt fiaon_applications nicht — sie hängt über `ref` daran.
//     Zahlung, Rechnung, Provision und Person bleiben, wo sie immer waren.
//   · Kein Geld per SQL: gebucht wird nur über alsBezahltBuchen, Provision
//     nur über onCustomerPaid. Diese Datei LIEST fiaon_commissions, um der
//     zuständigen Person zu sagen, was gebucht wurde.
//   · Keine Privatkunden-Mail: welcome, payment_details, payment_reminder,
//     claim_received und payment_confirmed sind für Global am Katalog
//     abgeschaltet (fiaon-antrag.ts). Der Firmenkunde bekommt genau die Mails
//     aus server/mail/vorlagen/global.ts.
//   · Kein Abo, keine Onboarding-Stufe (fiaon-agent.ts, onCustomerPaid).
//
// ── AUCH PRIVATPERSONEN (19.09.2026, E-191) ───────────────────────────────
// Justin: „Man muss nicht als Firma unser Paket kaufen, auch Privatpersonen
// können über uns kaufen/gründen." Der Auftraggeber ist `unternehmen` oder
// `privat`. Beim Privatauftrag steht in `firma` die Person (art "privat",
// name = Vor- und Nachname, rechtsform "Privatperson", Wohnanschrift) — so
// lesen Liste, Aufgaben, Mails und Rechnung weiter aus EINER Stelle. Die
// Bestellzeile bekommt KEINEN Firmennamen: Die Rechnung nennt dann die Person.
// Bestätigt werden Vertrag, Pflichthinweise und die Widerrufsbelehrung; der
// sofortige Beginn ist freiwillig. Ohne ihn startet ein bezahlter Privatauftrag
// erst nach der Widerrufsfrist (globalNachZahlung wartet, der Stundenlauf
// globalWiderrufsStartLauf holt den Start nach) — sonst hätte FIAON bei einem
// Widerruf keinen Anspruch auf Wertersatz (§ 357a Abs. 2 BGB).
//
// ── DER ZUGANG OHNE ANMELDUNG ─────────────────────────────────────────────
// Der Kunde hat kein Konto. Seine Auftragsseite und die beiden PDFs hängen an
// einem signierten Token (HMAC wie beim Mitarbeiter-Abschluss, E-185), das an
// die `ref` gebunden ist und 30 Tage gilt. Token und ref werden im Zugriffslog
// maskiert (server/index.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { sqlPool } from "./db-pool";
import { docHash, escapeHtml } from "./fiaon-html-pdf";
import { berlinToday } from "./fiaon-time";
import { signaturPruefen, isoTag } from "./fiaon-kuendigung-mitarbeiter";
import { absoluteUrl } from "../fiaon-base-url";
import { BANK } from "@shared/fiaon-bank";
import { epcQrNutzlast } from "@shared/fiaon-epc-qr";
import { paket as katalogPaket, verkaufbarePakete, istGlobalPaket } from "@shared/fiaon-pakete";
import { GLOBAL_PAKETE, GLOBAL_VERTRAG_VERSION, globalPaket, istFiaonSelbst, type GlobalSchluessel } from "@shared/fiaon-global";
import { globalMeinAuftragPfad, globalOfficeAuftragPfad } from "@shared/fiaon-global-wege";
import { dachNummer, type DachLand } from "@shared/fiaon-dach-telefon";
import {
  globalVertragPdf, globalVertragRumpfHtml, globalWiderrufsfrist, type GlobalAuftraggeber, type GlobalVertragDaten, type VertragSprache,
} from "./fiaon-global-vertrag";
import { globalUnterlagenZeilen } from "@shared/fiaon-global-bereich";

export const GLOBAL_TOKEN_TAGE = 30;
export const GLOBAL_SCHLUESSEL: string[] = GLOBAL_PAKETE.map((p) => p.key);
const LAENDER: DachLand[] = ["DE", "AT", "CH"];
const LAND_NAME: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };

// ── Schema ───────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
let spalteFehlt = false;
export function ensureGlobalTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_auftraege (
          id SERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL UNIQUE,
          paket_key VARCHAR NOT NULL,
          land VARCHAR NOT NULL,
          firma JSONB NOT NULL,
          ansprechpartner JSONB NOT NULL,
          ust_id VARCHAR,
          bestaetigungen JSONB NOT NULL,
          unterschrift_png BYTEA,
          vertrag_pdf BYTEA,
          vertrag_version VARCHAR NOT NULL,
          vertrag_sprache VARCHAR NOT NULL DEFAULT 'de',
          unterschrieben_am TIMESTAMPTZ,
          ip VARCHAR,
          user_agent TEXT,
          quelle VARCHAR,
          status TEXT NOT NULL DEFAULT 'offen',
          bezahlt_am TIMESTAMPTZ,
          gestartet_am TIMESTAMPTZ,
          zustaendig_agent_id INTEGER,
          stichtag DATE NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      // Was über die Grundspalten hinaus gebraucht wird — eigene Anweisung, weil
      // CREATE TABLE IF NOT EXISTS an einer vorhandenen Tabelle nichts ergänzt.
      await sqlPool.unsafe(`
        ALTER TABLE fiaon_global_auftraege
          ADD COLUMN IF NOT EXISTS doc_hash VARCHAR,
          ADD COLUMN IF NOT EXISTS firma_name TEXT,
          ADD COLUMN IF NOT EXISTS email VARCHAR,
          ADD COLUMN IF NOT EXISTS rechnung_ust_modus VARCHAR NOT NULL DEFAULT 'none',
          ADD COLUMN IF NOT EXISTS ust_hinweis TEXT,
          ADD COLUMN IF NOT EXISTS auftrag_mail_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS auftrag_mail_fehler TEXT,
          ADD COLUMN IF NOT EXISTS start_mail_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS start_mail_fehler TEXT,
          ADD COLUMN IF NOT EXISTS stichtag_gesetzt_von TEXT,
          ADD COLUMN IF NOT EXISTS stichtag_mail_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_auftraege_status_idx ON fiaon_global_auftraege (status, created_at DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_auftraege_doppelt_idx ON fiaon_global_auftraege (LOWER(email), paket_key, created_at DESC)`;
      // Der USt-Modus der Rechnung steht AN DER BESTELLUNG (siehe Kopf von
      // server/fiaon-invoice.ts): Jede Stelle, die die Rechnung zeichnet, liest
      // die Bestellzeile — nur so ist es überall dieselbe Rechnung.
      // Mit lock_timeout (Muster ensureAnfragenSpalten): Die Bestelltabelle ist die heißeste im Haus —
      // diese eine Zeile darf nie hinter einer langen Transaktion Schlange stehen und dabei alles
      // andere aufhalten. Klappt sie nicht, bleibt der Auftrag trotzdem annehmbar: Ohne die Spalte
      // zeichnet die Rechnung den sicheren Modus „none", und der nächste Aufruf versucht es wieder.
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS rechnung_ust_modus VARCHAR`;
      }).catch((e: unknown) => { console.error("[FIAON-GLOBAL] Spalte rechnung_ust_modus nicht angelegt:", e); spalteFehlt = true; });
    })().catch((e) => { bereit = null; throw e; }).finally(() => { if (spalteFehlt) { bereit = null; spalteFehlt = false; } });
  }
  return bereit;
}

// ── Token: signiert, an die ref gebunden, 30 Tage ────────────────────────────
function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}
function signatur(ref: string, exp: number): string {
  return createHmac("sha256", geheimnis()).update(`global-auftrag.${ref}.${exp}`).digest("hex").slice(0, 32);
}
export function globalTokenErzeugen(ref: string, ttlMs = GLOBAL_TOKEN_TAGE * 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  return `${exp}.${signatur(ref, exp)}`;
}
export function globalTokenPruefen(ref: unknown, token: unknown): "gueltig" | "abgelaufen" | null {
  const teile = String(token ?? "").split(".");
  if (teile.length !== 2) return null;
  const exp = Number(teile[0]);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  const a = Buffer.from(signatur(String(ref ?? ""), exp)); const b = Buffer.from(teile[1]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return exp < Date.now() ? "abgelaufen" : "gueltig";
}

// ── Einstellungen (fiaon_settings) ───────────────────────────────────────────
export type UstModus = "none" | "reverse_charge";
export interface GlobalEinstellungen { zustaendigAgentId: number | null; provisionProzent: number; ustModus: UstModus }

export async function globalEinstellungen(): Promise<GlobalEinstellungen> {
  const zeilen = (await sqlPool`
    SELECT key, value FROM fiaon_settings
     WHERE key IN ('global_zustaendig_agent_id', 'global_provision_prozent', 'rechnung_b2b_ust_modus')`.catch(() => [])) as any[];
  const m: Record<string, string> = Object.fromEntries(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  const agent = Number(m.global_zustaendig_agent_id);
  const prozentRoh = String(m.global_provision_prozent ?? "").trim();
  const prozent = prozentRoh === "" ? 25 : Number(prozentRoh);
  return {
    zustaendigAgentId: Number.isInteger(agent) && agent > 0 ? agent : null,
    provisionProzent: Number.isFinite(prozent) && prozent >= 0 && prozent <= 50 ? prozent : 25,
    // Vorgabe „none", bis Justins Steuerberater entschieden hat — nie selbst 19 % ausweisen.
    ustModus: m.rechnung_b2b_ust_modus === "reverse_charge" ? "reverse_charge" : "none",
  };
}

// ── Eingabe prüfen ───────────────────────────────────────────────────────────
export interface GlobalFirma {
  /** 19.09.2026 (E-191): "privat" = eine Privatperson beauftragt; dann ist `name` ihr voller Name. */
  art?: "privat";
  land: DachLand; name: string; rechtsform: string;
  registergericht: string | null; registernummer: string | null;
  strasse: string; plz: string; ort: string;
  ustId: string | null; website: string | null; quelleRegister: string | null;
}
export interface GlobalAnsprechpartner {
  anrede: "Herr" | "Frau" | ""; vorname: string; nachname: string; funktion: string; email: string; telefon: string;
}
export type GlobalBestaetigungen =
  | { vertrag: true; pflichthinweis: true; unternehmer: true; vertretung: true }
  | { vertrag: true; pflichthinweis: true; widerruf: true; sofortBeginn: boolean };
export interface GlobalEingabe {
  paket: GlobalSchluessel;
  auftraggeber: GlobalAuftraggeber;
  firma: GlobalFirma;
  ansprechpartner: GlobalAnsprechpartner;
  bestaetigungen: GlobalBestaetigungen;
  unterschriftPng: string;
  sprache: VertragSprache;
  quelle: string | null;
}
export type Pruefung<T> = { ok: true; daten: T } | { ok: false; status: number; error: string; feld?: string };

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const fehler = (error: string, feld?: string, status = 400) => ({ ok: false as const, status, error, feld });

/** USt-IdNr. bzw. Schweizer UID in eine Schreibweise bringen; `null` = passt zu keinem der drei Länder. */
export function ustIdNormalisieren(roh: unknown): string | null {
  const s = String(roh ?? "").toUpperCase().replace(/[\s.\-]/g, "");
  if (/^DE\d{9}$/.test(s)) return s;
  if (/^ATU\d{8}$/.test(s)) return s;
  const ch = s.match(/^CHE(\d{9})(MWST|TVA|IVA)?$/);
  if (ch) return `CHE-${ch[1].slice(0, 3)}.${ch[1].slice(3, 6)}.${ch[1].slice(6)}${ch[2] ? ` ${ch[2]}` : ""}`;
  return null;
}

function paketPruefen(roh: unknown): GlobalSchluessel | null {
  const key = String(roh ?? "").trim().toLowerCase();
  // Verkauft wird, was der Katalog HEUTE als Global-Paket verkauft — eingestellte Pakete fehlen dort.
  return verkaufbarePakete("global").some((p) => p.key === key) && globalPaket(key) ? (key as GlobalSchluessel) : null;
}

/** Wer beauftragt — alles außer "privat" ist ein Unternehmen (so lauten alle Aufträge vor dem 19.09.2026). */
export function globalAuftraggeberVon(roh: unknown): GlobalAuftraggeber {
  return String(roh ?? "").trim().toLowerCase() === "privat" ? "privat" : "unternehmen";
}
/** Ist diese Akte der Auftrag einer Privatperson? Liest die Firma-Spalte (JSON), wie sie in der Akte steht. */
export function globalIstPrivat(firmaRoh: unknown): boolean {
  return json<Partial<GlobalFirma>>(firmaRoh, {}).art === "privat";
}

/** Land, Straße, PLZ und Ort — dieselbe Prüfung für den Sitz eines Unternehmens und den Wohnsitz einer Privatperson. */
function anschriftPruefen(f: any, vorsilbe: "firma" | "privat"): Pruefung<{ land: DachLand; strasse: string; plz: string; ort: string }> {
  const land = String(f?.land ?? "").trim().toUpperCase() as DachLand;
  if (!LAENDER.includes(land)) return fehler(vorsilbe === "privat"
    ? "FIAON Global richtet sich derzeit an Kunden mit Wohnsitz in Deutschland, Österreich oder der Schweiz. Bitte wählen Sie eines dieser Länder."
    : "FIAON Global richtet sich derzeit an Unternehmen mit Sitz in Deutschland, Österreich oder der Schweiz. Bitte wählen Sie eines dieser Länder.", `${vorsilbe}.land`);
  const strasse = text(f?.strasse, 160);
  if (strasse.length < 3) return fehler("Bitte geben Sie Straße und Hausnummer an.", `${vorsilbe}.strasse`);
  const plz = text(f?.plz, 10);
  if (!(land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(plz)) return fehler(`Bitte prüfen Sie die Postleitzahl — in ${LAND_NAME[land]} hat sie ${land === "DE" ? "fünf" : "vier"} Ziffern.`, `${vorsilbe}.plz`);
  const ort = text(f?.ort, 120);
  if (ort.length < 2) return fehler("Bitte geben Sie den Ort an.", `${vorsilbe}.ort`);
  return { ok: true, daten: { land, strasse, plz, ort } };
}

/** Die Felder, die Vorschau UND Auftrag brauchen — eine Prüfung, damit beide denselben Text ergeben. */
function firmaPruefen(f: any, streng: boolean): Pruefung<GlobalFirma> {
  const land = String(f?.land ?? "").trim().toUpperCase() as DachLand;
  if (!LAENDER.includes(land)) return fehler("FIAON Global richtet sich derzeit an Unternehmen mit Sitz in Deutschland, Österreich oder der Schweiz. Bitte wählen Sie eines dieser Länder.", "firma.land");
  const name = text(f?.name, 200);
  if (name.length < 2) return fehler("Bitte geben Sie den Namen Ihres Unternehmens an.", "firma.name");
  const rechtsform = text(f?.rechtsform, 80);
  if (!rechtsform) return fehler("Bitte geben Sie die Rechtsform Ihres Unternehmens an.", "firma.rechtsform");
  const anschrift = anschriftPruefen(f, "firma");
  if (!anschrift.ok) return anschrift;
  const { strasse, plz, ort } = anschrift.daten;
  // FIAON ist die Gegenseite — nie das Unternehmen des Kunden (Florentines Fund, 19.09.2026).
  for (const [feld, wert] of [["name", name], ["rechtsform", rechtsform], ["strasse", strasse], ["ort", ort], ["registergericht", f?.registergericht], ["registernummer", f?.registernummer], ["website", f?.website]] as const) {
    if (istFiaonSelbst(wert)) return fehler("„FIAON“ ist Ihr Vertragspartner — bitte tragen Sie hier Ihr eigenes Unternehmen ein.", `firma.${feld}`);
  }
  const ustRoh = text(f?.ustId, 30);
  const ustId = ustRoh ? ustIdNormalisieren(ustRoh) : null;
  if (streng && ustRoh && !ustId) return fehler("Bitte prüfen Sie die USt-IdNr. — erwartet wird zum Beispiel DE123456789, ATU12345678 oder CHE-123.456.789. Sie können das Feld auch leer lassen.", "firma.ustId");
  return { ok: true, daten: {
    land, name, rechtsform, strasse, plz, ort, ustId,
    registergericht: text(f?.registergericht, 120) || null,
    registernummer: text(f?.registernummer, 60) || null,
    website: text(f?.website, 200) || null,
    quelleRegister: text(f?.quelleRegister, 60) || null,
  } };
}

/**
 * Die Privatperson als Auftraggeber: Vor- und Nachname und Wohnanschrift (Schritt 2 der Seite).
 * Sie steht danach in `firma` wie ein Unternehmen — mit art "privat", ohne Register und USt-IdNr.
 */
function privatPruefen(b: any): Pruefung<{ firma: GlobalFirma; anrede: string; vorname: string; nachname: string }> {
  const vorname = text(b?.ansprechpartner?.vorname, 80); const nachname = text(b?.ansprechpartner?.nachname, 80);
  if (!vorname || !nachname) return fehler("Bitte geben Sie Ihren Vor- und Nachnamen an.", !vorname ? "privat.vorname" : "privat.nachname");
  const anschrift = anschriftPruefen(b?.firma, "privat");
  if (!anschrift.ok) return anschrift;
  for (const [feld, wert] of [["vorname", vorname], ["nachname", nachname], ["strasse", anschrift.daten.strasse], ["ort", anschrift.daten.ort]] as const) {
    if (istFiaonSelbst(wert)) return fehler("Bitte tragen Sie Ihren eigenen Namen und Ihre Wohnanschrift ein — FIAON ist Ihr Vertragspartner.", `privat.${feld}`);
  }
  const anrede = ["Herr", "Frau"].includes(String(b?.ansprechpartner?.anrede)) ? String(b.ansprechpartner.anrede) : "";
  return { ok: true, daten: {
    anrede, vorname, nachname,
    firma: {
      art: "privat", ...anschrift.daten, name: `${vorname} ${nachname}`, rechtsform: "Privatperson",
      registergericht: null, registernummer: null, ustId: null, website: null, quelleRegister: null,
    },
  } };
}

export function globalVorschauPruefen(b: any): Pruefung<GlobalVertragDaten> {
  const paket = paketPruefen(b?.paket);
  if (!paket) return fehler("Bitte wählen Sie eines der vier Pakete.", "paket");
  if (globalAuftraggeberVon(b?.auftraggeber) === "privat") {
    const pr = privatPruefen(b);
    if (!pr.ok) return pr;
    return { ok: true, daten: {
      paket, sprache: b?.sprache === "en" ? "en" : "de", auftraggeber: "privat",
      // Vorschau und Auftrag lesen den Wunsch zum Beginn an derselben Stelle — sonst stünde im PDF ein anderer Satz.
      sofortBeginn: b?.bestaetigungen?.sofortBeginn === true,
      firma: pr.daten.firma, ansprechpartner: { anrede: pr.daten.anrede, vorname: pr.daten.vorname, nachname: pr.daten.nachname, funktion: "Privatperson" },
    } };
  }
  const firma = firmaPruefen(b?.firma, false);
  if (!firma.ok) return firma;
  const vorname = text(b?.ansprechpartner?.vorname, 80); const nachname = text(b?.ansprechpartner?.nachname, 80);
  if (!vorname || !nachname) return fehler("Bitte geben Sie Vor- und Nachnamen der Person an, die unterschreibt.", !vorname ? "ansprechpartner.vorname" : "ansprechpartner.nachname");
  const funktion = text(b?.ansprechpartner?.funktion, 120);
  if (!funktion) return fehler("Bitte geben Sie Ihre Funktion im Unternehmen an, zum Beispiel Geschäftsführer.", "ansprechpartner.funktion");
  for (const [feld, wert] of [["vorname", vorname], ["nachname", nachname], ["funktion", funktion]] as const) {
    if (istFiaonSelbst(wert)) return fehler("Bitte tragen Sie hier die Person Ihres Unternehmens ein, die unterschreibt — FIAON ist Ihr Vertragspartner.", `ansprechpartner.${feld}`);
  }
  const anrede = ["Herr", "Frau"].includes(String(b?.ansprechpartner?.anrede)) ? String(b.ansprechpartner.anrede) : "";
  return { ok: true, daten: {
    paket, sprache: b?.sprache === "en" ? "en" : "de", auftraggeber: "unternehmen",
    firma: firma.daten, ansprechpartner: { anrede, vorname, nachname, funktion },
  } };
}

export function globalAuftragPruefen(b: any): Pruefung<GlobalEingabe> {
  // Honigtopf: Das Feld sieht kein Mensch. Wer es füllt, ist keiner.
  if (String(b?.falle ?? "").trim()) return fehler("Ihre Angaben konnten nicht verarbeitet werden. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.");
  const vor = globalVorschauPruefen(b);
  if (!vor.ok) return vor;
  const privat = vor.daten.auftraggeber === "privat";
  // Das Unternehmen noch einmal streng (USt-IdNr.); die Privatperson hat keine Firmenfelder.
  const firma: Pruefung<GlobalFirma> = privat ? { ok: true, daten: vor.daten.firma as GlobalFirma } : firmaPruefen(b?.firma, true);
  if (!firma.ok) return firma;

  const email = text(b?.ansprechpartner?.email, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return fehler("Bitte geben Sie eine gültige E-Mail-Adresse an — dorthin senden wir Vertrag und Rechnung.", "ansprechpartner.email");
  const telefonRoh = text(b?.ansprechpartner?.telefon, 40);
  if (!telefonRoh) return fehler("Bitte geben Sie eine Telefonnummer an, unter der wir Sie für das Startgespräch erreichen.", "ansprechpartner.telefon");
  const telefon = dachNummer(telefonRoh, firma.daten.land);
  if (!telefon) {
    const fremd = /^(\+|00)/.test(telefonRoh.replace(/\s/g, "")) && !/^(\+|00)\s*(49|43|41)/.test(telefonRoh.replace(/\s/g, ""));
    return fehler(fremd
      ? "Bitte geben Sie eine Telefonnummer aus Deutschland, Österreich oder der Schweiz an — FIAON Global richtet sich derzeit an Kunden aus diesen drei Ländern."
      : "Bitte prüfen Sie die Telefonnummer — zum Beispiel +49 171 1234567.", "ansprechpartner.telefon");
  }

  const best = b?.bestaetigungen ?? {};
  const SAETZE: Record<string, string> = privat
    ? {
      vertrag: "Bitte bestätigen Sie, dass Sie den Auftrag gelesen haben und ihn erteilen.",
      pflichthinweis: "Bitte bestätigen Sie, dass Sie die Pflichthinweise zur Steuerpflicht, zu den US-Meldungen und zur persönlichen Haftung gelesen haben.",
      widerruf: "Bitte bestätigen Sie, dass Sie die Widerrufsbelehrung zur Kenntnis genommen haben.",
    }
    : {
      vertrag: "Bitte bestätigen Sie, dass Sie den Auftrag gelesen haben und ihn erteilen.",
      pflichthinweis: "Bitte bestätigen Sie, dass Sie die Pflichthinweise zur Steuerpflicht, zu den US-Meldungen und zur persönlichen Haftung gelesen haben.",
      unternehmer: "Bitte bestätigen Sie, dass Sie als Unternehmer handeln. Als Privatperson wählen Sie im zweiten Schritt „Privatperson“.",
      vertretung: "Bitte bestätigen Sie, dass Sie Ihr Unternehmen vertreten dürfen.",
    };
  for (const k of Object.keys(SAETZE)) if (best[k] !== true) return fehler(SAETZE[k], `bestaetigungen.${k}`);

  const png = signaturPruefen(b?.unterschriftPng);
  if (!png) return fehler("Die Unterschrift fehlt oder ist unbrauchbar — bitte unterschreiben Sie noch einmal im Feld.", "unterschriftPng");

  return { ok: true, daten: {
    paket: vor.daten.paket, sprache: vor.daten.sprache, auftraggeber: privat ? "privat" : "unternehmen", firma: firma.daten,
    ansprechpartner: { ...(vor.daten.ansprechpartner as any), email, telefon },
    // Der sofortige Beginn ist freiwillig — nur ein echtes true zählt als ausdrückliches Verlangen.
    bestaetigungen: privat
      ? { vertrag: true, pflichthinweis: true, widerruf: true, sofortBeginn: best.sofortBeginn === true }
      : { vertrag: true, pflichthinweis: true, unternehmer: true, vertretung: true },
    unterschriftPng: png, quelle: text(b?.quelle, 60) || null,
  } };
}

// ── Drossel je IP — Muster fiaon-gruender-termin.ts ─────────────────────────
const jeIp = new Map<string, number[]>();
function zuViel(ip: string): boolean {
  const jetzt = Date.now();
  const liste = (jeIp.get(ip) ?? []).filter((t) => jetzt - t < 15 * 60_000);
  if (liste.length >= 5) { jeIp.set(ip, liste); return true; }
  liste.push(jetzt); jeIp.set(ip, liste);
  return false;
}
/** Dieselbe Bremse für die Vorschau — großzügiger, weil sie bei jedem Schritt zurück neu lädt. */
const jeIpVorschau = new Map<string, number[]>();
export function vorschauZuViel(ip: string): boolean {
  const jetzt = Date.now();
  const liste = (jeIpVorschau.get(ip) ?? []).filter((t) => jetzt - t < 60_000);
  if (liste.length >= 30) { jeIpVorschau.set(ip, liste); return true; }
  liste.push(jetzt); jeIpVorschau.set(ip, liste);
  return false;
}

// ── Kleine Helfer ────────────────────────────────────────────────────────────
function eur(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function tagDe(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v).length === 10 ? `${v}T12:00:00Z` : String(v));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}
function anredeZeile(a: { anrede?: string | null; vorname?: string | null; nachname?: string | null }): string {
  const nach = String(a.nachname || "").trim();
  if ((a.anrede === "Herr" || a.anrede === "Frau") && nach) return `Guten Tag ${a.anrede} ${nach}`;
  return `Guten Tag ${[a.vorname, a.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ")}`.trim();
}
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object") return v as T;
  try { return JSON.parse(String(v ?? "")) as T; } catch { return leer; }
}
async function verlauf(ref: string, note: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    SELECT ${ref}, a.person_id, NULL, 'System', 'system', ${note} FROM fiaon_applications a WHERE a.ref = ${ref}
  `.catch((e) => console.error(`[FIAON-GLOBAL] ${ref}: Verlaufseintrag nicht geschrieben:`, e));
}

// ── Lesen ────────────────────────────────────────────────────────────────────
const AKTE_OHNE_DATEIEN = `id, ref, paket_key, land, firma, ansprechpartner, ust_id, bestaetigungen, vertrag_version, vertrag_sprache,
  unterschrieben_am, ip, quelle, status, bezahlt_am, gestartet_am, zustaendig_agent_id, stichtag, created_at, doc_hash, firma_name, email,
  rechnung_ust_modus, ust_hinweis, auftrag_mail_am, auftrag_mail_fehler, start_mail_am, start_mail_fehler, stichtag_gesetzt_von, stichtag_mail_am,
  (vertrag_pdf IS NOT NULL) AS hat_vertrag`;

export async function globalAkteLesen(ref: string): Promise<any | null> {
  await ensureGlobalTabelle();
  const [a] = (await sqlPool.unsafe(`SELECT ${AKTE_OHNE_DATEIEN} FROM fiaon_global_auftraege WHERE ref = $1 LIMIT 1`, [ref])) as any[];
  return a ?? null;
}
async function bestellungLesen(ref: string): Promise<any | null> {
  const [a] = (await sqlPool`
    SELECT ref, person_id, pack_key, pack_name, payment_reference, payment_status, payment_due_date, amount_due, invoice_number,
           company_name, contact_name, contact_email, email, assigned_agent_id, completed_at, cancelled_at, merged_into,
           claimed_paid_at, archived_at
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  return a ?? null;
}
export async function globalVertragPdfLesen(ref: string): Promise<Buffer | null> {
  await ensureGlobalTabelle();
  const [a] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  return a?.vertrag_pdf ? Buffer.from(a.vertrag_pdf) : null;
}
/** Die Rechnung zu einem Global-Auftrag — gezeichnet vom einen Renderer des Hauses (fiaon-rechnung-pdf.ts). */
export async function globalRechnungPdf(ref: string): Promise<{ pdf: Buffer; dateiname: string } | null> {
  const b = await bestellungLesen(ref);
  if (!b || !istGlobalPaket(b.pack_key) || !b.payment_reference) return null;
  const { rechnungAlsPdf } = await import("./fiaon-rechnung-pdf");
  const r = await rechnungAlsPdf(String(b.payment_reference));
  return r ? { pdf: r.pdf, dateiname: r.dateiname } : null;
}

export type GlobalStatus = "offen" | "bezahlt" | "gestartet" | "storniert";
function statusAus(akte: any, bestellung: any): GlobalStatus {
  if (bestellung?.cancelled_at || ["cancelled", "superseded"].includes(String(bestellung?.payment_status))) return "storniert";
  if (String(akte?.status) === "storniert") return "storniert";
  // „abgeschlossen" setzt der Bereich „Mein Auftrag" (fiaon-global-bereich.ts). Für den Bestellweg
  // und die Liste der Leitung bleibt das ein gestarteter Auftrag — sonst stünde dort „bezahlt, nicht
  // gestartet" mit dem Knopf „Start anstoßen". Den fünften Zustand kennt nur der Bereich selbst.
  if (String(akte?.status) === "gestartet" || String(akte?.status) === "abgeschlossen") return "gestartet";
  if (String(bestellung?.payment_status) === "paid" || String(akte?.status) === "bezahlt") return "bezahlt";
  return "offen";
}

/** Was GET /global/auftrag/:ref zurückgibt — nur, was der Kunde selbst eingegeben hat oder zum Zahlen braucht. */
export async function globalAuftragSicht(ref: string, token: string): Promise<Record<string, unknown> | null> {
  const akte = await globalAkteLesen(ref);
  const b = await bestellungLesen(ref);
  if (!akte || !b) return null;
  const status = statusAus(akte, b);
  const kat = katalogPaket(akte.paket_key);
  const betragCents = kat?.preisCents ?? Math.round(Number(b.amount_due || 0) * 100);
  const firma = json<Partial<GlobalFirma>>(akte.firma, {});
  let qrDatenUrl: string | null = null;
  if (status === "offen" && b.payment_reference && betragCents > 0) {
    qrDatenUrl = await QRCode.toDataURL(
      epcQrNutzlast({ recipient: BANK.empfaenger, iban: BANK.iban, bic: BANK.bic, amount: betragCents / 100, remittance: String(b.payment_reference) }),
      { errorCorrectionLevel: "M", width: 360, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } },
    ).catch(() => null);
  }
  const t = encodeURIComponent(token); const r = encodeURIComponent(ref);
  const privat = firma.art === "privat";
  const frist = privat && akte.unterschrieben_am ? globalWiderrufsfrist(new Date(akte.unterschrieben_am)) : null;
  return {
    ok: true, ref, status,
    auftraggeber: privat ? "privat" : "unternehmen",
    // Privatauftrag: bis wann widerrufen werden kann und ob die Arbeit erst danach beginnt.
    ...(frist ? { widerruf: { fristEnde: frist.fristEnde, startAb: frist.startAb, sofortBeginn: json<Record<string, unknown>>(akte.bestaetigungen, {}).sofortBeginn === true } } : {}),
    paket: akte.paket_key, paketName: kat?.label ?? String(b.pack_name || akte.paket_key), betragCents,
    firma: { name: String(firma.name || akte.firma_name || ""), ort: String(firma.ort || "") },
    email: String(akte.email || ""),
    zahlung: {
      empfaenger: BANK.empfaenger, ibanAnzeige: BANK.ibanDisplay, bic: BANK.bic, bank: BANK.bank,
      verwendungszweck: b.payment_reference ?? null,
      faelligAm: b.payment_due_date ? berlinToday(new Date(b.payment_due_date)) : null,
      qrDatenUrl,
    },
    // ?bereich=business: Auch die Zahlungsseite zeigt den Rahmen von FIAON Global (client/src/lib/bereich.ts).
    zahlungsseite: b.payment_reference ? `/zahlung/${b.payment_reference}?bereich=business` : null,
    vertragUrl: `/api/fiaon/global/auftrag/${r}/vertrag.pdf?t=${t}`,
    rechnungUrl: `/api/fiaon/global/auftrag/${r}/rechnung.pdf?t=${t}`,
    unterschriebenAm: akte.unterschrieben_am ? new Date(akte.unterschrieben_am).toISOString() : null,
    stichtag: akte.stichtag ? isoTag(akte.stichtag) : null,
  };
}

// ── Die Mails — immer direkt über den Motor, immer im Protokoll ─────────────
// Die vier unteren gehören zum Bereich „Mein Auftrag" (server/mail/vorlagen/global-bereich.ts).
export type GlobalMail =
  | "global_auftrag" | "global_start" | "global_stichtag" | "global_zahlung_erinnerung"
  | "global_zugang" | "global_etappe" | "global_frist" | "global_dokument";
export type GlobalMailSprache = "de" | "en";

/** In welcher Sprache der Kunde seinen Auftrag geführt hat — sie steht in der Akte (vertrag_sprache). */
export function globalSpracheVon(akte: any): GlobalMailSprache {
  return String(akte?.vertrag_sprache ?? "").trim().toLowerCase() === "en" ? "en" : "de";
}

/**
 * Der Link zu „Mein Auftrag" — mit einem FRISCHEN Token. Das Token gilt 30 Tage
 * (GLOBAL_TOKEN_TAGE); ein Auftrag läuft sechs Monate und länger. Deshalb trägt
 * JEDE Mail, die dorthin führt, ihren eigenen neuen Link, und wer einen
 * abgelaufenen öffnet, fordert über POST /global/zugang jederzeit einen neuen an.
 * Ein Token lässt sich nicht widerrufen; es ist an die Antragsnummer gebunden.
 */
export function globalMeinAuftragUrl(ref: string, sprache: GlobalMailSprache = "de"): string {
  return absoluteUrl(globalMeinAuftragPfad(ref, globalTokenErzeugen(ref), sprache));
}

async function ansprechpartnerName(agentId: number | null, sprache: GlobalMailSprache = "de"): Promise<string> {
  if (agentId) {
    const { empfaengerNachId } = await import("../routes/fiaon-betreiber-todo");
    const e = await empfaengerNachId(agentId).catch(() => null);
    if (e?.kundenName) return e.kundenName;
  }
  return sprache === "en" ? "your FIAON Global team" : "Ihr Team von FIAON Global";
}

function eurEn(cents: number): string {
  return "€" + (cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function tagEn(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v).length === 10 ? `${v}T12:00:00Z` : String(v));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
}
function anredeZeileEn(a: { anrede?: string | null; vorname?: string | null; nachname?: string | null }): string {
  const nach = String(a.nachname || "").trim();
  if ((a.anrede === "Herr" || a.anrede === "Frau") && nach) return `Dear ${a.anrede === "Herr" ? "Mr" : "Ms"} ${nach}`;
  const voll = [a.vorname, a.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  return voll ? `Dear ${voll}` : "Good day";
}
/** Ein Datum im Zahlenbild der Auftragssprache — für Nutzlast-Felder wie `stichtag_text`. */
export function globalTagText(v: Date | string | null | undefined, sprache: GlobalMailSprache = "de"): string {
  return sprache === "en" ? tagEn(v) : tagDe(v);
}

/**
 * Die Nutzlast einer Global-Mail — REIN (keine Datenbank, kein Netz), damit der
 * Prüfstand jede Vorlage in beiden Sprachen mit echten Feldern rendern kann.
 * Der Motor setzt Werte ungeprüft ins HTML — also hier entschärfen.
 *
 * `token` ist ein FRISCHES Zugangstoken für „Mein Auftrag" (30 Tage): Jede Mail,
 * die den Kunden zu Vertrag und Rechnung führt, bringt ihren eigenen Link mit.
 */
export function globalMailNutzlast(
  akte: any, b: any,
  opts: { ansprechpartner: string; token?: string | null; zusatz?: Record<string, string> },
): Record<string, string> {
  const sprache = globalSpracheVon(akte);
  const en = sprache === "en";
  const ap = json<Partial<GlobalAnsprechpartner>>(akte?.ansprechpartner, {});
  const firma = json<Partial<GlobalFirma>>(akte?.firma, {});
  const an = String(akte?.email || ap.email || b?.contact_email || b?.email || "").trim().toLowerCase();
  const paketKey = akte?.paket_key ?? b?.pack_key;
  const kat = katalogPaket(paketKey);
  const gp = globalPaket(paketKey);
  const betragCents = kat?.preisCents ?? Math.round(Number(b?.amount_due || 0) * 100);
  const ref = String(b?.ref || akte?.ref || "");
  const anrede = ap.nachname || ap.vorname
    ? (en ? anredeZeileEn(ap) : anredeZeile(ap))
    : (en ? (b?.contact_name ? `Dear ${b.contact_name}` : "Good day") : `Guten Tag${b?.contact_name ? ` ${b.contact_name}` : ""}`);
  return {
    email: an,
    sprache,
    anrede_zeile: escapeHtml(anrede),
    firma: escapeHtml(String(firma.name || akte?.firma_name || b?.company_name || (en ? "your company" : "Ihr Unternehmen"))),
    // Englisch heißt das Paket, wie es im englischen Auftrag heißt („FIAON Global Capital").
    paket: escapeHtml(en && gp ? `FIAON ${gp.en.name}` : (kat?.label ?? String(b?.pack_name || "FIAON Global"))),
    betrag_text: en ? eurEn(betragCents) : eur(betragCents),
    antrag_id: escapeHtml(ref),
    payment_reference: escapeHtml(String(b?.payment_reference || "")),
    faellig_am_text: b?.payment_due_date ? globalTagText(new Date(b.payment_due_date), sprache) : "",
    zahlungsseite_url: b?.payment_reference ? absoluteUrl(`/zahlung/${encodeURIComponent(String(b.payment_reference))}?bereich=business`) : "",
    mein_auftrag_url: ref && opts.token ? absoluteUrl(globalMeinAuftragPfad(ref, opts.token, sprache)) : "",
    ansprechpartner: escapeHtml(opts.ansprechpartner),
    // Die Unterlagen für den Start — je Auftraggeber (die Privatperson braucht keinen Registerauszug).
    unterlagen_liste: globalUnterlagenZeilen(sprache, firma.art === "privat").map((u) => `· ${escapeHtml(u)}`).join("<br />"),
    ...(opts.zusatz ?? {}),
  };
}

export async function globalMailSenden(
  event: GlobalMail, akte: any, b: any,
  extra: { anhaenge?: { name: string; inhalt: Buffer }[]; zusatz?: Record<string, string>; ausgeloestVon?: string } = {},
): Promise<{ ok: boolean; grund: string | null }> {
  const sprache = globalSpracheVon(akte);
  const ref = String(b?.ref || akte?.ref || "");
  const nutzlast = globalMailNutzlast(akte, b, {
    ansprechpartner: await ansprechpartnerName(akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null, sprache),
    token: ref ? globalTokenErzeugen(ref) : null,
    zusatz: extra.zusatz,
  });
  const an = nutzlast.email;
  let ok = false; let grund: string | null = null; let messageId: string | null = null;
  if (!an) grund = "keine E-Mail-Adresse am Auftrag";
  else {
    try {
      const { mailDirektSenden } = await import("../mail/motor");
      const erg = await mailDirektSenden(event, nutzlast, { anhaenge: extra.anhaenge });
      ok = erg.ok; grund = erg.ok ? (erg.grund ?? null) : (erg.grund || "unbekannt"); messageId = erg.messageId ?? null;
    } catch (e) { grund = e instanceof Error ? e.message : String(e); }
  }
  try {
    const { mailProtokoll } = await import("./fiaon-mail-log");
    await mailProtokoll({
      event, personId: b?.person_id != null ? Number(b.person_id) : null, empfaenger: an || null,
      status: ok ? "versandt" : "fehlgeschlagen", grund: ok ? grund : (grund || "unbekannt"),
      // Der Link zu „Mein Auftrag" ist ein Zugang — er gehört nicht im Klartext ins Protokoll.
      payload: { ...nutzlast, mein_auftrag_url: nutzlast.mein_auftrag_url ? "[Link zu Mein Auftrag]" : "", anhaenge: (extra.anhaenge ?? []).map((a) => a.name) },
      ausgeloestVon: extra.ausgeloestVon ?? "System (FIAON Global)", brevoMessageId: messageId,
    });
  } catch (e) { console.error(`[FIAON-GLOBAL] ${akte?.ref}: Mailprotokoll ${event}:`, e); }
  return { ok, grund: ok ? null : (grund || "unbekannt") };
}

/** Die Auftragsmail mit Vertrag und Rechnung — höchstens einmal je Auftrag, nachholbar. */
async function auftragsMailSenden(ref: string): Promise<{ ok: boolean; grund: string | null }> {
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_auftraege SET auftrag_mail_am = NOW(), auftrag_mail_fehler = NULL, updated_at = NOW()
     WHERE ref = ${ref} AND auftrag_mail_am IS NULL RETURNING id`) as any[];
  if (!frei) return { ok: true, grund: null };
  const akte = await globalAkteLesen(ref); const b = await bestellungLesen(ref);
  const anhaenge: { name: string; inhalt: Buffer }[] = [];
  let mail: { ok: boolean; grund: string | null };
  try {
    const vertrag = await globalVertragPdfLesen(ref);
    if (!vertrag) throw new Error("der unterschriebene Auftrag liegt nicht als PDF in der Akte");
    anhaenge.push({ name: `FIAON_Global_Auftrag_${ref}.pdf`, inhalt: vertrag });
    const rechnung = await globalRechnungPdf(ref);
    if (!rechnung) throw new Error("die Rechnung ließ sich nicht erzeugen");
    anhaenge.push({ name: rechnung.dateiname, inhalt: rechnung.pdf });
    mail = await globalMailSenden("global_auftrag", akte, b, { anhaenge });
  } catch (e) {
    mail = { ok: false, grund: e instanceof Error ? e.message : String(e) };
  }
  if (mail.ok) {
    // Dieselben Marken, an denen der Privatweg misst: „Zahlungsdaten sind raus".
    await sqlPool`UPDATE fiaon_applications SET payment_email_sent_at = COALESCE(payment_email_sent_at, NOW()), welcome_sent_at = COALESCE(welcome_sent_at, NOW()) WHERE ref = ${ref}`.catch(() => {});
    await verlauf(ref, `FIAON Global: Auftrag unterschrieben. Vertrag und Rechnung${b?.invoice_number ? ` ${b.invoice_number}` : ""} als PDF an ${akte?.email || "den Kunden"} geschickt — ${eur(Math.round(Number(b?.amount_due || 0) * 100))}, Verwendungszweck ${b?.payment_reference ?? "—"}.`);
  } else {
    await sqlPool`UPDATE fiaon_global_auftraege SET auftrag_mail_am = NULL, auftrag_mail_fehler = ${mail.grund}, updated_at = NOW() WHERE ref = ${ref}`.catch(() => {});
    await verlauf(ref, `FIAON Global: Die Mail mit Vertrag und Rechnung ging NICHT raus (${mail.grund}). Der Kunde sieht beides auf seiner Auftragsseite; bitte von Hand nachsenden.`);
  }
  return mail;
}

// ── Betreuer eintragen — dieselben Schreibschritte wie die Übergabe im Team-Bereich ──
/**
 * Trägt die zuständige Person als Betreuer ein, WENN NOCH NIEMAND eingetragen ist.
 *
 * Warum überhaupt: /agent/customers zeigt einem Mitarbeiter nur, was ihm
 * zugewiesen ist (Sicherheitsfix 03.08.2026). Ein Global-Auftrag ohne Betreuer
 * stünde bei niemandem — und die Sofortzuteilung (fiaon-zuteilung.ts) gäbe ihn
 * beim nächsten Tageslauf an den Privatkunden-Vertrieb.
 *
 * `mitBestellung`: die Kopie an der Bestellung mitziehen. VOR der Zahlung
 * bleibt sie leer — im Altmodell der Provision genügt eine Zuweisung für den
 * Anspruch, und eine Zuweisung durch diese Automatik ist keine Betreuung.
 */
async function betreuerSetzenWennFrei(ref: string, agentId: number, opts: { mitBestellung: boolean; nurWenn?: number | null }): Promise<boolean> {
  const [a] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  if (!a?.person_id) return false;
  const [ag] = (await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${agentId} AND COALESCE(active, TRUE) AND NOT COALESCE(is_test_account, FALSE) AND zugang_gesperrt_am IS NULL LIMIT 1`) as any[];
  if (!ag) return false;
  const alt = opts.nurWenn ?? null;
  const gesetzt = (await sqlPool`
    UPDATE fiaon_persons
       SET assigned_agent_id = ${agentId}, assigned_at = NOW(), betreuung_seit = COALESCE(betreuung_seit, NOW()), updated_at = NOW()
     WHERE id = ${a.person_id} AND merged_into_person_id IS NULL
       AND (assigned_agent_id IS NULL OR (${alt}::int IS NOT NULL AND assigned_agent_id = ${alt}::int))
     RETURNING id`) as any[];
  if (opts.mitBestellung) {
    await sqlPool`
      UPDATE fiaon_applications SET assigned_agent_id = ${agentId}, updated_at = NOW()
       WHERE ref = ${ref} AND (assigned_agent_id IS NULL OR (${alt}::int IS NOT NULL AND assigned_agent_id = ${alt}::int))`.catch(() => {});
  }
  if (gesetzt.length) await verlauf(ref, `FIAON Global: ${ag.name} ist als zuständige Person eingetragen (Einstellung global_zustaendig_agent_id bzw. Vertriebsleitung).`);
  return gesetzt.length > 0;
}

// ── Der Auftrag ──────────────────────────────────────────────────────────────
export interface GlobalAuftragErgebnis {
  ok: true; ref: string; token: string; betragCents: number; paketName: string;
  zahlungsseite: string; vertragUrl: string; rechnungUrl: string; email: string;
}
export type GlobalAuftragAntwort = GlobalAuftragErgebnis | { ok: false; status: number; error: string; feld?: string };

function antwortFuer(ref: string, paymentRef: string, paketKey: string, email: string): GlobalAuftragErgebnis {
  const token = globalTokenErzeugen(ref);
  const kat = katalogPaket(paketKey);
  const r = encodeURIComponent(ref); const t = encodeURIComponent(token);
  return {
    ok: true, ref, token, betragCents: kat?.preisCents ?? 0, paketName: kat?.label ?? paketKey,
    zahlungsseite: `/zahlung/${paymentRef}?bereich=business`,
    vertragUrl: `/api/fiaon/global/auftrag/${r}/vertrag.pdf?t=${t}`,
    rechnungUrl: `/api/fiaon/global/auftrag/${r}/rechnung.pdf?t=${t}`,
    email,
  };
}

/** Zwei gleichzeitige Absendungen desselben Formulars warten aufeinander — statt zwei Aufträge anzulegen. */
const laufend = new Map<string, Promise<GlobalAuftragAntwort>>();

export async function globalAuftragAnlegen(ein: GlobalEingabe, kontext: { ip: string; userAgent: string }): Promise<GlobalAuftragAntwort> {
  const schluessel = `${ein.firma.name.toLowerCase()}|${ein.ansprechpartner.email}|${ein.paket}`;
  const schon = laufend.get(schluessel);
  if (schon) return schon;
  const lauf = anlegen(ein, kontext).finally(() => laufend.delete(schluessel));
  laufend.set(schluessel, lauf);
  return lauf;
}

async function anlegen(ein: GlobalEingabe, kontext: { ip: string; userAgent: string }): Promise<GlobalAuftragAntwort> {
  await ensureGlobalTabelle();
  const kat = katalogPaket(ein.paket);
  if (!kat || kat.art !== "global" || kat.eingestellt) return fehler("Bitte wählen Sie eines der vier Pakete.", "paket");

  // ── Dieselbe Firma, dieselbe Adresse, dasselbe Paket, vor wenigen Minuten: derselbe Auftrag ──
  // Ein Doppelklick oder „Zurück und noch einmal senden" ist kein zweiter Kauf. Steht der erste
  // Versuch ohne Bestellung da (Abbruch zwischen zwei Schritten), wird er hier zu Ende geführt.
  const [vorhanden] = (await sqlPool`
    SELECT ref, bestaetigungen FROM fiaon_global_auftraege
     WHERE LOWER(email) = ${ein.ansprechpartner.email} AND paket_key = ${ein.paket} AND LOWER(firma_name) = ${ein.firma.name.toLowerCase()}
       AND status = 'offen' AND created_at > NOW() - INTERVAL '10 minutes'
     ORDER BY created_at DESC LIMIT 1`) as any[];
  if (vorhanden?.ref) {
    // Privatauftrag (E-191): Der Wunsch zum Beginn steht im UNTERSCHRIEBENEN Vertrag. Kommt derselbe Auftrag
    // mit der anderen Wahl noch einmal, wird er nicht still überschrieben — der Kunde erfährt es und schreibt uns.
    if ("sofortBeginn" in ein.bestaetigungen) {
      const vorher = json<Record<string, unknown>>(vorhanden.bestaetigungen, {}).sofortBeginn === true;
      if (vorher !== ein.bestaetigungen.sofortBeginn) {
        return fehler(`Diesen Auftrag haben Sie vor wenigen Minuten bereits erteilt (Referenz ${vorhanden.ref}) — ${vorher ? "mit dem Wunsch, dass wir sofort beginnen" : "ohne den Wunsch, dass wir vor Ablauf der Widerrufsfrist beginnen"}. Vertrag und Rechnung haben Sie per E-Mail. Möchten Sie Ihre Wahl ändern, schreiben Sie uns an support@fiaon.com.`, "bestaetigungen.sofortBeginn", 409);
      }
    }
    return fertigstellen(String(vorhanden.ref), ein);
  }

  if (zuViel(kontext.ip)) return fehler("Von Ihrem Anschluss kamen gerade mehrere Aufträge. Bitte versuchen Sie es in einigen Minuten noch einmal — oder schreiben Sie uns an support@fiaon.com.", undefined, 429);
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  const roboter = istRoboterUnterschrift(kontext.ip, kontext.userAgent);
  if (roboter.roboter) return fehler("Diese Unterschrift können wir nicht annehmen. Bitte öffnen Sie die Seite in Ihrem Browser und unterschreiben Sie dort.", "unterschriftPng");

  const ref = `FIAON-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").slice(0, 4).toUpperCase()}`;
  const jetzt = new Date();
  const einstellungen = await globalEinstellungen();
  // Reverse Charge nur MIT USt-IdNr. — fehlt sie, wird der Auftrag trotzdem angenommen,
  // die Rechnung geht im Modus „none" raus, und die Aufgabe sagt es der zuständigen Person.
  // Eine Privatperson hat keine USt-IdNr. und bekommt nie Reverse Charge: Ihr Preis ist ein Endpreis.
  const privat = ein.auftraggeber === "privat";
  const ustModus: UstModus = !privat && einstellungen.ustModus === "reverse_charge" && ein.firma.ustId ? "reverse_charge" : "none";
  const ustHinweis = !privat && einstellungen.ustModus === "reverse_charge" && !ein.firma.ustId
    ? "Der USt-Modus steht auf Reverse Charge, der Kunde hat aber keine USt-IdNr. angegeben — die Rechnung ging ohne Steuerausweis raus (Modus none). Bitte die USt-IdNr. erfragen und die Rechnung mit der Buchhaltung klären."
    : null;

  // ── 1. Ohne PDF keine Annahme ─────────────────────────────────────────────
  const vertragsDaten: GlobalVertragDaten = {
    paket: ein.paket, sprache: ein.sprache, ref, auftraggeber: ein.auftraggeber,
    sofortBeginn: "sofortBeginn" in ein.bestaetigungen ? ein.bestaetigungen.sofortBeginn : undefined,
    firma: { ...ein.firma }, ansprechpartner: { ...ein.ansprechpartner },
  };
  const hash = docHash(`global-auftrag|${ref}|${GLOBAL_VERTRAG_VERSION}|${ein.ansprechpartner.vorname} ${ein.ansprechpartner.nachname}|${jetzt.toISOString()}|${kontext.ip}|${globalVertragRumpfHtml(vertragsDaten)}`);
  let pdf: Buffer;
  try {
    pdf = await globalVertragPdf({ ...vertragsDaten, unterschrift: { png: ein.unterschriftPng, am: jetzt, ip: kontext.ip, hash } });
    if (!pdf || pdf.length < 1000) throw new Error("PDF leer");
  } catch (e) {
    console.error(`[FIAON-GLOBAL] ${ref}: Vertrags-PDF:`, e);
    return fehler("Ihr Auftrag konnte gerade nicht ausgefertigt werden — bitte versuchen Sie es in einer Minute noch einmal. Es wurde nichts gespeichert.", undefined, 500);
  }

  // ── 2. Der Antrag — über denselben Weg wie jedes Formular des Hauses ──────
  try {
    const port = process.env.PORT || 5000;
    const antwort = await fetch(`http://127.0.0.1:${port}/api/fiaon/application`, {
      method: "POST",
      // Adresse und Browser des MENSCHEN weiterreichen — sonst stünde 127.0.0.1 in der Bestellzeile.
      headers: { "Content-Type": "application/json", "x-forwarded-for": kontext.ip, "user-agent": kontext.userAgent || "fiaon-global" },
      body: JSON.stringify({
        ref, type: "business", status: "submitted", currentStep: 6,
        packKey: kat.key, packName: kat.label,
        // Privatperson: KEIN Firmenname an der Bestellung — die Rechnung nennt dann die Person selbst.
        companyName: privat ? null : ein.firma.name, legalForm: privat ? null : ein.firma.rechtsform, taxId: privat ? null : ein.firma.ustId,
        firstName: ein.ansprechpartner.vorname, lastName: ein.ansprechpartner.nachname,
        contactFirstName: ein.ansprechpartner.vorname, contactLastName: ein.ansprechpartner.nachname,
        contactEmail: ein.ansprechpartner.email, email: ein.ansprechpartner.email, billingEmail: ein.ansprechpartner.email,
        contactPhone: ein.ansprechpartner.telefon,
        street: ein.firma.strasse, zip: ein.firma.plz, city: ein.firma.ort, country: ein.firma.land,
        // ag1 = Vertragsbedingungen, ag3 = Vertragsannahme. ag2 wäre die Einwilligung in die
        // Bonitätsprüfung — die gibt es hier nicht, also wird sie auch nicht behauptet.
        ag1: true, ag2: false, ag3: true,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!antwort.ok) {
      const roh = await antwort.text().catch(() => "");
      console.error(`[FIAON-GLOBAL] ${ref}: application ${antwort.status}:`, roh.slice(0, 200));
      return fehler("Ihr Auftrag konnte gerade nicht angelegt werden — bitte versuchen Sie es in einer Minute noch einmal.", undefined, 502);
    }
  } catch (e) {
    console.error(`[FIAON-GLOBAL] ${ref}: application:`, e);
    return fehler("Ihr Auftrag konnte gerade nicht angelegt werden — bitte versuchen Sie es in einer Minute noch einmal.", undefined, 502);
  }

  // ── 3. Die Auftragsakte — der unterschriebene Auftrag liegt ab hier fest ──
  try {
    await sqlPool`
      INSERT INTO fiaon_global_auftraege
        (ref, paket_key, land, firma, ansprechpartner, ust_id, bestaetigungen, unterschrift_png, vertrag_pdf, vertrag_version, vertrag_sprache,
         unterschrieben_am, ip, user_agent, quelle, status, doc_hash, firma_name, email, rechnung_ust_modus, ust_hinweis)
      VALUES
        (${ref}, ${ein.paket}, ${ein.firma.land}, ${JSON.stringify(ein.firma)}::jsonb, ${JSON.stringify(ein.ansprechpartner)}::jsonb, ${ein.firma.ustId},
         ${JSON.stringify({ ...ein.bestaetigungen, am: jetzt.toISOString() })}::jsonb,
         ${Buffer.from(ein.unterschriftPng.slice("data:image/png;base64,".length), "base64")}, ${pdf}, ${GLOBAL_VERTRAG_VERSION}, ${ein.sprache},
         ${jetzt}, ${kontext.ip}, ${String(kontext.userAgent || "").slice(0, 500)}, ${ein.quelle}, 'offen', ${hash}, ${ein.firma.name}, ${ein.ansprechpartner.email},
         ${ustModus}, ${ustHinweis})`;
  } catch (e) {
    console.error(`[FIAON-GLOBAL] ${ref}: Auftragsakte nicht geschrieben — Antrag steht, Vertrag fehlt:`, e);
    return fehler("Ihr Auftrag konnte gerade nicht gespeichert werden — bitte versuchen Sie es in einer Minute noch einmal.", undefined, 500);
  }
  return fertigstellen(ref, ein);
}

/**
 * Bestellung und Rechnungsmodus — danach steht alles, was die Antwort braucht.
 * Aufgabe, Betreuer und Mail laufen HINTER der Antwort weiter (nacharbeit): Der
 * Kunde soll nach der Unterschrift nicht zwanzig Sekunden auf zwei Mailserver
 * warten. Jeder Schritt verträgt einen zweiten Anlauf; hängt die Mail, zeigt es
 * die Liste der Leitung mit dem Knopf „Vertrag + Rechnung senden".
 */
async function fertigstellen(ref: string, ein: GlobalEingabe): Promise<GlobalAuftragAntwort> {
  const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
  const bestellung = await bestellungFuerAntrag(ref, { globalMailFolgt: true });
  const paymentRef = String((bestellung.body as any)?.paymentReference || "");
  if (bestellung.status !== 200 || !paymentRef) {
    console.error(`[FIAON-GLOBAL] ${ref}: Bestellung nicht angelegt:`, bestellung.status, JSON.stringify(bestellung.body).slice(0, 200));
    return fehler("Ihr Auftrag ist gespeichert, die Rechnung ließ sich aber gerade nicht erzeugen. Bitte senden Sie das Formular in einer Minute noch einmal ab — es entsteht kein zweiter Auftrag.", undefined, 502);
  }
  const akte = await globalAkteLesen(ref);
  await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = ${String(akte?.rechnung_ust_modus || "none")} WHERE ref = ${ref}`
    .catch((e) => console.error(`[FIAON-GLOBAL] ${ref}: USt-Modus nicht an der Bestellung vermerkt:`, e));

  void nacharbeit(ref, ein, paymentRef, akte)
    .catch((e) => console.error(`[FIAON-GLOBAL] ${ref}: Nacharbeit (Aufgabe, Betreuer, Auftragsmail) abgebrochen — bitte unter /chef/s/global-auftraege nachsehen:`, e));
  return antwortFuer(ref, paymentRef, ein.paket, ein.ansprechpartner.email);
}

async function nacharbeit(ref: string, ein: GlobalEingabe, paymentRef: string, akte: any): Promise<void> {
  // Der Betrag kommt aus dem Katalog — weicht die Bestellzeile ab, ist das ein Fall für einen Menschen.
  const b = await bestellungLesen(ref);
  const kat = katalogPaket(ein.paket);
  const sollCents = kat?.preisCents ?? 0;
  const istCents = Math.round(Number(b?.amount_due || 0) * 100);
  const betragWarnung = sollCents > 0 && istCents !== sollCents
    ? `ACHTUNG: Die Bestellung steht auf ${eur(istCents)}, der Katalog sagt ${eur(sollCents)} — bitte vor jeder Zahlung klären.` : null;
  if (betragWarnung) console.error(`[FIAON-GLOBAL] ${ref}: ${betragWarnung}`);

  // ── Aufgabe an die zuständige Person (Muster E-177) — mit Mail „Neuer Auftrag für dich" ──
  // Beim zweiten Anlauf (Doppelklick, „Zurück und noch einmal") steht die zuständige Person schon
  // in der Akte — dann liegt die Aufgabe bereits bei ihr und wird nicht noch einmal kommentiert.
  let zustaendig: number | null = akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null;
  if (!zustaendig) try {
    const einstellungen = await globalEinstellungen();
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const ap = ein.ansprechpartner;
    const privat = ein.auftraggeber === "privat";
    const widerruf = privat && akte?.unterschrieben_am ? globalWiderrufsfrist(new Date(akte.unterschrieben_am)) : null;
    const sofort = "sofortBeginn" in ein.bestaetigungen && ein.bestaetigungen.sofortBeginn;
    const erg = await auftragFuerKunden({
      personId: b?.person_id != null ? Number(b.person_id) : null, ref,
      titel: `FIAON Global: neuer Auftrag — ${ein.firma.name}${privat ? " (Privatperson)" : ""}, ${kat?.label ?? ein.paket}`,
      text: [
        `${ein.firma.name} (${ein.firma.rechtsform}, ${ein.firma.plz} ${ein.firma.ort}, ${LAND_NAME[ein.firma.land]}) hat ${kat?.label ?? ein.paket} für ${eur(sollCents)} einmalig bestellt und den Auftrag unterschrieben.`,
        privat
          ? `Ansprechpartner: ${[ap.anrede, ap.vorname, ap.nachname].filter(Boolean).join(" ")} (beauftragt selbst, als Privatperson) · ${ap.email} · ${ap.telefon}`
          : `Ansprechpartner: ${[ap.anrede, ap.vorname, ap.nachname].filter(Boolean).join(" ")}, ${ap.funktion} · ${ap.email} · ${ap.telefon}`,
        privat && widerruf
          ? (sofort
            ? `PRIVATPERSON: Widerrufsrecht bis ${tagDe(widerruf.fristEnde)}. Der Kunde hat ausdrücklich verlangt, dass wir sofort beginnen — der Auftrag startet mit dem Zahlungseingang. Widerruft er, zahlt er anteilig für das bis dahin Erbrachte.`
            : `PRIVATPERSON: Widerrufsrecht bis ${tagDe(widerruf.fristEnde)}. Der Kunde hat NICHT verlangt, dass wir vorher beginnen — der Auftrag startet frühestens am ${tagDe(widerruf.startAb)} von selbst, auch wenn die Zahlung früher eingeht. Bis dahin nichts beantragen und keine Gebühren auslösen.`)
          : null,
        `Vertrag und Rechnung${b?.invoice_number ? ` ${b.invoice_number}` : ""} sind per Mail beim Kunden; gezahlt wird per Überweisung, Verwendungszweck ${paymentRef}, Zahlungsseite ${absoluteUrl(`/zahlung/${paymentRef}`)}.`,
        privat && widerruf && !sofort
          ? `Bitte kurz anrufen, den Eingang des Auftrags bestätigen und Fragen zur Überweisung klären. Nach dem Zahlungseingang wartet der Auftrag bis zum ${tagDe(widerruf.startAb)}; dann startet er von selbst und du bekommst die Aufgabe „US-Struktur starten“ mit der Unterlagenliste.`
          : "Bitte kurz anrufen, den Eingang des Auftrags bestätigen und Fragen zur Überweisung klären. MIT DEM ZAHLUNGSEINGANG startet der Auftrag von selbst: Du bekommst dann die Aufgabe „US-Struktur starten“ mit der Unterlagenliste.",
        akte?.ust_hinweis ? `Rechnung: ${akte.ust_hinweis}` : null,
        betragWarnung,
        `Der Auftrag im Office: ${globalOfficeAuftragPfad(ref)} · Übersicht der Leitung: /chef/s/global-auftraege`,
      ].filter(Boolean).join("\n"),
      schluessel: `global:${ref}:auftrag`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: globalOfficeAuftragPfad(ref),
      agentId: einstellungen.zustaendigAgentId,
      anlageText: "Auftrag über /business/start eingegangen und unterschrieben.",
    });
    if (erg.agentId) {
      zustaendig = erg.agentId;
      await sqlPool`UPDATE fiaon_global_auftraege SET zustaendig_agent_id = ${erg.agentId}, updated_at = NOW() WHERE ref = ${ref} AND zustaendig_agent_id IS DISTINCT FROM ${erg.agentId}`;
      await betreuerSetzenWennFrei(ref, erg.agentId, { mitBestellung: false });
    }
  } catch (e) {
    console.error(`[FIAON-GLOBAL] ${ref}: Aufgabe zum neuen Auftrag nicht angelegt — niemand im Haus weiß von diesem Auftrag außer der Liste /chef/s/global-auftraege:`, e);
  }

  // ── Die eine Mail an den Kunden ────────────────────────────────────────────
  const mail = await auftragsMailSenden(ref).catch((e) => ({ ok: false, grund: String(e) }));
  if (!mail.ok) console.error(`[FIAON-GLOBAL] ${ref}: Auftragsmail nicht versandt: ${mail.grund}`);
}

// ── Eine Global-Bestellung, die NICHT über den Bestellweg kam ────────────────
export async function globalOhneAuftragMelden(ref: string): Promise<void> {
  await ensureGlobalTabelle();
  if (await globalAkteLesen(ref)) return;
  const b = await bestellungLesen(ref);
  if (!b || !istGlobalPaket(b.pack_key)) return;
  const einstellungen = await globalEinstellungen();
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: b.person_id != null ? Number(b.person_id) : null, ref,
    titel: `FIAON Global: Bestellung ohne unterschriebenen Auftrag — ${b.company_name || b.contact_name || ref}`,
    text: [
      `Für ${b.company_name || b.contact_name || "diesen Kunden"} wurde ${String(b.pack_name || b.pack_key)} angelegt — aber nicht über /business/start. Es gibt deshalb KEINEN unterschriebenen Auftrag, und der Kunde hat KEINE Mail bekommen (die Zahlungsmail der Privatkunden geht für FIAON Global nicht raus).`,
      `Bitte den Kunden auf ${absoluteUrl("/business/start")} führen — dort liest und unterschreibt er den Auftrag und bekommt Vertrag und Rechnung als PDF. Die offene Bestellung ${b.payment_reference ?? ref} danach archivieren lassen, damit keine zwei Rechnungen offen sind.`,
    ].join("\n"),
    dringend: true, schluessel: `global:${ref}:ohne-auftrag`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
    agentId: einstellungen.zustaendigAgentId, anlageText: "Global-Bestellung außerhalb des Bestellwegs angelegt.",
  });
}

/** Der Kunde hat auf der Zahlungsseite „überwiesen" gemeldet — die zuständige Person erfährt es an ihrer Aufgabe. */
export async function globalZahlungGemeldet(ref: string): Promise<void> {
  const akte = await globalAkteLesen(ref);
  const b = await bestellungLesen(ref);
  if (!b) return;
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: b.person_id != null ? Number(b.person_id) : null, ref,
    titel: `FIAON Global: neuer Auftrag — ${akte?.firma_name || b.company_name || ref}, ${String(b.pack_name || b.pack_key)}`,
    text: `Der Kunde hat am ${tagDe(new Date())} auf der Zahlungsseite gemeldet, dass er ${eur(Math.round(Number(b.amount_due || 0) * 100))} überwiesen hat (Verwendungszweck ${b.payment_reference ?? "—"}). Den Eingang prüft die Zahlungsstelle; sobald er gebucht ist, startet der Auftrag von selbst.`,
    schluessel: `global:${ref}:auftrag`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
    link: globalOfficeAuftragPfad(ref),
    agentId: akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : (await globalEinstellungen()).zustaendigAgentId,
  });
  await verlauf(ref, "FIAON Global: Der Kunde hat auf der Zahlungsseite gemeldet, dass er überwiesen hat. Keine Privatkunden-Mail; die zuständige Person ist informiert.");
}

// ── PRIVATAUFTRAG: START NACH DER WIDERRUFSFRIST ─────────────────────────────
/**
 * Wartet dieser Auftrag noch auf das Ende der Widerrufsfrist? Nur ein Privatauftrag ohne den
 * ausdrücklichen Wunsch nach sofortigem Beginn — dann Fristende und Starttag (JJJJ-MM-TT), sonst null.
 */
export function globalStartWartet(akte: any, jetzt: Date = new Date()): { fristEnde: string; startAb: string } | null {
  if (!akte || !globalIstPrivat(akte.firma)) return null;
  if (json<Record<string, unknown>>(akte.bestaetigungen, {}).sofortBeginn === true) return null;
  const am = akte.unterschrieben_am ? new Date(akte.unterschrieben_am) : null;
  if (!am || Number.isNaN(am.getTime())) return null;
  const frist = globalWiderrufsfrist(am);
  return berlinToday(jetzt) < frist.startAb ? frist : null;
}

/**
 * Der Stundenlauf für bezahlte Privataufträge, die die Widerrufsfrist abgewartet haben: Ist der
 * Starttag erreicht, startet globalNachZahlung sie — wiederholbar, derselbe Weg wie nach jeder
 * Zahlung. Nur im Sendefenster der Kundenmails, weil die Startmail mitgeht.
 * Registriert in routes.ts als tageslauf("global_widerruf_start", …, 60 Minuten).
 */
export async function globalWiderrufsStartLauf(jetzt: Date = new Date()): Promise<{ geprueft: number; gestartet: number; grund?: string }> {
  const { imSendefenster } = await import("./fiaon-global-zahlungstakt");
  if (!imSendefenster(jetzt)) return { geprueft: 0, gestartet: 0, grund: "außerhalb des Sendefensters (Berlin 8–20 Uhr, Mo–Sa)" };
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_auftraege') AS tabelle`) as any[];
  if (!t?.tabelle) return { geprueft: 0, gestartet: 0, grund: "noch kein Global-Auftrag" };
  const zeilen = (await sqlPool`
    SELECT g.ref, g.firma, g.bestaetigungen, g.unterschrieben_am
      FROM fiaon_global_auftraege g
      JOIN fiaon_applications a ON a.ref = g.ref
     -- firma liegt als JSON-TEXT in der jsonb-Spalte (postgres.js verpackt den String noch einmal) —
     -- #>> '{}' holt den Text heraus, ::jsonb macht wieder ein Objekt daraus. Klappt auch für echte Objekte.
     WHERE g.status = 'bezahlt' AND ((g.firma #>> '{}')::jsonb ->> 'art') = 'privat'
       AND a.payment_status = 'paid' AND a.cancelled_at IS NULL AND a.merged_into IS NULL
     ORDER BY g.unterschrieben_am ASC
     LIMIT 50`) as any[];
  let gestartet = 0;
  for (const z of zeilen) {
    if (globalStartWartet(z, jetzt)) continue;
    const erg = await globalNachZahlung(String(z.ref), { jetzt })
      .catch((e) => { console.error(`[FIAON-GLOBAL] ${z.ref}: Start nach der Widerrufsfrist abgebrochen:`, e); return { gestartet: false }; });
    if (erg.gestartet) gestartet++;
  }
  if (gestartet) console.log(`[FIAON-GLOBAL] Start nach der Widerrufsfrist: ${gestartet} von ${zeilen.length} Privataufträgen gestartet.`);
  return { geprueft: zeilen.length, gestartet };
}

// ── ZAHLUNGSEINGANG = START ──────────────────────────────────────────────────
/**
 * Gerufen am Ende von onCustomerPaid (fiaon-agent.ts) — NACH der Provisionsfrage.
 * Reihenfolge: bezahlt vermerken → Aufgabe „US-Struktur starten" → ERST DANN
 * „gestartet", Betreuer, Startmail. Jeder Schritt ist wiederholbar; ein zweiter
 * Aufruf (zweiter Klick, Nachbuchungs-Center, Kontoabgleich) startet nichts doppelt.
 */
export async function globalNachZahlung(ref: string, opts: { jetzt?: Date } = {}): Promise<{ gestartet: boolean; grund?: string }> {
  await ensureGlobalTabelle();
  const b = await bestellungLesen(ref);
  if (!b || !istGlobalPaket(b.pack_key)) return { gestartet: false, grund: "kein Global-Auftrag" };
  if (String(b.payment_status) !== "paid") return { gestartet: false, grund: "nicht bezahlt" };
  await sqlPool`
    UPDATE fiaon_global_auftraege SET status = 'bezahlt', bezahlt_am = COALESCE(bezahlt_am, ${b.completed_at ?? new Date()}), updated_at = NOW()
     WHERE ref = ${ref} AND status = 'offen'`;
  const akte = await globalAkteLesen(ref);
  const kat = katalogPaket(b.pack_key);
  const firmenName = String(akte?.firma_name || b.company_name || b.contact_name || ref);
  const betragCents = Math.round(Number(b.amount_due || 0) * 100);
  const privat = globalIstPrivat(akte?.firma);

  // ── Privatauftrag ohne den Wunsch nach sofortigem Beginn: erst nach der Widerrufsfrist ──
  // Bezahlt ist er (oben vermerkt); gestartet wird er vom Stundenlauf globalWiderrufsStartLauf.
  const warten = globalStartWartet(akte, opts.jetzt);
  if (warten) {
    try {
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: b.person_id != null ? Number(b.person_id) : null, ref,
        titel: `FIAON Global: bezahlt, Start nach der Widerrufsfrist — ${firmenName}, ${kat?.label ?? String(b.pack_name || b.pack_key)}`,
        text: [
          `Die Zahlung über ${eur(betragCents)} ist eingegangen. ${firmenName} hat als Privatperson beauftragt und NICHT verlangt, dass wir vor Ablauf der Widerrufsfrist beginnen.`,
          `Die Widerrufsfrist endet am ${tagDe(warten.fristEnde)}. Der Auftrag startet am ${tagDe(warten.startAb)} von selbst — dann kommt die Aufgabe „US-Struktur starten“ und der Kunde die Startmail.`,
          "Bis dahin: nichts beantragen und keine Gebühren auslösen. Ein Anruf zur Begrüßung ist in Ordnung.",
          "Widerruft der Kunde (Brief oder E-Mail genügt), sofort die Leitung informieren: Das Geld geht binnen 14 Tagen vollständig zurück.",
        ].join("\n"),
        schluessel: `global:${ref}:widerruf`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
        link: globalOfficeAuftragPfad(ref),
        agentId: (akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null) ?? (await globalEinstellungen()).zustaendigAgentId,
        anlageText: "Zahlungseingang gebucht — Start nach der Widerrufsfrist.",
      });
    } catch (e) {
      console.error(`[FIAON-GLOBAL] ${ref}: Aufgabe „Start nach der Widerrufsfrist" nicht angelegt:`, e);
    }
    await verlauf(ref, `FIAON Global: Zahlung gebucht. Privatauftrag ohne Wunsch nach sofortigem Beginn — Start am ${tagDe(warten.startAb)} (Widerrufsfrist bis ${tagDe(warten.fristEnde)}).`);
    return { gestartet: false, grund: `Privatauftrag: Start am ${tagDe(warten.startAb)}, nach der Widerrufsfrist` };
  }

  // Was die Provisions-Maschine gebucht hat — gelesen, nie geschrieben.
  const provisionen = (await sqlPool`
    SELECT c.kind, c.amount_cents, c.rate_bp, ag.name
      FROM fiaon_commissions c LEFT JOIN fiaon_agents ag ON ag.id = c.agent_id
     WHERE c.ref = ${ref} AND c.status <> 'storniert' AND c.amount_cents > 0 ORDER BY c.id`.catch(() => [])) as any[];
  const provisionSatz = provisionen.length
    ? "Provision gebucht: " + provisionen.map((p) => `${eur(Number(p.amount_cents))} (${Number(p.rate_bp) / 100} %, ${p.kind === "override" ? "Team-Umsatzbeteiligung" : "Abschluss"}) für ${p.name || "—"}`).join("; ") + "."
    : "Provision: keine gebucht — vor der Zahlung ist kein Gespräch eines Mitarbeiters dokumentiert (Direktzahler, Hausregel). Wer anders entscheiden will: Nachbuchungs-Center; der Satz für FIAON Global steht in global_provision_prozent.";

  const einstellungen = await globalEinstellungen();
  let agentId: number | null = null; let aufgabeId: number | null = null;
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const ap = json<Partial<GlobalAnsprechpartner>>(akte?.ansprechpartner, {});
    const erg = await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref,
      titel: `FIAON Global: US-Struktur starten — ${firmenName}, ${kat?.label ?? String(b.pack_name || b.pack_key)}`,
      text: [
        privat && json<Record<string, unknown>>(akte?.bestaetigungen, {}).sofortBeginn !== true
          ? `Die Widerrufsfrist ist abgelaufen und die Zahlung über ${eur(betragCents)} liegt vor — der Auftrag startet JETZT. Der Kunde bekommt die Startmail mit deinem Namen: Er erwartet, dass du dich meldest.`
          : `Die Zahlung über ${eur(betragCents)} ist eingegangen — der Auftrag startet JETZT. Der Kunde bekommt die Startmail mit deinem Namen: Er erwartet, dass du dich meldest.`,
        ap.email || ap.telefon ? `Ansprechpartner: ${[ap.anrede, ap.vorname, ap.nachname].filter(Boolean).join(" ")}${ap.funktion ? `, ${ap.funktion}` : ""} · ${ap.email ?? "—"} · ${ap.telefon ?? "—"}` : null,
        "1. Startgespräch vereinbaren und führen.",
        `2. Im Startgespräch den STICHTAG für Gesellschaft und EIN festlegen und im Auftrag eintragen (${globalOfficeAuftragPfad(ref)}, „Stichtag setzen“) — an ihm hängt die Geld-zurück-Zusage aus Ziffer 6 des Auftrags. Der Kunde bekommt ihn von dort in Textform.`,
        `3. Unterlagen einsammeln: ${globalUnterlagenZeilen("de", privat).join("; ")}. Der Kunde lädt sie in „Mein Auftrag“ hoch (Link in seiner Startmail); was dort liegt, siehst du im Auftrag.`,
        // 18.09.2026: Festpreis — alles für die Leistungen des Pakets ist enthalten (GLOBAL_INKLUSIVE, Ziffer 5 des Auftrags).
        "4. Staatsgebühren, Registered Agent im ersten Jahr und die Honorare der Partner für die Paketleistungen sind im Festpreis enthalten — dem Kunden NICHTS davon extra berechnen. Laufende Kosten ab dem zweiten Jahr im Startgespräch erklären.",
        privat ? "5. PRIVATPERSON: Der Kunde wird selbst Gesellschafter der US-Gesellschaft. Kein Registerauszug nötig; Meldung nach § 138 AO betrifft ihn persönlich (Partner-Steuerberater)." : null,
        akte ? null : "ACHTUNG: Zu dieser Bestellung gibt es keinen unterschriebenen Auftrag (nicht über /business/start angelegt). Vor dem Start unterschreiben lassen.",
        akte?.ust_hinweis ? `Rechnung: ${akte.ust_hinweis}` : null,
        provisionSatz,
      ].filter(Boolean).join("\n"),
      dringend: true, schluessel: `global:${ref}:start`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: globalOfficeAuftragPfad(ref),
      agentId: (akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null) ?? einstellungen.zustaendigAgentId,
      anlageText: "Zahlungseingang gebucht — Auftrag startet.",
    });
    agentId = erg.agentId; aufgabeId = erg.id;
  } catch (e) {
    console.error(`[FIAON-GLOBAL] ${ref}: Aufgabe „US-Struktur starten" nicht angelegt:`, e);
  }
  // Ohne Aufgabe kein „gestartet" und keine Startmail: Die Mail sagt „Ihr Ansprechpartner meldet
  // sich" — das darf erst rausgehen, wenn es bei jemandem auf dem Tisch liegt. Die Liste zeigt den
  // Auftrag dann als „bezahlt, nicht gestartet" mit dem Knopf „Start anstoßen".
  if (!aufgabeId) return { gestartet: false, grund: "Aufgabe nicht angelegt" };

  await sqlPool`
    UPDATE fiaon_global_auftraege
       SET status = 'gestartet', gestartet_am = COALESCE(gestartet_am, NOW()),
           zustaendig_agent_id = COALESCE(${agentId}, zustaendig_agent_id), updated_at = NOW()
     WHERE ref = ${ref} AND status IN ('offen', 'bezahlt')`;
  // „Mein Auftrag": Etappe 1 („Gründung und Dokumente") und die Zeile im Verlauf, die der Kunde liest.
  // Wiederholbar (wirkt nur von Etappe 0 aus) und nie ein Grund, den Start aufzuhalten.
  await import("./fiaon-global-bereich").then((m) => m.globalStartVermerken(ref))
    .catch((e) => console.error(`[FIAON-GLOBAL] ${ref}: Etappe 1 / Verlauf nicht vermerkt:`, e));
  // Die Provisionsfrage ist entschieden (diese Funktion läuft danach) — jetzt darf auch die Kopie an der Bestellung mit.
  if (agentId) await betreuerSetzenWennFrei(ref, agentId, { mitBestellung: true }).catch((e) => console.error(`[FIAON-GLOBAL] ${ref}: Betreuer:`, e));

  // Die Startmail — genau einmal. Die Marke ist dieselbe wie bei payment_confirmed.
  const [frei] = (await sqlPool`
    UPDATE fiaon_applications SET confirmed_email_sent_at = NOW() WHERE ref = ${ref} AND confirmed_email_sent_at IS NULL RETURNING ref`) as any[];
  if (frei) {
    const frisch = (await globalAkteLesen(ref)) ?? { ref, paket_key: b.pack_key, zustaendig_agent_id: agentId };
    const mail = await globalMailSenden("global_start", frisch, b);
    if (mail.ok) {
      await sqlPool`UPDATE fiaon_global_auftraege SET start_mail_am = NOW(), start_mail_fehler = NULL, updated_at = NOW() WHERE ref = ${ref}`.catch(() => {});
      await verlauf(ref, "FIAON Global: Zahlung gebucht, Aufgabe „US-Struktur starten“ vergeben, Startmail an den Kunden verschickt.");
    } else {
      // Marke zurück — der nächste Anlauf („Start anstoßen") darf es wieder versuchen.
      await sqlPool`UPDATE fiaon_applications SET confirmed_email_sent_at = NULL WHERE ref = ${ref}`.catch(() => {});
      await sqlPool`UPDATE fiaon_global_auftraege SET start_mail_fehler = ${mail.grund}, updated_at = NOW() WHERE ref = ${ref}`.catch(() => {});
      await verlauf(ref, `FIAON Global: Zahlung gebucht und Aufgabe vergeben — die Startmail ging NICHT raus (${mail.grund}). Bitte den Kunden anrufen.`);
    }
  }
  return { gestartet: true };
}

// ── Die Liste für die Leitung ────────────────────────────────────────────────
export async function globalAuftraegeListe(): Promise<{ zeilen: Record<string, unknown>[]; mitarbeiter: { id: number; name: string; rolle: string }[]; einstellungen: GlobalEinstellungen }> {
  await ensureGlobalTabelle();
  // Die Liste liest die Aufgabentabelle mit (Start-Aufgabe) — sie muss da sein, bevor die erste Aufgabe je angelegt wurde.
  await import("../routes/fiaon-betreiber-todo").then((m) => m.ensureTodoTabelle()).catch(() => {});
  // Die Marken des Zahlungstakts und des Stornos liegen an derselben Akte, werden aber von ihren eigenen
  // Dateien angelegt — die Liste liest sie mit und stellt deshalb sicher, dass es die Spalten gibt.
  await import("./fiaon-global-zahlungstakt").then((m) => m.ensureTaktSpalten());
  await import("./fiaon-global-storno").then((m) => m.ensureStornoSpalten());
  const rows = (await sqlPool`
    SELECT a.ref, a.pack_key, a.pack_name, a.company_name, a.contact_name, a.city, a.amount_due, a.payment_reference, a.payment_status,
           a.payment_due_date, a.invoice_number, a.created_at, a.completed_at, a.claimed_paid_at, a.archived_at, a.person_id,
           g.id AS akte_id, g.status AS akte_status, g.firma, g.ansprechpartner, g.email, g.zustaendig_agent_id, g.stichtag, g.unterschrieben_am,
           g.gestartet_am, g.rechnung_ust_modus, g.ust_hinweis, g.auftrag_mail_am, g.auftrag_mail_fehler, g.start_mail_am, g.start_mail_fehler,
           g.stichtag_mail_am, g.vertrag_sprache, g.quelle, (g.vertrag_pdf IS NOT NULL) AS hat_vertrag,
           g.zahlung_erinnerung_1_am, g.zahlung_erinnerung_2_am, g.zahlung_aufgabe_am, g.zahlung_takt_hinweis,
           g.storniert_am, g.storniert_von, g.storno_grund, g.storno_erstattung,
           z.name AS zustaendig_name, bt.name AS betreuer_name,
           (SELECT t.id FROM fiaon_betreiber_todos t WHERE t.schluessel = 'global:' || a.ref || ':start' LIMIT 1) AS start_aufgabe_id
      FROM fiaon_applications a
      LEFT JOIN fiaon_global_auftraege g ON g.ref = a.ref
      LEFT JOIN fiaon_agents z ON z.id = g.zustaendig_agent_id
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
      LEFT JOIN fiaon_agents bt ON bt.id = p.assigned_agent_id
     WHERE a.pack_key = ANY(${GLOBAL_SCHLUESSEL}) AND a.merged_into IS NULL
     ORDER BY a.created_at DESC
     LIMIT 300`) as any[];
  // Etappe und Abschluss aus „Mein Auftrag" — eigene, fehlertolerante Abfrage: Klappt das Anlegen der
  // Spalten einmal nicht (lock_timeout), bleibt die Liste der Leitung trotzdem vollständig lesbar.
  const bereich = new Map<string, { etappe: number; abgeschlossenAm: string | null }>();
  try {
    await import("./fiaon-global-bereich").then((m) => m.ensureGlobalBereich());
    const e = (await sqlPool`SELECT ref, etappe, abgeschlossen_am FROM fiaon_global_auftraege`) as any[];
    for (const z of e) bereich.set(String(z.ref), { etappe: Number(z.etappe || 0), abgeschlossenAm: z.abgeschlossen_am ? new Date(z.abgeschlossen_am).toISOString() : null });
  } catch (e) { console.error("[FIAON-GLOBAL] Liste: Etappen nicht gelesen:", e); }
  const zeilen = rows.map((r) => {
    const firma = json<Partial<GlobalFirma>>(r.firma, {});
    const ap = json<Partial<GlobalAnsprechpartner>>(r.ansprechpartner, {});
    const kat = katalogPaket(r.pack_key);
    const erstellt = new Date(r.created_at);
    return {
      ref: String(r.ref),
      // Ohne Auftragsakte (Bestellung außerhalb des Bestellwegs) gibt es kein „gestartet" in der Akte —
      // dort zählt, ob die Aufgabe „US-Struktur starten" angelegt wurde.
      status: r.archived_at ? "storniert" : statusAus({ status: !r.akte_id && r.start_aufgabe_id ? "gestartet" : r.akte_status }, r),
      ohneAuftrag: !r.akte_id,
      firma: String(firma.name || r.company_name || "—"), ort: String(firma.ort || r.city || ""), land: firma.land ?? null,
      ansprechpartner: [ap.anrede, ap.vorname, ap.nachname].filter(Boolean).join(" ") || String(r.contact_name || ""),
      funktion: ap.funktion ?? null, email: r.email ?? null, telefon: ap.telefon ?? null,
      paket: String(r.pack_key), paketName: kat?.label ?? String(r.pack_name || r.pack_key),
      betragCents: Math.round(Number(r.amount_due || 0) * 100), katalogCents: kat?.preisCents ?? null,
      erstelltAm: erstellt.toISOString(), alterTage: Math.max(0, Math.floor((Date.now() - erstellt.getTime()) / 86_400_000)),
      unterschriebenAm: r.unterschrieben_am ? new Date(r.unterschrieben_am).toISOString() : null,
      zahlungGemeldetAm: r.claimed_paid_at ? new Date(r.claimed_paid_at).toISOString() : null,
      bezahltAm: r.completed_at && String(r.payment_status) === "paid" ? new Date(r.completed_at).toISOString() : null,
      gestartetAm: r.gestartet_am ? new Date(r.gestartet_am).toISOString() : null,
      faelligAm: r.payment_due_date ? berlinToday(new Date(r.payment_due_date)) : null,
      verwendungszweck: r.payment_reference ?? null, rechnungsnummer: r.invoice_number ?? null,
      ustModus: r.rechnung_ust_modus ?? "none", ustHinweis: r.ust_hinweis ?? null,
      zustaendig: r.zustaendig_agent_id ? { id: Number(r.zustaendig_agent_id), name: String(r.zustaendig_name || `Mitarbeiter ${r.zustaendig_agent_id}`) } : null,
      betreuer: r.betreuer_name ?? null,
      stichtag: r.stichtag ? isoTag(r.stichtag) : null, stichtagMailAm: r.stichtag_mail_am ? new Date(r.stichtag_mail_am).toISOString() : null,
      auftragMailAm: r.auftrag_mail_am ? new Date(r.auftrag_mail_am).toISOString() : null, auftragMailFehler: r.auftrag_mail_fehler ?? null,
      startMailAm: r.start_mail_am ? new Date(r.start_mail_am).toISOString() : null, startMailFehler: r.start_mail_fehler ?? null,
      sprache: r.vertrag_sprache ?? null, quelle: r.quelle ?? null,
      // Der ruhige Zahlungstakt: wann erinnert wurde, wann die Aufgabe „anrufen" entstand, was ihn aufhielt.
      erinnerung1Am: r.zahlung_erinnerung_1_am ? new Date(r.zahlung_erinnerung_1_am).toISOString() : null,
      erinnerung2Am: r.zahlung_erinnerung_2_am ? new Date(r.zahlung_erinnerung_2_am).toISOString() : null,
      anrufAufgabeAm: r.zahlung_aufgabe_am ? new Date(r.zahlung_aufgabe_am).toISOString() : null,
      taktHinweis: r.zahlung_takt_hinweis ?? null,
      // Der Storno: wer, wann, warum, mit oder ohne Erstattung.
      storniertAm: r.storniert_am ? new Date(r.storniert_am).toISOString() : null,
      storniertVon: r.storniert_von ?? null, stornoGrund: r.storno_grund ?? null,
      stornoErstattung: r.storno_erstattung === true,
      vertragUrl: r.hat_vertrag ? `/api/fiaon/admin/global/auftraege/${encodeURIComponent(String(r.ref))}/vertrag.pdf` : null,
      rechnungUrl: r.payment_reference ? `/api/fiaon/admin/global/auftraege/${encodeURIComponent(String(r.ref))}/rechnung.pdf` : null,
      zahlungsseite: r.payment_reference ? `/zahlung/${r.payment_reference}` : null,
      // „Mein Auftrag" (E-188): Etappe 0–5, Abschluss, der Auftrag im Office und der Link, den der Kunde
      // öffnet — mit frischem Token, nur für Aufträge mit Akte.
      etappe: bereich.get(String(r.ref))?.etappe ?? 0,
      abgeschlossenAm: bereich.get(String(r.ref))?.abgeschlossenAm ?? null,
      officeLink: r.akte_id ? globalOfficeAuftragPfad(String(r.ref)) : null,
      kundenLink: r.akte_id ? globalMeinAuftragUrl(String(r.ref), String(r.vertrag_sprache) === "en" ? "en" : "de") : null,
    };
  });
  return { zeilen, mitarbeiter: await globalMitarbeiter(), einstellungen: await globalEinstellungen() };
}

/** Wer zuständig sein kann: aktive, echte, nicht gesperrte Mitarbeiter aus Vertrieb und Leitung. */
export async function globalMitarbeiter(): Promise<{ id: number; name: string; rolle: string }[]> {
  const rows = (await sqlPool`
    SELECT id, name, COALESCE(rolle, 'agent') AS rolle FROM fiaon_agents
     WHERE COALESCE(active, TRUE) AND NOT COALESCE(is_test_account, FALSE) AND zugang_gesperrt_am IS NULL
       AND COALESCE(rolle, 'agent') IN ('agent', 'vertriebsleiter')
     ORDER BY name ASC`.catch(() => [])) as any[];
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name), rolle: String(r.rolle) }));
}

export async function globalStichtagSetzen(ref: string, stichtagRoh: unknown, wer: string, mitteilen: boolean): Promise<{ ok: boolean; error?: string; meldung?: string }> {
  await ensureGlobalTabelle();
  const akte = await globalAkteLesen(ref);
  if (!akte) return { ok: false, error: "Zu dieser Bestellung gibt es keinen unterschriebenen Auftrag — ein Stichtag braucht einen Vertrag, auf den er sich bezieht." };
  const tag = String(stichtagRoh ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || Number.isNaN(new Date(`${tag}T12:00:00Z`).getTime())) return { ok: false, error: "Bitte ein Datum wählen." };
  if (tag <= berlinToday()) return { ok: false, error: "Der Stichtag liegt in der Zukunft — er ist der Tag, bis zu dem Gesellschaft und EIN stehen sollen." };
  const b = await bestellungLesen(ref);
  if (String(b?.payment_status) !== "paid") return { ok: false, error: "Der Stichtag wird im Startgespräch festgelegt — und das gibt es erst nach dem Zahlungseingang." };
  await sqlPool`UPDATE fiaon_global_auftraege SET stichtag = ${tag}::date, stichtag_gesetzt_von = ${wer}, updated_at = NOW() WHERE ref = ${ref}`;
  await verlauf(ref, `FIAON Global: Stichtag für Gesellschaft und EIN auf den ${tagDe(tag)} gesetzt (${wer}).`);
  if (!mitteilen) return { ok: true, meldung: `Stichtag ${tagDe(tag)} eingetragen. Der Auftrag sagt zu, dass der Kunde ihn in Textform bekommt — bitte noch mitteilen.` };
  const frisch = await globalAkteLesen(ref);
  const mail = await globalMailSenden("global_stichtag", frisch, b, { zusatz: { stichtag_text: globalTagText(tag, globalSpracheVon(frisch)) }, ausgeloestVon: wer });
  if (mail.ok) await sqlPool`UPDATE fiaon_global_auftraege SET stichtag_mail_am = NOW(), updated_at = NOW() WHERE ref = ${ref}`.catch(() => {});
  return { ok: true, meldung: mail.ok ? `Stichtag ${tagDe(tag)} eingetragen und dem Kunden per Mail mitgeteilt.` : `Stichtag ${tagDe(tag)} eingetragen — die Mail an den Kunden ging NICHT raus (${mail.grund}). Bitte von Hand mitteilen.` };
}

export async function globalZustaendigAendern(ref: string, agentIdRoh: unknown, wer: string): Promise<{ ok: boolean; error?: string; meldung?: string }> {
  await ensureGlobalTabelle();
  const akte = await globalAkteLesen(ref);
  if (!akte) return { ok: false, error: "Zu dieser Bestellung gibt es keine Auftragsakte." };
  const agentId = Number(agentIdRoh);
  const ziel = (await globalMitarbeiter()).find((m) => m.id === agentId);
  if (!ziel) return { ok: false, error: "Diese Person ist nicht aktiv oder gehört nicht zu Vertrieb und Leitung." };
  const alt = akte.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null;
  if (alt === agentId) return { ok: true, meldung: `${ziel.name} ist bereits zuständig.` };
  await sqlPool`UPDATE fiaon_global_auftraege SET zustaendig_agent_id = ${agentId}, updated_at = NOW() WHERE ref = ${ref}`;
  // Der Betreuer wandert nur mit, wenn er von diesem Bestellweg gesetzt war (= die bisher zuständige
  // Person) oder fehlt. Einen anderen Betreuer nimmt diese Funktion niemandem weg.
  const b = await bestellungLesen(ref);
  await betreuerSetzenWennFrei(ref, agentId, { mitBestellung: String(b?.payment_status) === "paid", nurWenn: alt });
  // Die offene Aufgabe wandert mit — über denselben Schlüssel (delegieren + Mail „Neuer Auftrag für dich").
  const bezahlt = String(b?.payment_status) === "paid";
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: b?.person_id != null ? Number(b.person_id) : null, ref,
    titel: `FIAON Global: ${bezahlt ? "US-Struktur starten" : "neuer Auftrag"} — ${akte.firma_name || ref}, ${katalogPaket(akte.paket_key)?.label ?? akte.paket_key}`,
    text: `${wer} hat die Zuständigkeit an ${ziel.name} übergeben.`,
    schluessel: `global:${ref}:${bezahlt ? "start" : "auftrag"}`, bereich: "konten", quelle: "global", autorName: wer, agentId,
    link: globalOfficeAuftragPfad(ref),
  }).catch((e) => console.error(`[FIAON-GLOBAL] ${ref}: Aufgabe nicht übergeben:`, e));
  await verlauf(ref, `FIAON Global: Zuständigkeit an ${ziel.name} übergeben (${wer}).`);
  return { ok: true, meldung: `${ziel.name} ist jetzt zuständig und hat die Aufgabe.` };
}

/** Die Auftragsmail noch einmal versuchen — wenn sie beim ersten Mal nicht rausging. */
export async function globalAuftragsMailNachholen(ref: string): Promise<{ ok: boolean; error?: string; meldung?: string }> {
  const akte = await globalAkteLesen(ref);
  if (!akte) return { ok: false, error: "Zu dieser Bestellung gibt es keine Auftragsakte." };
  if (akte.auftrag_mail_am) return { ok: true, meldung: `Die Mail ging bereits am ${tagDe(new Date(akte.auftrag_mail_am))} raus.` };
  const mail = await auftragsMailSenden(ref);
  return mail.ok ? { ok: true, meldung: "Vertrag und Rechnung sind jetzt beim Kunden." } : { ok: false, error: `Die Mail ging wieder nicht raus: ${mail.grund}` };
}

// ── Für die Nachbarn dieses Bestellwegs („Mein Auftrag", Zahlungstakt, Zugang, Storno) ──
// Dieselben Leser, dieselbe Statusregel und derselbe Verlaufseintrag wie oben — unter einem Namen,
// der außerhalb dieser Datei sagt, wozu er gehört.
export { bestellungLesen as globalBestellungLesen, statusAus as globalStatusAus, verlauf as globalVerlauf, eur as globalEur };
