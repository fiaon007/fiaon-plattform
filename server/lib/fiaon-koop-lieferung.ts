// ═══════════════════════════════════════════════════════════════════════════
// FIAON — LIEFERSTRECKE DES KOOPERATIONSVERTRAGS (Register E-386, 16.10.2026): ABLAUF
//
// Regeln und Texte: shared/fiaon-koop-lieferung.ts. Vertrag: shared/ + server/lib/fiaon-global-angebot-koop.ts (E-384).
// Tabellen: db/migrations/111_koop_lieferung.sql (beim ersten Gebrauch ausgeführt, falls sie fehlen).
//
// ── DIE TÜREN ─────────────────────────────────────────────────────────────
//   Akte (Mitarbeiter):  koopAkteLage · koopKontaktAnlegen · koopWiderruf · koopInteresseVermerken
//   Kundenbereich:       koopKundeLage · koopKundeInteresse
//   Partnerbereich:      koopPartnerSicht · koopZeitenSetzen · koopWunschSetzen · koopReklamieren · koopKeinKontakt
//   Stundenlauf:         koopLieferLauf (Übermittlung nachholen, Partnerbereich-Mail, Monatsrechnung, Erinnerung)
//
// ── GELD ──────────────────────────────────────────────────────────────────
//   Die Monatsrechnung ist eine Bestellzeile (fiaon_applications, Katalogschlüssel koop_kontakte, kein Abo,
//   zahlungsseite "global"): eigene Rechnungsnummer aus dem einen Kreis, Zahlungsseite, Bankbuch, mark-paid — alles wie
//   bei jeder Rechnung. Reverse Charge steht an der Zeile. Keine Provision, keine Kontostufe (abschlussNachZahlung
//   überspringt den Schlüssel), keine Privat-Zahlungsmail (payment_email_sent_at beim Anlegen gesetzt).
// ═══════════════════════════════════════════════════════════════════════════
import { koopBerechnungAusgesetzt } from "@shared/fiaon-koop-empfehlung";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sqlPool } from "./db-pool";
import { berlinToday, berlinZeitpunkt, berlinDatum, zeitZuMinuten, minutenZuZeit, formatBerlin } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";
import { angebotLesen, type AngebotZeile } from "./fiaon-global-angebot";
import { koopDatenAus, koopWahlAus } from "./fiaon-global-angebot-koop";
import { koopEur, koopPartnerName, koopPartnerAnrede, koopPartnerGruss, koopModellVon, KOOP_BEREICH, type KoopDaten } from "@shared/fiaon-global-angebot-koop";
import {
  KOOP_EINWILLIGUNG_FASSUNG, KOOP_EINWILLIGUNG_FRAGE, KOOP_INTERESSE, KOOP_RECHNUNG_PAKET, KOOP_REKLAMATION_GRUENDE,
  koopEinwilligungText, koopEinwilligungFassung, koopNotizGesperrt, koopPartnerImSatz, koopTerminArtText, koopZeitenAus, koopZeitenText, koopTerminTagMoeglich,
  koopFeiertage, koopTagPlus, koopWochentag, koopWocheMontag, koopMonatText, koopMonatEnde, koopVormonat, koopKuerzel,
  koopReklamationGrundText, KOOP_STATUS_TEXT,
  type KoopZeiten, type KoopTerminArt, type KoopLieferStand, type KoopReklamationGrund, type KoopReklamationWahl, type KoopKontaktStatus,
} from "@shared/fiaon-koop-lieferung";

type Lauf = any;
type Ergebnis<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const nein = (error: string, status = 400) => ({ ok: false as const, status, error });
const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const jsonb = (v: unknown) => sqlPool.json(v as any);
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object" && !Buffer.isBuffer(v)) return v as T;
  try { const x = JSON.parse(String(v ?? "")); return (typeof x === "string" ? JSON.parse(x) : x) as T; } catch { return leer; }
}
/** Sperrschlüssel je Partner: zwei Mitarbeiter können den letzten freien Platz nie gleichzeitig vergeben. */
const SPERRE_KLASSE = 7385;

/** Eintrag im Verlauf der Akte. fiaon_contact_log verlangt eine Bestellzeile (ref) — die jüngste der Person; ohne Bestellzeile kein Eintrag. */
async function verlauf(personId: number, notiz: string, wer: { name: string; agentId?: number | null }): Promise<void> {
  try {
    const [a] = (await sqlPool`SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
    if (!a?.ref) return;
    await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note) VALUES (${String(a.ref)}, ${personId}, ${wer.agentId ?? null}, ${wer.name}, 'note', ${notiz})`;
  } catch (e) { console.error("[KOOP] Verlauf der Akte:", e); }
}

// ═══════════════════════════════════════════════════════════════════════════
// TABELLEN
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
export function ensureKoopTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const [r] = (await sqlPool`SELECT to_regclass('public.fiaon_koop_einwilligungen') AS e, to_regclass('public.fiaon_koop_kontakte') AS k, to_regclass('public.fiaon_koop_rechnungen') AS r`) as any[];
      if (!(r?.e && r?.k && r?.r)) {
        const sql = readFileSync(path.resolve(process.cwd(), "db", "migrations", "111_koop_lieferung.sql"), "utf8");
        await sqlPool.begin(async (tx: any) => {
          await tx`SET LOCAL lock_timeout = '3s'`;
          await tx.unsafe(sql);
        });
      }
      // E-390: Spalten der Modelle „abschluss“/„platz“ — nur wenn eine fehlt (sonst kein ALTER, keine Sperre).
      const [sp] = (await sqlPool`
        SELECT COUNT(*)::int AS n FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'fiaon_koop_kontakte' AND column_name IN ('anschrift', 'abschluss_am', 'abschluss_art', 'kein_abschluss_am')`) as any[];
      if (Number(sp?.n) < 4) {
        const sql = readFileSync(path.resolve(process.cwd(), "db", "migrations", "112_koop_modelle.sql"), "utf8");
        await sqlPool.begin(async (tx: any) => {
          await tx`SET LOCAL lock_timeout = '3s'`;
          await tx.unsafe(sql);
        });
      }
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER PARTNERBEREICH-SCHLÜSSEL — signiert, ohne Ablauf, widerrufbar über schalter.partnerSchluessel
// ═══════════════════════════════════════════════════════════════════════════
function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}
function partnerSignatur(ref: string, version: number): string {
  return createHmac("sha256", geheimnis()).update(`koop-partner.${ref}.${version}`).digest("hex").slice(0, 32);
}
export function koopPartnerToken(ref: string, version = 1): string {
  return `${ref}.${version}.${partnerSignatur(ref, version)}`;
}
export function koopPartnerPfad(ref: string, version = 1): string {
  return `/partner/${encodeURIComponent(koopPartnerToken(ref, version))}`;
}
function tokenPruefen(token: unknown): { ref: string; version: number } | null {
  const [ref, v, sig] = String(token ?? "").split(".");
  if (!/^FIAON-IA-K[A-Z0-9]{6}$/.test(String(ref)) || !/^\d{1,4}$/.test(String(v)) || !sig) return null;
  const a = Buffer.from(partnerSignatur(ref, Number(v))); const b = Buffer.from(String(sig));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { ref, version: Number(v) };
}
function schalterAus(z: AngebotZeile): Record<string, any> { return json<Record<string, any>>(z.schalter, {}); }
function schluesselVersion(z: AngebotZeile): number { const v = Number(schalterAus(z).partnerSchluessel); return Number.isInteger(v) && v > 0 ? v : 1; }
export function koopPartnerLink(z: AngebotZeile): string {
  return absoluteUrl(koopPartnerPfad(String(z.angebot_ref), schluesselVersion(z)));
}
/** Das Angebot hinter einem Partnerbereich-Link — nur ein angenommener Kooperationsvertrag mit gültiger Schlüsselfassung. */
export async function koopAngebotAusToken(token: unknown): Promise<AngebotZeile | null> {
  const t = tokenPruefen(token);
  if (!t) return null;
  const z = await angebotLesen({ ref: t.ref });
  if (!z || !String(z.fassung).startsWith("IA-KOOP-") || String(z.status) !== "angenommen") return null;
  return schluesselVersion(z) === t.version ? z : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIEFERSTAND JE PARTNER — Zähler, Start-Rahmen, Wunschmenge, Ruhen
// ═══════════════════════════════════════════════════════════════════════════
function zeitenAus(z: AngebotZeile): KoopZeiten | null {
  const roh = schalterAus(z).zeiten;
  if (!roh) return null;
  const p = koopZeitenAus(roh);
  return p.ok ? p.zeiten : null;
}
function vertragAktiv(z: AngebotZeile, heute: string): boolean {
  if (String(z.status) !== "angenommen") return false;
  const ende = String(schalterAus(z).endeAm ?? "");
  return !/^\d{4}-\d{2}-\d{2}$/.test(ende) || ende >= heute;
}
export async function koopLieferStand(z: AngebotZeile, l: Lauf = sqlPool, jetzt = new Date()): Promise<KoopLieferStand> {
  await ensureKoopTabellen();
  const d = koopDatenAus(z); const w = koopWahlAus(z);
  const heute = berlinToday(jetzt); const montag = koopWocheMontag(heute); const monat = heute.slice(0, 7);
  const id = Number(z.id);
  const rechnungen = (await l`
    SELECT r.monat, r.ref, a.invoice_number, a.payment_status, a.payment_due_date
      FROM fiaon_koop_rechnungen r LEFT JOIN fiaon_applications a ON a.ref = r.ref
     WHERE r.angebot_id = ${id} AND r.ref IS NOT NULL ORDER BY r.monat`) as any[];
  const ersteBezahlt = rechnungen.some((r) => String(r.payment_status) === "paid");
  let ruht: KoopLieferStand["ruht"] = null;
  for (const r of rechnungen) {
    if (!["pending_payment", "claimed_paid"].includes(String(r.payment_status)) || !r.payment_due_date) continue;
    const faellig = berlinDatum(new Date(r.payment_due_date));
    if (koopTagPlus(faellig, d.parameter.ruhenNachTagen) < heute) { ruht = { rechnung: String(r.invoice_number || r.ref), faelligAm: faellig }; break; }
  }
  const [c] = (await l`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('geplant', 'uebermittelt') AND ersatz_fuer_id IS NULL)::int AS start,
      COUNT(*) FILTER (WHERE status IN ('geplant', 'uebermittelt', 'reklamiert') AND ersatz_fuer_id IS NULL
                        AND (created_at AT TIME ZONE 'Europe/Berlin')::date >= ${montag}::date)::int AS woche,
      COUNT(*) FILTER (WHERE status IN ('geplant', 'uebermittelt', 'reklamiert')
                        AND to_char(created_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') = ${monat})::int AS monat,
      COUNT(*) FILTER (WHERE status = 'reklamiert' AND reklamation_ergebnis = 'berechtigt' AND reklamation_wahl = 'ersatz')::int AS ersatz_anspruch,
      COUNT(*) FILTER (WHERE ersatz_fuer_id IS NOT NULL AND status <> 'storniert')::int AS ersatz_geliefert
      FROM fiaon_koop_kontakte WHERE angebot_id = ${id}`) as any[];
  const ersatzOffen = Math.max(0, Number(c?.ersatz_anspruch ?? 0) - Number(c?.ersatz_geliefert ?? 0));
  // E-419: Ist die Berechnung ausgesetzt, gibt es keine Rechnung, die den Start-Rahmen je lösen könnte — dann kein Start-Rahmen.
  const startRahmen = ersteBezahlt || koopModellVon(d.parameter.bereich) === "platz" || koopBerechnungAusgesetzt(schalterAus(z)) ? null : { geliefert: Number(c?.start ?? 0), deckel: d.parameter.startDeckel };
  const wunsch = w?.wunschWoche ?? 0;
  const zeiten = zeitenAus(z);
  const aktiv = vertragAktiv(z, heute);
  let sperre: string | null = null;
  if (!aktiv) sperre = "Der Kooperationsvertrag ist nicht aktiv.";
  else if (ruht) sperre = `Die Übermittlung ruht: Rechnung ${ruht.rechnung} (fällig ${formatBerlin(ruht.faelligAm, false)}) ist offen.`;
  else if (!zeiten) sperre = "Der Partner hat noch keine Zeiten für Termine freigegeben.";
  else if (ersatzOffen === 0 && startRahmen && startRahmen.geliefert >= startRahmen.deckel) sperre = `Start-Rahmen erreicht (${startRahmen.geliefert} von ${startRahmen.deckel}) — weiter, sobald die erste Monatsrechnung bezahlt ist.`;
  else if (ersatzOffen === 0 && Number(c?.woche ?? 0) >= wunsch) sperre = `Die Wunschmenge dieser Woche ist erreicht (${Number(c?.woche ?? 0)} von ${wunsch}).`;
  return {
    angebotId: id, ref: d.ref, partnerName: koopPartnerName(d.partner), aktiv, sperre, ruht, startRahmen,
    woche: { geliefert: Number(c?.woche ?? 0), wunsch, montag },
    monat: { monat, geliefert: Number(c?.monat ?? 0) },
    ersatzOffen, zeiten, themen: d.parameter.themen, preisCents: d.parameter.preisCents,
  };
}
async function koopPartnerAlle(): Promise<AngebotZeile[]> {
  const zeilen = (await sqlPool`SELECT id FROM fiaon_global_angebote WHERE fassung LIKE 'IA-KOOP-%' AND status = 'angenommen' ORDER BY angenommen_am`) as any[];
  const aus: AngebotZeile[] = [];
  for (const r of zeilen) { const z = await angebotLesen({ id: Number(r.id) }); if (z) aus.push(z); }
  return aus;
}

// ═══════════════════════════════════════════════════════════════════════════
// FREIE TERMINE IN DEN ZEITEN DES PARTNERS
// ═══════════════════════════════════════════════════════════════════════════
export interface KoopSlot { iso: string; tag: string; zeit: string; text: string }
const HORIZONT_TAGE = 21;
export async function koopFreieTermine(z: AngebotZeile, l: Lauf = sqlPool, jetzt = new Date()): Promise<KoopSlot[]> {
  const zeiten = zeitenAus(z);
  if (!zeiten) return [];
  const heute = berlinToday(jetzt);
  const belegt = new Set(((await l`
    SELECT termin_beginn FROM fiaon_koop_kontakte WHERE angebot_id = ${Number(z.id)} AND status IN ('geplant', 'uebermittelt')
       AND termin_beginn > NOW()`) as any[]).map((r) => new Date(r.termin_beginn).toISOString()));
  const von = zeitZuMinuten(zeiten.von)!; const bis = zeitZuMinuten(zeiten.bis)!;
  const aus: KoopSlot[] = [];
  for (let n = 1; n <= HORIZONT_TAGE; n++) {
    const tag = koopTagPlus(heute, n);
    if (!zeiten.tage.includes(koopWochentag(tag)) || koopFeiertage(Number(tag.slice(0, 4))).has(tag)) continue;
    if (!koopTerminTagMoeglich(tag, heute)) continue;
    for (let m = von; m + zeiten.dauerMin <= bis; m += zeiten.dauerMin) {
      const iso = berlinZeitpunkt(tag, m).toISOString();
      if (belegt.has(iso)) continue;
      aus.push({ iso, tag, zeit: minutenZuZeit(m), text: formatBerlin(new Date(iso)) });
    }
  }
  return aus;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER INTERESSENT — wer gefragt und übermittelt werden darf
// ═══════════════════════════════════════════════════════════════════════════
export interface KoopKandidat {
  personId: number; vorname: string; nachname: string; telefon: string | null; email: string | null;
  /** E-390: für Versorger und Anbieter (Modell „abschluss“) — Straße, PLZ, Ort aus Person oder Bestellung */
  anschrift: string | null;
  /** Harte Gründe: kein Kontakt möglich. */
  sperren: string[];
  /** Was der Mitarbeiter im Gespräch bestätigen muss, weil es in der Akte fehlt. */
  bestaetigen: ("wohnsitz_de" | "volljaehrig")[];
  hinweise: string[];
}
function alterAm(geburt: unknown, heute: string): number | null {
  const s = geburt instanceof Date ? geburt.toISOString().slice(0, 10) : String(geburt ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  let a = Number(heute.slice(0, 4)) - Number(s.slice(0, 4));
  if (heute.slice(5) < s.slice(5)) a--;
  return a;
}
export async function koopKandidat(personId: number, l: Lauf = sqlPool, jetzt = new Date()): Promise<KoopKandidat | null> {
  const [p] = (await l`
    SELECT id, first_name, last_name, primary_email, primary_phone, is_blocked, werbung_gesperrt_am, birthdate, country,
           merged_into_person_id, ist_test_am, street, zip, city
      FROM fiaon_persons WHERE id = ${personId}`) as any[];
  if (!p) return null;
  const [a] = (await l`
    SELECT email, phone, phone_country_code, contact_phone, country, birthdate, street, zip, city
      FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
  const heute = berlinToday(jetzt);
  const sperren: string[] = []; const hinweise: string[] = []; const bestaetigen: KoopKandidat["bestaetigen"] = [];
  const telefonA = a ? (String(a.phone ?? "").startsWith("+") ? a.phone : a.phone ? `${a.phone_country_code ?? ""}${a.phone}` : a.contact_phone) : null;
  const telefon = text(p.primary_phone || telefonA, 40) || null;
  const email = text(p.primary_email || a?.email, 160).toLowerCase() || null;
  if (p.merged_into_person_id) sperren.push("Diese Akte ist zusammengeführt — bitte die Hauptakte öffnen.");
  if (p.is_blocked) sperren.push("Vertriebssperre: Dieser Kunde wird nicht angesprochen.");
  if (p.werbung_gesperrt_am) sperren.push("Werbesperre: Dieser Kunde möchte keine Angebote.");
  if (p.ist_test_am) sperren.push("Testkonto.");
  const { istGlobalKunde } = await import("./fiaon-global-kunde");
  if (await istGlobalKunde(personId, l).catch(() => false)) sperren.push("Global-Kunde: Partner-Termine nur für Privatkunden.");
  const [partner] = (await l`SELECT 1 AS ja FROM fiaon_global_angebote WHERE person_id = ${personId} AND fassung LIKE 'IA-KOOP-%' LIMIT 1`) as any[];
  if (partner) sperren.push("Diese Person ist selbst Partner.");
  if (!telefon || !email) sperren.push("Für die Übermittlung braucht es Telefonnummer UND E-Mail-Adresse in der Akte.");
  const land = String(p.country || a?.country || "").trim().toUpperCase();
  if (land && !["DE", "DEU", "DEUTSCHLAND", "GERMANY"].includes(land)) sperren.push("Wohnt nicht in Deutschland (Ziffer 3 des Vertrags).");
  if (!land) bestaetigen.push("wohnsitz_de");
  const alter = alterAm(p.birthdate ?? a?.birthdate, heute);
  if (alter !== null && alter < 18) sperren.push("Minderjährig.");
  if (alter === null) bestaetigen.push("volljaehrig");
  const [letzte] = (await l`
    SELECT art, erteilt_am, widerrufen_am FROM fiaon_koop_einwilligungen WHERE person_id = ${personId}
     ORDER BY erteilt_am DESC LIMIT 1`) as any[];
  if (letzte?.art === "abgelehnt") hinweise.push(`Der Kunde hat am ${formatBerlin(new Date(letzte.erteilt_am), false)} „kein Interesse“ gewählt — nur ansprechen, wenn er das Thema selbst aufbringt.`);
  if (letzte?.widerrufen_am) hinweise.push(`Einwilligung am ${formatBerlin(new Date(letzte.widerrufen_am), false)} widerrufen — nur mit neuem, ausdrücklichem Ja.`);
  const strasse = text(p.street || a?.street, 160); const plz = text(p.zip || a?.zip, 10); const ort = text(p.city || a?.city, 120);
  const anschrift = strasse && plz && ort ? `${strasse}, ${plz} ${ort}` : null;
  return { personId, vorname: text(p.first_name, 80), nachname: text(p.last_name, 80), telefon, email, anschrift, sperren, bestaetigen, hinweise };
}

/** Exklusivität (Ziffer 3): derselbe Interessent zum selben Thema — an keinen Partner, solange die Frist läuft. */
async function exklusivBelegt(personId: number, thema: string, monate: number, l: Lauf): Promise<{ am: string; bis: string } | null> {
  const [r] = (await l`
    SELECT created_at FROM fiaon_koop_kontakte
     WHERE person_id = ${personId} AND LOWER(thema) = LOWER(${thema}) AND status <> 'storniert'
       AND created_at > NOW() - make_interval(months => ${monate}::int)
     ORDER BY created_at DESC LIMIT 1`) as any[];
  if (!r) return null;
  const am = berlinDatum(new Date(r.created_at));
  const bis = new Date(r.created_at); bis.setMonth(bis.getMonth() + monate);
  return { am, bis: berlinDatum(bis) };
}

// ═══════════════════════════════════════════════════════════════════════════
// AKTE: WAS DER MITARBEITER SIEHT
// ═══════════════════════════════════════════════════════════════════════════
export async function koopAkteLage(personId: number): Promise<Record<string, unknown>> {
  await ensureKoopTabellen();
  const kandidat = await koopKandidat(personId);
  if (!kandidat) return { ok: false, error: "Diese Akte gibt es nicht." };
  const partner = [];
  for (const z of await koopPartnerAlle()) {
    const stand = await koopLieferStand(z);
    const d = koopDatenAus(z);
    const themen = [];
    for (const t of d.parameter.themen) {
      const belegt = await exklusivBelegt(personId, t, d.parameter.exklusivMonate, sqlPool);
      themen.push({ thema: t, belegt: belegt ? `schon am ${formatBerlin(belegt.am, false)} übermittelt — exklusiv bis ${formatBerlin(belegt.bis, false)}` : null });
    }
    partner.push({
      angebotId: Number(z.id), ref: d.ref, name: `${koopPartnerName(d.partner)}${d.partner.firma ? ` (${d.partner.firma})` : ""}`, stand, themen,
      zeitenText: koopZeitenText(stand.zeiten), arten: stand.zeiten?.arten ?? [], dauerMin: stand.zeiten?.dauerMin ?? 60,
      termine: stand.sperre ? [] : (await koopFreieTermine(z)).slice(0, 240),
      // Der Text zum Vorlesen braucht das Thema — die Maske setzt es ein (gleiche Funktion im Browser).
      partnerFuerText: { anrede: d.partner.anrede, vorname: d.partner.vorname, nachname: d.partner.nachname, firma: d.partner.firma },
      bereich: d.parameter.bereich, modell: koopModellVon(d.parameter.bereich), bereichName: KOOP_BEREICH[d.parameter.bereich].name,
    });
  }
  const einwilligungen = (await sqlPool`
    SELECT e.id, e.art, e.kanal, e.thema, e.erteilt_am, e.erteilt_von, e.widerrufen_am, e.widerruf_von, e.wortlaut, e.fassung, g.kunde->>'nachname' AS partner
      FROM fiaon_koop_einwilligungen e LEFT JOIN fiaon_global_angebote g ON g.id = e.angebot_id
     WHERE e.person_id = ${personId} ORDER BY e.erteilt_am DESC LIMIT 20`) as any[];
  const kontakte = (await sqlPool`
    SELECT k.id, k.thema, k.termin_beginn, k.termin_art, k.status, k.uebermittelt_am, k.mail_fehler, k.reklamiert_am, k.reklamation_grund,
           k.reklamation_ergebnis, k.kein_kontakt_am, k.angelegt_von, k.created_at, g.kunde AS partner
      FROM fiaon_koop_kontakte k JOIN fiaon_global_angebote g ON g.id = k.angebot_id
     WHERE k.person_id = ${personId} ORDER BY k.created_at DESC LIMIT 20`) as any[];
  return {
    ok: true,
    kandidat,
    partner,
    frage: KOOP_EINWILLIGUNG_FRAGE,
    fassung: KOOP_EINWILLIGUNG_FASSUNG,
    einwilligungen: einwilligungen.map((e) => ({
      id: Number(e.id), art: e.art, kanal: e.kanal, thema: e.thema, am: new Date(e.erteilt_am).toISOString(), von: e.erteilt_von,
      widerrufenAm: e.widerrufen_am ? new Date(e.widerrufen_am).toISOString() : null, widerrufVon: e.widerruf_von, wortlaut: e.wortlaut, fassung: e.fassung,
    })),
    kontakte: kontakte.map((k) => ({
      id: Number(k.id), thema: k.thema, termin: new Date(k.termin_beginn).toISOString(), terminText: formatBerlin(new Date(k.termin_beginn)),
      art: koopTerminArtText(k.termin_art), status: k.status, statusText: KOOP_STATUS_TEXT[k.status as KoopKontaktStatus] ?? k.status,
      partner: koopPartnerImSatz(json<any>(k.partner, {})), uebermitteltAm: k.uebermittelt_am ? new Date(k.uebermittelt_am).toISOString() : null,
      mailFehler: k.mail_fehler ?? null, reklamation: k.reklamiert_am ? `${koopReklamationGrundText(k.reklamation_grund)} — ${k.reklamation_ergebnis === "berechtigt" ? "Vergütung entfällt" : "abgelehnt"}` : null,
      keinKontakt: !!k.kein_kontakt_am, von: k.angelegt_von,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AKTE: DER QUALIFIZIERTE KONTAKT — Einwilligung + Thema + Termin + Notiz, dann sofort übermitteln
// ═══════════════════════════════════════════════════════════════════════════
export interface KoopKontaktEingabe {
  angebotId: number; thema: string; termin: string; art: string; notiz?: string;
  /** Der Mitarbeiter hat den Text vorgelesen und der Kunde hat „Ja“ gesagt. */
  einwilligung: boolean;
  /** Bestätigungen für fehlende Akten-Angaben (Wohnsitz Deutschland, volljährig). */
  bestaetigt?: string[];
}
export async function koopKontaktAnlegen(personId: number, ein: KoopKontaktEingabe, wer: { name: string; agentId: number | null }, jetzt = new Date()): Promise<Ergebnis<{ id: number; uebermittelt: boolean; meldung: string }>> {
  await ensureKoopTabellen();
  if (ein?.einwilligung !== true) return nein("Ohne ausdrückliches Ja des Kunden gibt es keinen Kontakt — bitte den Text vorlesen und die Antwort bestätigen.");
  const z = await angebotLesen({ id: Number(ein?.angebotId) });
  if (!z || !String(z.fassung).startsWith("IA-KOOP-") || String(z.status) !== "angenommen") return nein("Diesen Partner gibt es nicht (oder sein Vertrag ist nicht angenommen).", 404);
  const d = koopDatenAus(z);
  const thema = d.parameter.themen.find((t) => t === String(ein.thema ?? ""));
  if (!thema) return nein("Bitte ein Thema aus der Liste des Partners wählen.");
  const kandidat = await koopKandidat(personId, sqlPool, jetzt);
  if (!kandidat) return nein("Diese Akte gibt es nicht.", 404);
  if (kandidat.sperren.length) return nein(kandidat.sperren[0], 409);
  const bestaetigt = Array.isArray(ein.bestaetigt) ? ein.bestaetigt.map(String) : [];
  const fehlt = kandidat.bestaetigen.filter((b) => !bestaetigt.includes(b));
  if (fehlt.length) return nein(fehlt.includes("wohnsitz_de") ? "Bitte bestätigen: Der Kunde wohnt in Deutschland." : "Bitte bestätigen: Der Kunde ist volljährig.");
  const notiz = String(ein.notiz ?? "").replace(/\r/g, "").trim().slice(0, 600);
  // Gesundheit, Einkommen, Bonität gehören nicht in die Übermittlung (Ziffer 3 Absatz 2).
  const bereich = d.parameter.bereich; const modell = koopModellVon(bereich);
  if (koopNotizGesperrt(notiz, bereich)) {
    return nein(bereich === "recht" || bereich === "steuern"
      ? "Die Notiz geht an die Kanzlei — bitte nichts zu Gesundheit hineinschreiben."
      : "Die Notiz geht an den Partner — bitte nichts zu Gesundheit, Einkommen, Schulden oder Bonität hineinschreiben.");
  }
  if (modell === "abschluss" && !kandidat.anschrift) return nein("Für ein Angebot braucht der Partner die Anschrift — bitte erst in der Akte nachtragen.");
  const zeitenRoh = zeitenAus(z);
  const art = String(ein.art ?? "") as KoopTerminArt;
  if (!zeitenRoh || !zeitenRoh.arten.includes(art)) return nein("Bitte eine Terminart wählen, die der Partner anbietet.");
  const termin = new Date(String(ein.termin ?? ""));
  if (Number.isNaN(termin.getTime())) return nein("Bitte einen Termin wählen.");
  const wortlaut = `${koopEinwilligungText(d.partner, thema, bereich)} ${KOOP_EINWILLIGUNG_FRAGE} — Antwort des Kunden: Ja.`;
  const ewFassung = koopEinwilligungFassung(bereich);
  // Je Kontakt berechnet wird nur Vorsorge; Abschlüsse bekommen ihren Preis bei der Meldung, der Partnerplatz nie je Kontakt.
  // E-419: „Berechnung ausgesetzt“ (Justin an Chehade 22.10.: „verrechnen tun wir einstweilen nichts“) — Kontakte kosten 0 €.
  const kontaktPreis = modell === "kontakt" && !koopBerechnungAusgesetzt(schalterAus(z)) ? d.parameter.preisCents : 0;

  let ergebnis: { id: number; ersatz: boolean } | { fehler: string; status: number };
  try {
    ergebnis = await sqlPool.begin(async (tx: any) => {
      await tx`SELECT pg_advisory_xact_lock(${SPERRE_KLASSE}, ${Number(z.id)})`;
      const stand = await koopLieferStand(z, tx, jetzt);
      if (stand.sperre) return { fehler: stand.sperre, status: 409 };
      // Der Termin muss einer der freien Termine sein (Zeiten, Werktag-Regel, nicht belegt) — neu gerechnet unter der Sperre.
      const frei = await koopFreieTermine(z, tx, jetzt);
      if (!frei.some((s) => s.iso === termin.toISOString())) return { fehler: "Dieser Termin ist nicht (mehr) frei — bitte einen anderen wählen.", status: 409 };
      const belegt = await exklusivBelegt(personId, thema, d.parameter.exklusivMonate, tx);
      if (belegt) return { fehler: `Zum Thema „${thema}“ wurde dieser Kunde am ${formatBerlin(belegt.am, false)} schon übermittelt — exklusiv bis ${formatBerlin(belegt.bis, false)}.`, status: 409 };
      const [e] = (await tx`
        INSERT INTO fiaon_koop_einwilligungen (person_id, art, angebot_id, thema, kanal, wortlaut, fassung, erteilt_am, erteilt_von, agent_id)
        VALUES (${personId}, 'uebermittlung', ${Number(z.id)}, ${thema}, 'telefon', ${wortlaut}, ${ewFassung}, ${jetzt}, ${wer.name}, ${wer.agentId})
        RETURNING id`) as any[];
      // Ersatz für einen berechtigt reklamierten Kontakt geht vor (zählt nicht gegen Wunschmenge und Start-Rahmen).
      let ersatzFuer: number | null = null;
      if (stand.ersatzOffen > 0) {
        const [r] = (await tx`
          SELECT k.id FROM fiaon_koop_kontakte k
           WHERE k.angebot_id = ${Number(z.id)} AND k.status = 'reklamiert' AND k.reklamation_ergebnis = 'berechtigt' AND k.reklamation_wahl = 'ersatz'
             AND NOT EXISTS (SELECT 1 FROM fiaon_koop_kontakte x WHERE x.ersatz_fuer_id = k.id AND x.status <> 'storniert')
           ORDER BY k.reklamiert_am LIMIT 1`) as any[];
        ersatzFuer = r ? Number(r.id) : null;
      }
      const [k] = (await tx`
        INSERT INTO fiaon_koop_kontakte (angebot_id, person_id, einwilligung_id, thema, termin_beginn, termin_dauer_min, termin_art, notiz,
                                         vorname, nachname, telefon, email, anschrift, status, preis_cents, ersatz_fuer_id, angelegt_von, agent_id, created_at)
        VALUES (${Number(z.id)}, ${personId}, ${Number(e.id)}, ${thema}, ${termin}, ${zeitenRoh.dauerMin}, ${art}, ${notiz || null},
                ${kandidat.vorname}, ${kandidat.nachname}, ${kandidat.telefon}, ${kandidat.email}, ${modell === "abschluss" ? kandidat.anschrift : null}, 'geplant', ${kontaktPreis},
                ${ersatzFuer}, ${wer.name}, ${wer.agentId}, ${jetzt})
        RETURNING id`) as any[];
      return { id: Number(k.id), ersatz: ersatzFuer != null };
    });
  } catch (e) {
    console.error("[KOOP] Kontakt anlegen:", e);
    return nein("Der Kontakt ließ sich gerade nicht speichern — bitte gleich noch einmal.", 500);
  }
  if ("fehler" in ergebnis) return nein(ergebnis.fehler, ergebnis.status);
  await verlauf(personId, `Partner-Termin (Kooperation ${d.ref}): ${thema} am ${formatBerlin(termin)} (${koopTerminArtText(art)}) mit ${koopPartnerImSatz(d.partner)}. Einwilligung am Telefon erteilt (Fassung ${ewFassung}).${ergebnis.ersatz ? " Ersatz für einen reklamierten Kontakt." : ""}`, wer);
  const u = await koopUebermitteln(ergebnis.id);
  return {
    ok: true, id: ergebnis.id, uebermittelt: u.ok,
    meldung: u.ok ? `Übermittelt an ${koopPartnerImSatz(d.partner)} — der Kunde bekommt eine Bestätigung per E-Mail.` : `Gespeichert. Die Mail an den Partner ging noch nicht raus (${u.grund}) — der Stundenlauf versucht es erneut.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERMITTLUNG AN DEN PARTNER (Ziffer 4) + BESTÄTIGUNG AN DEN KUNDEN
// ═══════════════════════════════════════════════════════════════════════════
async function freitext(an: string, betreff: string, textInhalt: string, opts: { anrede?: string; absender?: "welcome" | "accounting" | "team"; anhaenge?: { name: string; inhalt: Buffer }[]; event: string; personId?: number | null }): Promise<{ ok: boolean; messageId: string | null; grund?: string }> {
  const { freitextSenden } = await import("../mail/motor");
  const r = await freitextSenden({ an, betreff, text: textInhalt, anrede: opts.anrede ?? null, absender: opts.absender ?? "team", anhaenge: opts.anhaenge });
  const { mailProtokoll } = await import("./fiaon-mail-log");
  await mailProtokoll({ event: opts.event, personId: opts.personId ?? null, empfaenger: an, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.grund ?? null, payload: { betreff }, ausgeloestVon: "Kooperation (Automatik)", brevoMessageId: r.messageId });
  return r;
}
function partnerBriefText(d: KoopDaten, k: any, ew: any, link: string): { betreff: string; text: string } {
  const termin = formatBerlin(new Date(k.termin_beginn));
  const zeilen = [
    `FIAON übermittelt Ihnen einen neuen Kontakt aus dem Kooperationsvertrag ${d.ref}${k.ersatz_fuer_id ? " — als Ersatz für einen reklamierten Kontakt (ohne Berechnung gegen Ihre Wunschmenge)" : ""}.`,
    [`Interessent: ${k.vorname} ${k.nachname}`, ...(k.anschrift ? [`Anschrift: ${k.anschrift}`] : []), `Telefon: ${k.telefon}`, `E-Mail: ${k.email}`, `${koopModellVon(d.parameter.bereich) === "abschluss" ? "Sparte" : "Thema"}: ${k.thema}`,
      `${koopModellVon(d.parameter.bereich) === "abschluss" ? "Rückruf" : "Termin"}: ${termin} (${k.termin_dauer_min} Minuten, ${koopTerminArtText(k.termin_art)})`, ...(k.notiz ? [`Notiz aus unserem Gespräch: ${k.notiz}`] : [])].join("\n"),
    ...(koopModellVon(d.parameter.bereich) === "abschluss" ? ["Kommt ein Vertrag zustande, melden Sie den Abschluss bitte im Partnerbereich (Ziffer 6) — erst dann wird berechnet."] : []),
    `Einwilligung: am ${formatBerlin(new Date(ew.erteilt_am))} am Telefon erteilt (Fassung ${ew.fassung}) — sie umfasst Ihren Anruf und Ihre E-Mail zu diesem Gespräch. Den Wortlaut weisen wir Ihnen auf Anfrage nach.`,
    "Bitte informieren Sie den Interessenten bei Ihrem ersten Kontakt nach Art. 14 DSGVO, nutzen Sie die Daten nur für dieses Gespräch und nehmen Sie Rücksicht auf seine finanzielle Lage (Ziffer 5). Wünscht er keinen Kontakt mehr, melden Sie es bitte in Ihrem Partnerbereich.",
    `Alle Termine, Ihre Zeiten, Reklamationen und Rechnungen: ${link}`,
  ];
  return { betreff: `Neuer Termin: ${k.vorname} ${k.nachname} — ${k.thema}, ${termin}`, text: zeilen.join("\n\n") };
}
export async function koopUebermitteln(kontaktId: number): Promise<{ ok: boolean; grund?: string }> {
  const [k] = (await sqlPool`SELECT * FROM fiaon_koop_kontakte WHERE id = ${kontaktId}`) as any[];
  if (!k) return { ok: false, grund: "Kontakt fehlt" };
  if (k.status !== "geplant") return { ok: k.status === "uebermittelt" };
  const z = await angebotLesen({ id: Number(k.angebot_id) });
  if (!z) return { ok: false, grund: "Vertrag fehlt" };
  const d = koopDatenAus(z);
  const [ew] = (await sqlPool`SELECT * FROM fiaon_koop_einwilligungen WHERE id = ${Number(k.einwilligung_id)}`) as any[];
  if (!ew || ew.widerrufen_am) {
    await sqlPool`UPDATE fiaon_koop_kontakte SET status = 'storniert', storniert_am = NOW(), storniert_grund = 'Einwilligung widerrufen vor der Übermittlung' WHERE id = ${kontaktId} AND status = 'geplant'`;
    return { ok: false, grund: "Einwilligung widerrufen" };
  }
  // Ziffer 4: spätestens am Werktag vor dem Termin. Wer das verpasst, übermittelt nicht mehr — der Betreuer verlegt.
  if (!koopTerminTagMoeglich(berlinDatum(new Date(k.termin_beginn)), berlinToday())) {
    await sqlPool`UPDATE fiaon_koop_kontakte SET status = 'storniert', storniert_am = NOW(), storniert_grund = 'Übermittlung nicht bis zum Werktag vor dem Termin möglich' WHERE id = ${kontaktId} AND status = 'geplant'`;
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: Number(k.person_id), ref: null, titel: `Partner-Termin neu vereinbaren: ${k.vorname} ${k.nachname}`,
      text: `Die Übermittlung an ${koopPartnerImSatz(d.partner)} kam nicht rechtzeitig vor dem Termin (${formatBerlin(new Date(k.termin_beginn))}) an — der Kontakt ist zurückgenommen. Bitte den Kunden anrufen und in der Akte einen neuen Termin festhalten.`,
      dringend: true, schluessel: `koop:${kontaktId}:verlegen`, bereich: "partner", quelle: "global", autorName: "FIAON", link: `/akte/${k.person_id}`,
    }).catch((e: unknown) => console.error("[KOOP] Aufgabe verlegen:", e));
    return { ok: false, grund: "zu spät" };
  }
  const brief = partnerBriefText(d, k, ew, koopPartnerLink(z));
  const r = await freitext(d.partner.email, brief.betreff, brief.text, { anrede: `${koopPartnerAnrede(d.partner)},`, event: "koop_kontakt_partner", personId: z.person_id != null ? Number(z.person_id) : null });
  if (!r.ok) {
    await sqlPool`UPDATE fiaon_koop_kontakte SET mail_fehler = ${String(r.grund ?? "unbekannt").slice(0, 300)}, mail_versuche = mail_versuche + 1 WHERE id = ${kontaktId}`;
    return { ok: false, grund: r.grund ?? "Mail nicht angenommen" };
  }
  await sqlPool`
    UPDATE fiaon_koop_kontakte SET status = 'uebermittelt', uebermittelt_am = NOW(), mail_message_id = ${r.messageId}, mail_fehler = NULL,
           mail_versuche = mail_versuche + 1,
           -- E-390: Nur Vorsorge wird je übermitteltem Kontakt berechnet; Abschlüsse bekommen den Monat bei der Meldung.
           abrechnung_monat = CASE WHEN ${koopModellVon(d.parameter.bereich) === "kontakt"} THEN to_char(NOW() AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') ELSE NULL END
     WHERE id = ${kontaktId} AND status = 'geplant'`;
  // Bestätigung an den Kunden — er hat den Termin gewünscht; sie nennt den Berater und den Widerruf.
  void koopKundeBestaetigen(kontaktId, d).catch((e) => console.error("[KOOP] Bestätigung an den Kunden:", e));
  return { ok: true };
}
async function koopKundeBestaetigen(kontaktId: number, d: KoopDaten): Promise<void> {
  const [k] = (await sqlPool`UPDATE fiaon_koop_kontakte SET kunde_mail_am = NOW() WHERE id = ${kontaktId} AND kunde_mail_am IS NULL RETURNING *`) as any[];
  if (!k?.email) return;
  const termin = formatBerlin(new Date(k.termin_beginn));
  const bereich = d.parameter.bereich; const modell = koopModellVon(bereich);
  const wie = k.termin_art === "telefon" ? `Der Anruf kommt zum Termin unter ${k.telefon}.` : k.termin_art === "video" ? "Den Link für das Videogespräch erhalten Sie vorher per E-Mail." : "Den Ort stimmt der Partner vorher mit Ihnen ab.";
  const wer = koopPartnerImSatz(d.partner);
  const absaetze = modell === "platz" ? [
    `wie besprochen haben wir für Sie ein Erstgespräch zum Thema „${k.thema}“ vereinbart.`,
    `Termin: ${termin} (${koopTerminArtText(k.termin_art)})\nMit: ${wer}. ${wie}`,
    `Die Kosten des Erstgesprächs nennt Ihnen die Kanzlei, bevor es beginnt. FIAON berät nicht ${bereich === "recht" ? "rechtlich" : "steuerlich"} und erhält keine Vergütung für ein Mandat — Ihre FIAON-Leistungen hängen davon nicht ab.`,
  ] : modell === "abschluss" ? [
    `wie besprochen meldet sich ${wer} bei Ihnen mit einem Angebot (${k.thema}).`,
    `Rückruf: ${termin} (${koopTerminArtText(k.termin_art)}). ${wie}`,
    "Ein Vertrag entsteht nur, wenn Sie ihn selbst abschließen — prüfen Sie das Angebot in Ruhe. FIAON erhält vom Partner eine Vergütung, wenn ein Vertrag zustande kommt; für Sie entstehen dadurch keine Kosten.",
  ] : [
    `wie besprochen haben wir für Sie ein kostenloses Gespräch zum Thema „${k.thema}“ vereinbart.`,
    `Termin: ${termin} (${koopTerminArtText(k.termin_art)})\nMit: ${wer}, selbstständiger Berater und Partner von FIAON. ${wie}`,
    "FIAON berät nicht zu Versicherungen oder Geldanlagen und erhält keine Provision. Sie entscheiden nach dem Gespräch in Ruhe — Ihre FIAON-Leistungen hängen davon nicht ab.",
  ];
  const textInhalt = [
    ...absaetze,
    "Sie möchten das doch nicht? Antworten Sie einfach auf diese E-Mail oder schreiben Sie an support@fiaon.com — dann widerrufen wir Ihre Einwilligung und sagen dem Partner Bescheid.",
  ].join("\n\n");
  await freitext(String(k.email), modell === "abschluss" ? `Ihr Rückruf am ${termin}` : `Ihr Gesprächstermin am ${termin}`, textInhalt, { anrede: `Guten Tag ${k.vorname} ${k.nachname},`, absender: "welcome", event: "koop_kontakt_kunde", personId: Number(k.person_id) });
}

// ═══════════════════════════════════════════════════════════════════════════
// WIDERRUF UND INTERESSE
// ═══════════════════════════════════════════════════════════════════════════
/** Der Kunde widerruft (am Telefon, per Mail an uns, über den Partner): alle offenen Einwilligungen enden; der Partner erfährt es. */
export async function koopWiderruf(personId: number, wer: { name: string; kanal: string; grund?: string | null }): Promise<{ ok: true; widerrufen: number; storniert: number; partnerInformiert: number }> {
  await ensureKoopTabellen();
  const w = (await sqlPool`
    UPDATE fiaon_koop_einwilligungen SET widerrufen_am = NOW(), widerruf_kanal = ${wer.kanal.slice(0, 24)}, widerruf_von = ${wer.name}, widerruf_grund = ${wer.grund ?? null}
     WHERE person_id = ${personId} AND widerrufen_am IS NULL AND art IN ('interesse', 'uebermittlung') RETURNING id`) as any[];
  const st = (await sqlPool`
    UPDATE fiaon_koop_kontakte SET status = 'storniert', storniert_am = NOW(), storniert_grund = 'Einwilligung widerrufen'
     WHERE person_id = ${personId} AND status = 'geplant' RETURNING id`) as any[];
  // Ziffer 8: Die andere Partei erfährt den Widerruf binnen drei Werktagen — wir sagen es sofort, für jeden Partner, der
  // den Kunden in den letzten sechs Monaten bekommen hat.
  const offen = (await sqlPool`
    SELECT DISTINCT ON (angebot_id) id, angebot_id, vorname, nachname, thema, termin_beginn FROM fiaon_koop_kontakte
     WHERE person_id = ${personId} AND status IN ('uebermittelt', 'reklamiert') AND uebermittelt_am > NOW() - INTERVAL '6 months'
     ORDER BY angebot_id, uebermittelt_am DESC`) as any[];
  let informiert = 0;
  for (const k of offen) {
    const z = await angebotLesen({ id: Number(k.angebot_id) });
    if (!z) continue;
    const d = koopDatenAus(z);
    const r = await freitext(d.partner.email, `Widerruf: ${k.vorname} ${k.nachname} wünscht keinen Kontakt mehr`, [
      `${k.vorname} ${k.nachname} hat die Einwilligung zur Kontaktaufnahme widerrufen (Thema „${k.thema}“, Termin ${formatBerlin(new Date(k.termin_beginn))}).`,
      "Bitte kontaktieren Sie den Interessenten nicht mehr und löschen Sie seine Daten, soweit keine Kundenbeziehung besteht und keine Aufbewahrungspflicht gilt (Ziffer 8). Ein bereits vereinbarter Termin entfällt.",
      `Ihr Partnerbereich: ${koopPartnerLink(z)}`,
    ].join("\n\n"), { anrede: `${koopPartnerAnrede(d.partner)},`, event: "koop_widerruf_partner", personId: z.person_id != null ? Number(z.person_id) : null });
    if (r.ok) informiert++;
  }
  await verlauf(personId, `Partner-Termine: Einwilligung widerrufen (${wer.kanal}). ${st.length} geplante Übermittlung(en) zurückgenommen, ${informiert} Partner informiert.`, { name: wer.name });
  return { ok: true, widerrufen: w.length, storniert: st.length, partnerInformiert: informiert };
}
/** Interesse oder „kein Interesse“ — aus dem Kundenbereich (eigener Klick) oder vom Mitarbeiter aus dem Gespräch. */
export async function koopInteresseVermerken(personId: number, ein: { ja: boolean; kanal: "telefon" | "kundenbereich"; von: string; agentId?: number | null; ip?: string | null; userAgent?: string | null }): Promise<{ ok: true; id: number }> {
  await ensureKoopTabellen();
  const art = ein.ja ? "interesse" : "abgelehnt";
  const wortlaut = ein.ja ? KOOP_INTERESSE.wortlaut : "Kein Interesse an einem Gespräch zu Vorsorge und Absicherung.";
  if (!ein.ja) {
    await sqlPool`UPDATE fiaon_koop_einwilligungen SET widerrufen_am = NOW(), widerruf_kanal = ${ein.kanal}, widerruf_von = ${ein.von}
                   WHERE person_id = ${personId} AND art = 'interesse' AND widerrufen_am IS NULL`;
  }
  const [e] = (await sqlPool`
    INSERT INTO fiaon_koop_einwilligungen (person_id, art, kanal, wortlaut, fassung, erteilt_von, agent_id, ip, user_agent)
    VALUES (${personId}, ${art}, ${ein.kanal}, ${wortlaut}, ${KOOP_EINWILLIGUNG_FASSUNG}, ${ein.von}, ${ein.agentId ?? null}, ${ein.ip ?? null}, ${String(ein.userAgent ?? "").slice(0, 300) || null})
    RETURNING id`) as any[];
  if (ein.ja && ein.kanal === "kundenbereich") {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId, ref: null, titel: "Kunde wünscht ein Gespräch zu Vorsorge und Absicherung",
      text: "Der Kunde hat im Kundenbereich ein kostenloses Partner-Gespräch gewünscht. Bitte anrufen: Thema fragen, den Einwilligungstext vorlesen und den Termin in der Akte unter „Partner-Termin“ festhalten — die Übermittlung läuft dann automatisch.",
      dringend: false, schluessel: `koop:interesse:${personId}:${Number(e.id)}`, bereich: "partner", quelle: "global", autorName: "FIAON", link: `/akte/${personId}`,
    }).catch((err: unknown) => console.error("[KOOP] Aufgabe Interesse:", err));
  }
  return { ok: true, id: Number(e.id) };
}

// ═══════════════════════════════════════════════════════════════════════════
// KUNDENBEREICH: die ruhige Karte „Vorsorge und Absicherung“
// ═══════════════════════════════════════════════════════════════════════════
export async function koopKundeLage(personId: number): Promise<{ zeigen: boolean; stand: "frage" | "gewuenscht" | "termin" | "abgelehnt"; termin?: string | null; texte: typeof KOOP_INTERESSE }> {
  await ensureKoopTabellen();
  const leer = { zeigen: false, stand: "frage" as const, texte: KOOP_INTERESSE };
  if (!(await koopPartnerAlle()).length) return leer;
  const k = await koopKandidat(personId);
  if (!k || k.sperren.length) return leer;
  const [t] = (await sqlPool`SELECT termin_beginn FROM fiaon_koop_kontakte WHERE person_id = ${personId} AND status IN ('geplant', 'uebermittelt') AND termin_beginn > NOW() ORDER BY termin_beginn LIMIT 1`) as any[];
  if (t) return { zeigen: true, stand: "termin", termin: formatBerlin(new Date(t.termin_beginn)), texte: KOOP_INTERESSE };
  const [e] = (await sqlPool`SELECT art, widerrufen_am FROM fiaon_koop_einwilligungen WHERE person_id = ${personId} AND art IN ('interesse', 'abgelehnt') ORDER BY erteilt_am DESC LIMIT 1`) as any[];
  if (e?.art === "abgelehnt") return { zeigen: false, stand: "abgelehnt", texte: KOOP_INTERESSE };
  if (e?.art === "interesse" && !e.widerrufen_am) return { zeigen: true, stand: "gewuenscht", texte: KOOP_INTERESSE };
  return { zeigen: true, stand: "frage", texte: KOOP_INTERESSE };
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTNERBEREICH
// ═══════════════════════════════════════════════════════════════════════════
function reklamationBis(k: any, tage: number): Date {
  // Ende des Berliner Kalendertags „Termin + Frist“.
  const tag = koopTagPlus(berlinDatum(new Date(k.termin_beginn)), tage);
  return berlinZeitpunkt(koopTagPlus(tag, 1), 0);
}
export async function koopPartnerSicht(z: AngebotZeile, jetzt = new Date()): Promise<Record<string, unknown>> {
  const d = koopDatenAus(z);
  const modell = koopModellVon(d.parameter.bereich);
  const B = KOOP_BEREICH[d.parameter.bereich];
  const stand = await koopLieferStand(z, sqlPool, jetzt);
  const kontakte = (await sqlPool`
    SELECT * FROM fiaon_koop_kontakte WHERE angebot_id = ${Number(z.id)} AND status IN ('uebermittelt', 'reklamiert')
     ORDER BY termin_beginn DESC LIMIT 200`) as any[];
  const rechnungen = (await sqlPool`
    SELECT r.*, a.invoice_number, a.payment_reference, a.payment_status, a.payment_due_date
      FROM fiaon_koop_rechnungen r LEFT JOIN fiaon_applications a ON a.ref = r.ref
     WHERE r.angebot_id = ${Number(z.id)} ORDER BY r.monat DESC`) as any[];
  const { signInvoiceUrl } = await import("../fiaon-invoice");
  // E-388: „Ihr Jahr in Zahlen“ — die letzten sechs Monate nach Monat der Übermittlung (berechtigte Reklamationen zählen
  // als Kontakt, aber nicht zum Betrag).
  const roh = (await sqlPool`
    SELECT abrechnung_monat AS m, COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE status = 'reklamiert' AND reklamation_ergebnis = 'berechtigt')::int AS r,
           COALESCE(SUM(preis_cents) FILTER (WHERE NOT (status = 'reklamiert' AND reklamation_ergebnis = 'berechtigt')), 0)::int AS c
      FROM fiaon_koop_kontakte WHERE angebot_id = ${Number(z.id)} AND abrechnung_monat IS NOT NULL AND status IN ('uebermittelt', 'reklamiert')
     GROUP BY 1`) as any[];
  const jetztMonat = monatAus(jetzt);
  const monate: string[] = [];
  for (let m = jetztMonat, k = 0; k < 6; k++, m = koopVormonat(m)) monate.unshift(m);
  const verlauf = roh.length ? monate.map((m) => {
    const x = roh.find((y) => y.m === m);
    return { monat: m, monatText: koopMonatText(m), kontakte: Number(x?.n ?? 0), reklamiert: Number(x?.r ?? 0), betragCents: Number(x?.c ?? 0), laufend: m === jetztMonat };
  }) : [];
  // E-419: Empfehlungen des Partners an FIAON mit Provision — scheitert das Lesen, fehlt nur dieser Teil.
  const empfehlungen = await import("./fiaon-koop-empfehlung").then((m) => m.koopEmpfehlungSicht(z)).catch((e) => { console.error("[KOOP] Empfehlungen:", e); return null; });
  return {
    ok: true,
    verlauf,
    empfehlungen: empfehlungen && (empfehlungen.prozent != null || empfehlungen.liste.length) ? empfehlungen : null,
    berechnungAusgesetzt: koopBerechnungAusgesetzt(schalterAus(z)),
    modell, bereich: d.parameter.bereich, einheit: B.einheit,
    sparten: modell === "abschluss" ? (B.sparten ?? []).map((name, i) => ({ name, betrag: koopEur(i === 0 ? d.parameter.preisCents : d.parameter.zweitCents) })) : [],
    kontakteTitel: modell === "platz" ? `Ihre ${B.einheit}` : modell === "abschluss" ? "Ihre Kunden" : "Ihre Termine",
    ref: d.ref, partner: koopPartnerName(d.partner), anrede: koopPartnerAnrede(d.partner), gruss: koopPartnerGruss(d.partner), email: d.partner.email,
    preis: modell === "platz" ? `${koopEur(d.parameter.preisCents)} netto im Monat` : modell === "abschluss" ? `${koopEur(d.parameter.preisCents)} / ${koopEur(d.parameter.zweitCents)} netto je Abschluss` : koopEur(d.parameter.preisCents), reklamationTage: d.parameter.reklamationTage,
    stand: { ...stand, zeitenText: koopZeitenText(stand.zeiten) },
    gruende: KOOP_REKLAMATION_GRUENDE,
    kontakte: kontakte.map((k) => {
      const bis = reklamationBis(k, d.parameter.reklamationTage);
      return {
        id: Number(k.id), name: `${k.vorname} ${k.nachname}`, telefon: k.telefon, email: k.email, thema: k.thema,
        termin: new Date(k.termin_beginn).toISOString(), terminText: formatBerlin(new Date(k.termin_beginn)), art: koopTerminArtText(k.termin_art), dauerMin: k.termin_dauer_min,
        notiz: k.notiz, uebermitteltAm: k.uebermittelt_am ? new Date(k.uebermittelt_am).toISOString() : null, ersatz: k.ersatz_fuer_id != null,
        status: k.status, reklamation: k.reklamiert_am ? { grund: koopReklamationGrundText(k.reklamation_grund), wahl: k.reklamation_wahl, ergebnis: k.reklamation_ergebnis, begruendung: k.reklamation_begruendung } : null,
        reklamierbarBis: modell === "kontakt" && k.status === "uebermittelt" && !k.reklamiert_am && jetzt < bis ? bis.toISOString() : null,
        keinKontakt: !!k.kein_kontakt_am,
        // E-390: Abschluss melden (Energie, Telefon) — offen, solange weder Abschluss noch „kein Abschluss“ gemeldet ist (90 Tage).
        abschluss: modell === "abschluss" ? {
          am: k.abschluss_am ? new Date(k.abschluss_am).toISOString() : null, art: k.abschluss_art ?? null,
          kein: !!k.kein_abschluss_am, betrag: k.abschluss_am ? koopEur(Number(k.preis_cents)) : null,
          meldbar: k.status === "uebermittelt" && !k.abschluss_am && !k.kein_abschluss_am && jetzt.getTime() - new Date(k.uebermittelt_am ?? k.created_at).getTime() < 120 * 864e5,
        } : null,
      };
    }),
    rechnungen: rechnungen.map((r) => ({
      monat: r.monat, monatText: koopMonatText(r.monat), anzahl: Number(r.anzahl), betrag: koopEur(Number(r.betrag_cents)), gutschrift: Number(r.gutschrift_cents) ? koopEur(Number(r.gutschrift_cents)) : null,
      nummer: r.invoice_number ?? null, status: r.ref ? (r.payment_status === "paid" ? "bezahlt" : "offen") : "keine Rechnung",
      faellig: r.payment_due_date ? formatBerlin(new Date(r.payment_due_date), false) : null,
      zahlung: r.payment_reference && r.payment_status !== "paid" ? `/zahlung/${r.payment_reference}` : null,
      pdf: r.payment_reference ? signInvoiceUrl(String(r.payment_reference), 30 * 24 * 3600_000) : null,
    })),
  };
}
export async function koopZeitenSetzen(z: AngebotZeile, roh: unknown, wer: string): Promise<Ergebnis<{ zeitenText: string }>> {
  const p = koopZeitenAus(roh);
  if (!p.ok) return nein(p.error);
  await sqlPool`UPDATE fiaon_global_angebote SET schalter = COALESCE(schalter, '{}'::jsonb) || ${jsonb({ zeiten: p.zeiten })}, updated_at = NOW() WHERE id = ${Number(z.id)}`;
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), wer, `Zeiten für Termine: ${koopZeitenText(p.zeiten)}`);
  return { ok: true, zeitenText: koopZeitenText(p.zeiten) };
}
export async function koopWunschSetzen(z: AngebotZeile, roh: unknown, wer: string): Promise<Ergebnis<{ wunschWoche: number }>> {
  const { koopWunschAus, KOOP_WUNSCH } = await import("@shared/fiaon-global-angebot-koop");
  const n = koopWunschAus(roh);
  if (!n) return nein(`Bitte eine Menge von ${KOOP_WUNSCH.min} bis ${KOOP_WUNSCH.max} je Woche.`);
  await sqlPool`UPDATE fiaon_global_angebote SET schalter = COALESCE(schalter, '{}'::jsonb) || ${jsonb({ wunschWoche: n })}, updated_at = NOW() WHERE id = ${Number(z.id)}`;
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), wer, `Wunschmenge geändert: ${n} Kontakte je Woche`);
  return { ok: true, wunschWoche: n };
}
/**
 * Reklamation (Ziffer 7). Entschieden wird sofort und nachvollziehbar:
 *   · Dublette: berechtigt, wenn derselbe Interessent zum selben Thema in der Exklusivfrist schon übermittelt war.
 *   · Einwilligung bestritten: FIAON weist die gespeicherte Einwilligung nach (Datum, Uhrzeit, Kanal, Wortlaut) → abgelehnt;
 *     fehlt der Nachweis, berechtigt. Der Betreuer bekommt eine Aufgabe, den Kunden kurz zu fragen.
 *   · Daten falsch, nicht erschienen, minderjährig/Ausland: berechtigt — die Angabe des Partners genügt.
 * Berechtigt heißt: Die Vergütung entfällt (vor der Rechnung nicht berechnet, danach Gutschrift in der nächsten).
 * Bei „Ersatz“ bekommt der Partner zusätzlich einen Kontakt außerhalb von Wunschmenge und Start-Rahmen.
 */
export async function koopReklamieren(z: AngebotZeile, kontaktId: number, ein: { grund: unknown; wahl: unknown; text?: unknown }, jetzt = new Date()): Promise<Ergebnis<{ ergebnis: "berechtigt" | "abgelehnt"; begruendung: string }>> {
  const d = koopDatenAus(z);
  const grund = KOOP_REKLAMATION_GRUENDE.find((g) => g.key === ein?.grund)?.key as KoopReklamationGrund | undefined;
  if (!grund) return nein("Bitte einen Grund wählen. „Kein Abschluss“ ist kein Reklamationsgrund (Ziffer 7).");
  const wahl: KoopReklamationWahl = ein?.wahl === "ersatz" ? "ersatz" : "gutschrift";
  const [k] = (await sqlPool`SELECT * FROM fiaon_koop_kontakte WHERE id = ${kontaktId} AND angebot_id = ${Number(z.id)}`) as any[];
  if (!k) return nein("Diesen Kontakt gibt es nicht.", 404);
  if (k.status !== "uebermittelt" || k.reklamiert_am) return nein("Dieser Kontakt ist schon reklamiert.", 409);
  if (jetzt >= reklamationBis(k, d.parameter.reklamationTage)) return nein(`Die Reklamationsfrist (${d.parameter.reklamationTage} Tage nach dem Termin) ist abgelaufen.`, 409);
  let ergebnis: "berechtigt" | "abgelehnt" = "berechtigt";
  let begruendung = "Berechtigt — die Vergütung entfällt.";
  if (grund === "dublette") {
    const [frueher] = (await sqlPool`
      SELECT created_at FROM fiaon_koop_kontakte
       WHERE person_id = ${Number(k.person_id)} AND LOWER(thema) = LOWER(${k.thema}) AND id <> ${kontaktId} AND status <> 'storniert'
         AND created_at < ${k.created_at} AND created_at > ${k.created_at}::timestamptz - make_interval(months => ${d.parameter.exklusivMonate}::int) LIMIT 1`) as any[];
    if (!frueher) { ergebnis = "abgelehnt"; begruendung = `Abgelehnt — derselbe Interessent wurde in den letzten ${d.parameter.exklusivMonate} Monaten zu diesem Thema nicht übermittelt.`; }
  }
  if (grund === "keine_einwilligung") {
    const [ew] = (await sqlPool`SELECT * FROM fiaon_koop_einwilligungen WHERE id = ${Number(k.einwilligung_id)}`) as any[];
    const vorUebermittlung = ew && (!ew.widerrufen_am || new Date(ew.widerrufen_am) > new Date(k.uebermittelt_am));
    if (vorUebermittlung) {
      ergebnis = "abgelehnt";
      begruendung = `Abgelehnt — Nachweis der Einwilligung: erteilt am ${formatBerlin(new Date(ew.erteilt_am))} (${ew.kanal === "telefon" ? "am Telefon" : "im Kundenbereich"}, Fassung ${ew.fassung}, aufgenommen von ${ew.erteilt_von ?? "FIAON"}). Wortlaut: „${ew.wortlaut}“`;
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: Number(k.person_id), ref: null, titel: `Partner meldet: Einwilligung bestritten — ${k.vorname} ${k.nachname}`,
        text: `${koopPartnerImSatz(d.partner)} meldet, dass der Kunde Einwilligung oder Gesprächswunsch bestreitet (Thema „${k.thema}“). Die Einwilligung ist gespeichert und wurde dem Partner nachgewiesen. Bitte den Kunden kurz anrufen: Wünscht er das Gespräch nicht mehr, in der Akte „Einwilligung widerrufen“ wählen.`,
        dringend: false, schluessel: `koop:${kontaktId}:bestritten`, bereich: "partner", quelle: "global", autorName: "FIAON", link: `/akte/${k.person_id}`,
      }).catch((e: unknown) => console.error("[KOOP] Aufgabe bestritten:", e));
    }
  }
  const textFrei = text(ein?.text, 500) || null;
  if (ergebnis === "berechtigt") {
    await sqlPool`
      UPDATE fiaon_koop_kontakte SET status = 'reklamiert', reklamiert_am = ${jetzt}, reklamation_grund = ${grund}, reklamation_text = ${textFrei},
             reklamation_wahl = ${wahl}, reklamation_ergebnis = 'berechtigt', reklamation_begruendung = ${begruendung}
       WHERE id = ${kontaktId} AND status = 'uebermittelt'`;
    if (wahl === "ersatz") begruendung = "Berechtigt — die Vergütung entfällt, und Sie bekommen einen Ersatzkontakt (außerhalb Ihrer Wunschmenge).";
    else begruendung = k.rechnung_id ? "Berechtigt — wir schreiben die Vergütung in Ihrer nächsten Monatsrechnung gut." : "Berechtigt — dieser Kontakt wird nicht berechnet.";
  } else {
    await sqlPool`
      UPDATE fiaon_koop_kontakte SET reklamiert_am = ${jetzt}, reklamation_grund = ${grund}, reklamation_text = ${textFrei}, reklamation_wahl = ${wahl},
             reklamation_ergebnis = 'abgelehnt', reklamation_begruendung = ${begruendung}
       WHERE id = ${kontaktId} AND status = 'uebermittelt'`;
  }
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), koopPartnerName(d.partner), `Reklamation Kontakt #${kontaktId} (${koopReklamationGrundText(grund)}, Wahl ${wahl}): ${ergebnis}`);
  // Textform (Ziffer 7): Die Entscheidung geht auch per Mail an den Partner.
  await freitext(d.partner.email, `Ihre Reklamation: ${k.vorname} ${k.nachname} — ${ergebnis === "berechtigt" ? "berechtigt" : "abgelehnt"}`,
    [`Ihre Reklamation zum Kontakt ${k.vorname} ${k.nachname} (Thema „${k.thema}“, Termin ${formatBerlin(new Date(k.termin_beginn))}) mit dem Grund „${koopReklamationGrundText(grund)}“:`, begruendung, `Ihr Partnerbereich: ${koopPartnerLink(z)}`].join("\n\n"),
    { anrede: `${koopPartnerAnrede(d.partner)},`, event: "koop_reklamation_partner", personId: z.person_id != null ? Number(z.person_id) : null });
  return { ok: true, ergebnis, begruendung };
}
/** Der Partner meldet: Der Interessent wünscht keinen Kontakt mehr (Ziffer 5) — das ist ein Widerruf gegenüber dem Partner. */
export async function koopKeinKontakt(z: AngebotZeile, kontaktId: number): Promise<Ergebnis<{ meldung: string }>> {
  const [k] = (await sqlPool`UPDATE fiaon_koop_kontakte SET kein_kontakt_am = COALESCE(kein_kontakt_am, NOW()) WHERE id = ${kontaktId} AND angebot_id = ${Number(z.id)} RETURNING person_id`) as any[];
  if (!k) return nein("Diesen Kontakt gibt es nicht.", 404);
  await sqlPool`
    UPDATE fiaon_koop_einwilligungen SET widerrufen_am = NOW(), widerruf_kanal = 'partner', widerruf_von = ${koopPartnerName(koopDatenAus(z).partner)}
     WHERE person_id = ${Number(k.person_id)} AND art = 'uebermittlung' AND angebot_id = ${Number(z.id)} AND widerrufen_am IS NULL`;
  await verlauf(Number(k.person_id), "Partner-Termine: Der Partner meldet, dass der Kunde keinen Kontakt mehr wünscht. Einwilligung für diesen Partner beendet.", { name: "Partner" });
  return { ok: true, meldung: "Danke — wir haben es vermerkt. Bitte kontaktieren Sie den Interessenten nicht mehr." };
}

/**
 * E-390: Der Partner meldet einen Abschluss (Energie: Lieferbeginn bestätigt; Telefon: aktiviert, Widerrufsfrist abgelaufen) —
 * Ziffer 6 des Vertrags. Ab jetzt zählt der Kontakt mit dem Preis der Sparte zur Monatsrechnung des laufenden Monats.
 * „kein“ = kein Vertrag (nur Übersicht, nie berechnet). Einmal gemeldet, bleibt die Meldung stehen.
 */
export async function koopAbschlussMelden(z: AngebotZeile, kontaktId: number, sparte: unknown, jetzt = new Date()): Promise<Ergebnis<{ meldung: string }>> {
  const d = koopDatenAus(z);
  if (koopModellVon(d.parameter.bereich) !== "abschluss") return nein("In diesem Vertrag werden keine Abschlüsse gemeldet.", 409);
  const sparten: readonly string[] = KOOP_BEREICH[d.parameter.bereich].sparten ?? [];
  const kein = sparte === "kein";
  const i = sparten.indexOf(String(sparte));
  if (!kein && i < 0) return nein("Bitte die Sparte wählen.");
  const preis = i === 0 ? d.parameter.preisCents : d.parameter.zweitCents;
  const monat = monatAus(jetzt);
  const [k] = (kein
    ? await sqlPool`UPDATE fiaon_koop_kontakte SET kein_abschluss_am = ${jetzt}
                     WHERE id = ${kontaktId} AND angebot_id = ${Number(z.id)} AND status = 'uebermittelt' AND abschluss_am IS NULL AND kein_abschluss_am IS NULL RETURNING id`
    : await sqlPool`UPDATE fiaon_koop_kontakte SET abschluss_am = ${jetzt}, abschluss_art = ${sparten[i]}, preis_cents = ${preis}, abrechnung_monat = ${monat}
                     WHERE id = ${kontaktId} AND angebot_id = ${Number(z.id)} AND status = 'uebermittelt' AND abschluss_am IS NULL AND kein_abschluss_am IS NULL AND rechnung_id IS NULL RETURNING id`) as any[];
  if (!k) return nein("Für diesen Kunden ist schon etwas gemeldet.", 409);
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), koopPartnerName(d.partner), kein ? `Kontakt #${kontaktId}: kein Abschluss gemeldet` : `Kontakt #${kontaktId}: Abschluss ${sparten[i]} gemeldet (${koopEur(preis)})`);
  return { ok: true, meldung: kein ? "Danke — vermerkt: kein Abschluss. Es wird nichts berechnet." : `Danke — Abschluss ${sparten[i]} gemeldet. Er steht in der Monatsrechnung ${koopMonatText(monat)} (${koopEur(preis)} netto).` };
}

// ═══════════════════════════════════════════════════════════════════════════
// MONATSRECHNUNG (Ziffer 6)
// ═══════════════════════════════════════════════════════════════════════════
function monatAus(d: Date): string { return berlinDatum(d).slice(0, 7); }
/** Partnerplatz: der erste berechnete Monat ist der Monat nach der Annahme (Ziffer 3 Abs. 3). */
function koopPlatzStartMonat(z: AngebotZeile): string {
  const an = z.angenommen_am ? monatAus(new Date(z.angenommen_am)) : monatAus(new Date());
  const [y, m] = an.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
/** Legt die Rechnung eines abgeschlossenen Monats an — genau einmal je Partner und Monat (Zeile in fiaon_koop_rechnungen). */
export async function koopMonatsrechnung(z: AngebotZeile, monat: string, jetzt = new Date()): Promise<{ angelegt: boolean; ref: string | null; betragCents: number; anzahl: number }> {
  await ensureKoopTabellen();
  const d = koopDatenAus(z);
  const platz = koopModellVon(d.parameter.bereich) === "platz";
  // Partnerplatz: im Voraus zum Ersten des Monats (ab dem Folgemonat der Annahme); sonst nach Monatsende.
  if (platz ? monat > monatAus(jetzt) || monat < koopPlatzStartMonat(z) : monat >= monatAus(jetzt)) return { angelegt: false, ref: null, betragCents: 0, anzahl: 0 };
  const erg = await sqlPool.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(${SPERRE_KLASSE + 1}, ${Number(z.id)})`;
    const [da] = (await tx`SELECT id FROM fiaon_koop_rechnungen WHERE angebot_id = ${Number(z.id)} AND monat = ${monat}`) as any[];
    if (da) return null;
    const posten = (await tx`
      SELECT id, preis_cents FROM fiaon_koop_kontakte
       WHERE angebot_id = ${Number(z.id)} AND status = 'uebermittelt' AND abrechnung_monat = ${monat} AND rechnung_id IS NULL ORDER BY uebermittelt_am`) as any[];
    // Gutschriften: berechtigt reklamierte Kontakte, die schon in einer früheren Rechnung standen.
    const gut = (await tx`
      SELECT id, preis_cents FROM fiaon_koop_kontakte
       WHERE angebot_id = ${Number(z.id)} AND status = 'reklamiert' AND rechnung_id IS NOT NULL AND gutschrift_rechnung_id IS NULL ORDER BY reklamiert_am`) as any[];
    const summe = platz ? d.parameter.preisCents : posten.reduce((s, p) => s + Number(p.preis_cents), 0);
    const angewandt: any[] = []; let gutCents = 0;
    for (const g of gut) { if (gutCents + Number(g.preis_cents) > summe) break; angewandt.push(g); gutCents += Number(g.preis_cents); }
    const betrag = summe - gutCents;
    const [r] = (await tx`
      INSERT INTO fiaon_koop_rechnungen (angebot_id, monat, anzahl, summe_cents, gutschrift_cents, betrag_cents)
      VALUES (${Number(z.id)}, ${monat}, ${posten.length}, ${summe}, ${gutCents}, ${betrag}) RETURNING id`) as any[];
    const rid = Number(r.id);
    if (posten.length) await tx`UPDATE fiaon_koop_kontakte SET rechnung_id = ${rid} WHERE id = ANY(${posten.map((p) => Number(p.id))}::bigint[])`;
    if (angewandt.length) await tx`UPDATE fiaon_koop_kontakte SET gutschrift_rechnung_id = ${rid} WHERE id = ANY(${angewandt.map((p) => Number(p.id))}::bigint[])`;
    if (betrag <= 0) return { rid, ref: null as string | null, betrag, anzahl: posten.length };
    // Die Bestellzeile — eigene Zeile, nie mit einer anderen Bestellung des Partners verknüpft.
    const ref = `FIAON-KOOP-${String(d.ref).slice(-6)}-${monat.replace("-", "")}`;
    const p = d.partner;
    const [b] = (await tx`
      INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, first_name, last_name, company_name, contact_name, email, billing_email,
                                      street, zip, city, country, person_id, amount_due, currency, payment_status, payment_due_date,
                                      payment_email_sent_at, rechnung_ust_modus, created_at, updated_at)
      VALUES (${ref}, 'business', 'submitted', ${KOOP_RECHNUNG_PAKET}, ${platz ? `FIAON Partnerplatz ${KOOP_BEREICH[d.parameter.bereich].name} — ${koopMonatText(monat)}` : `FIAON Partner-Kooperation — ${KOOP_BEREICH[d.parameter.bereich].einheit} ${koopMonatText(monat)}`},
              ${p.vorname}, ${p.nachname}, ${p.firma ? `${koopPartnerName(p)} · ${p.firma}` : koopPartnerName(p)}, ${koopPartnerName(p)}, ${p.email}, ${p.email},
              ${p.strasse}, ${p.plz}, ${p.ort}, ${p.land}, ${z.person_id != null ? Number(z.person_id) : null},
              ${(betrag / 100).toFixed(2)}, 'EUR', 'pending_payment', ${new Date(jetzt.getTime() + d.parameter.zahlungszielTage * 864e5)},
              NOW(), 'reverse_charge', NOW(), NOW())
      RETURNING ref`) as any[];
    await tx`UPDATE fiaon_koop_rechnungen SET ref = ${String(b.ref)} WHERE id = ${rid}`;
    return { rid, ref: String(b.ref), betrag, anzahl: posten.length };
  });
  if (!erg) return { angelegt: false, ref: null, betragCents: 0, anzahl: 0 };
  if (erg.ref) {
    const { ensureInvoiceNumber } = await import("../fiaon-invoice");
    await ensureInvoiceNumber(sqlPool, erg.ref);
    void koopRechnungSenden(erg.rid).catch((e) => console.error(`[KOOP] Rechnung ${erg.ref} senden:`, e));
  }
  return { angelegt: true, ref: erg.ref, betragCents: erg.betrag, anzahl: erg.anzahl };
}
/** Die Aufstellung (Ziffer 6: Tag der Übermittlung, Kürzel, Thema, Termin) als Zeilen — für PDF und Rechnungstext. */
export async function koopAufstellung(rechnungId: number): Promise<{ posten: { tag: string; kuerzel: string; thema: string; termin: string; betrag: string; ersatz: boolean }[]; gutschriften: { kuerzel: string; thema: string; betrag: string; grund: string }[] }> {
  const posten = (await sqlPool`SELECT * FROM fiaon_koop_kontakte WHERE rechnung_id = ${rechnungId} ORDER BY uebermittelt_am`) as any[];
  const gut = (await sqlPool`SELECT * FROM fiaon_koop_kontakte WHERE gutschrift_rechnung_id = ${rechnungId} ORDER BY reklamiert_am`) as any[];
  // E-390: Partnerplatz — eine Zeile für den Monat; Abschluss — die Sparte statt des Themas, Tag der Meldung.
  const [rz] = (await sqlPool`SELECT r.monat, r.betrag_cents, g.parameter FROM fiaon_koop_rechnungen r JOIN fiaon_global_angebote g ON g.id = r.angebot_id WHERE r.id = ${rechnungId}`) as any[];
  const par = json<any>(rz?.parameter, {});
  if (koopModellVon(par.bereich) === "platz" && rz) {
    return { posten: [{ tag: `01.${rz.monat.slice(5, 7)}.${rz.monat.slice(0, 4)}`, kuerzel: "—", thema: `Partnerplatz ${KOOP_BEREICH[par.bereich as keyof typeof KOOP_BEREICH].name}`, termin: koopMonatText(rz.monat), betrag: koopEur(Number(rz.betrag_cents)), ersatz: false }], gutschriften: [] };
  }
  if (koopModellVon(par.bereich) === "abschluss") {
    return { posten: posten.map((k) => ({ tag: new Date(k.abschluss_am ?? k.uebermittelt_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }), kuerzel: koopKuerzel(k.vorname, k.nachname), thema: `${k.abschluss_art ?? k.thema} (übermittelt ${new Date(k.uebermittelt_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })})`, termin: "Abschluss gemeldet", betrag: koopEur(Number(k.preis_cents)), ersatz: false })), gutschriften: [] };
  }
  return {
    posten: posten.map((k) => ({ tag: new Date(k.uebermittelt_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }), kuerzel: koopKuerzel(k.vorname, k.nachname), thema: k.thema, termin: formatBerlin(new Date(k.termin_beginn)), betrag: koopEur(Number(k.preis_cents)), ersatz: k.ersatz_fuer_id != null })),
    gutschriften: gut.map((k) => ({ kuerzel: koopKuerzel(k.vorname, k.nachname), thema: k.thema, betrag: `−${koopEur(Number(k.preis_cents))}`, grund: koopReklamationGrundText(k.reklamation_grund) })),
  };
}
const ESC = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export async function koopAufstellungPdf(rechnungId: number): Promise<Buffer | null> {
  const [r] = (await sqlPool`SELECT r.*, a.invoice_number FROM fiaon_koop_rechnungen r LEFT JOIN fiaon_applications a ON a.ref = r.ref WHERE r.id = ${rechnungId}`) as any[];
  if (!r) return null;
  const z = await angebotLesen({ id: Number(r.angebot_id) });
  if (!z) return null;
  const d = koopDatenAus(z);
  const a = await koopAufstellung(rechnungId);
  const zeilen = a.posten.map((p, i) => `<tr><td>${i + 1}</td><td>${ESC(p.tag)}</td><td>${ESC(p.kuerzel)}</td><td>${ESC(p.thema)}${p.ersatz ? " (Ersatz)" : ""}</td><td>${ESC(p.termin)}</td><td style="text-align:right">${ESC(p.betrag)}</td></tr>`).join("");
  const gut = a.gutschriften.map((g) => `<tr><td></td><td>Gutschrift</td><td>${ESC(g.kuerzel)}</td><td>${ESC(g.thema)} — ${ESC(g.grund)}</td><td></td><td style="text-align:right">${ESC(g.betrag)}</td></tr>`).join("");
  const body = `
    <p>Rechnung ${ESC(r.invoice_number ?? "—")} · Kooperationsvertrag ${ESC(d.ref)} · ${ESC(koopPartnerName(d.partner))}</p>
    <table style="width:100%;border-collapse:collapse;font-size:9pt" border="0" cellpadding="4">
      <thead><tr style="border-bottom:1px solid #0f2044;text-align:left"><th>#</th><th>Übermittelt</th><th>Interessent</th><th>Thema</th><th>Termin</th><th style="text-align:right">Betrag</th></tr></thead>
      <tbody>${zeilen}${gut}</tbody>
      <tfoot><tr style="border-top:1px solid #0f2044"><td colspan="5"><strong>Summe netto</strong> (${koopModellVon(d.parameter.bereich) === "platz" ? "Partnerplatz" : `${Number(r.anzahl)} ${KOOP_BEREICH[d.parameter.bereich].einheit}`}${Number(r.gutschrift_cents) ? `, abzüglich Gutschriften ${ESC(koopEur(Number(r.gutschrift_cents)))}` : ""})</td><td style="text-align:right"><strong>${ESC(koopEur(Number(r.betrag_cents)))}</strong></td></tr></tfoot>
    </table>
    <p style="font-size:8pt;color:#64748b">Nettobeträge. Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG) — die Rechnung weist keine Umsatzsteuer aus. Interessenten nur mit Kürzel (Datensparsamkeit); die vollständigen Angaben stehen in Ihrem Partnerbereich.</p>`;
  const { wrapFiaonDocument, htmlZuPdfMitFusszeile } = await import("./fiaon-html-pdf");
  const titel = `Aufstellung zur Rechnung — ${koopMonatText(r.monat)}`;
  const html = wrapFiaonDocument({ documentTitle: titel, subtitle: `FIAON Partner-Kooperation · ${koopMonatText(r.monat)}`, bodyHtml: body, markenzeile: "FIAON LTD · Company No. 17318250 · 128 City Road, London, EC1V 2NX, United Kingdom" });
  return htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · Aufstellung ${r.invoice_number ?? ""} · ${d.ref}`, rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" } });
}
/** Rechnung + Aufstellung als PDF an den Partner — genau einmal (mail_am), sonst Fehler an der Zeile und neuer Versuch im Lauf. */
export async function koopRechnungSenden(rechnungId: number): Promise<{ ok: boolean; grund?: string }> {
  const [r] = (await sqlPool`SELECT r.*, a.payment_reference, a.invoice_number, a.payment_due_date FROM fiaon_koop_rechnungen r JOIN fiaon_applications a ON a.ref = r.ref WHERE r.id = ${rechnungId}`) as any[];
  if (!r || r.mail_am) return { ok: !!r?.mail_am };
  const z = await angebotLesen({ id: Number(r.angebot_id) });
  if (!z) return { ok: false, grund: "Vertrag fehlt" };
  const d = koopDatenAus(z);
  const { rechnungAlsPdf } = await import("./fiaon-rechnung-pdf");
  const rechnung = await rechnungAlsPdf(String(r.payment_reference));
  if (!rechnung) return { ok: false, grund: "Rechnung fehlt" };
  const aufstellung = await koopAufstellungPdf(rechnungId).catch((e) => { console.error("[KOOP] Aufstellung-PDF:", e); return null; });
  const anhaenge = [{ name: rechnung.dateiname, inhalt: rechnung.pdf }, ...(aufstellung ? [{ name: `Aufstellung_${rechnung.rechnungsnummer}.pdf`, inhalt: aufstellung }] : [])];
  const res = await freitext(d.partner.email, `Ihre Rechnung ${rechnung.rechnungsnummer} — Kontakte ${koopMonatText(r.monat)}`, [
    koopModellVon(d.parameter.bereich) === "platz"
      ? `anbei Ihre Rechnung für den Partnerplatz ${KOOP_BEREICH[d.parameter.bereich].name} im ${koopMonatText(r.monat)} — ${koopEur(Number(r.betrag_cents))} netto (Reverse Charge).`
      : koopModellVon(d.parameter.bereich) === "abschluss"
        ? `anbei Ihre Monatsrechnung für ${koopMonatText(r.monat)}: ${Number(r.anzahl)} gemeldete Abschlüsse — ${koopEur(Number(r.betrag_cents))} netto (Reverse Charge).`
        : `anbei Ihre Monatsrechnung für ${koopMonatText(r.monat)}: ${Number(r.anzahl)} übermittelte Kontakte${Number(r.gutschrift_cents) ? `, abzüglich Gutschriften über ${koopEur(Number(r.gutschrift_cents))}` : ""} — ${koopEur(Number(r.betrag_cents))} netto (Reverse Charge).`,
    `Bitte überweisen Sie den Betrag bis zum ${formatBerlin(new Date(r.payment_due_date), false)} mit dem Verwendungszweck ${r.payment_reference}. Zahlungsseite: ${absoluteUrl(`/zahlung/${r.payment_reference}`)}`,
    `Die Aufstellung liegt bei; alle Kontakte und Reklamationen finden Sie in Ihrem Partnerbereich: ${koopPartnerLink(z)}`,
  ].join("\n\n"), { anrede: `${koopPartnerAnrede(d.partner)},`, absender: "accounting", anhaenge, event: "koop_rechnung", personId: z.person_id != null ? Number(z.person_id) : null });
  if (res.ok) await sqlPool`UPDATE fiaon_koop_rechnungen SET mail_am = NOW(), mail_fehler = NULL WHERE id = ${rechnungId}`;
  else await sqlPool`UPDATE fiaon_koop_rechnungen SET mail_fehler = ${String(res.grund ?? "").slice(0, 300)} WHERE id = ${rechnungId}`;
  return res.ok ? { ok: true } : { ok: false, grund: res.grund };
}

/** Für den Rechnungs-Renderer (fiaon-invoice.ts): Beschreibung und Zeitraum einer Monatsrechnung. */
export async function koopRechnungsZeile(ref: string): Promise<{ beschreibung: string; zeitraum: string } | null> {
  const [r] = (await sqlPool`SELECT r.*, g.parameter FROM fiaon_koop_rechnungen r JOIN fiaon_global_angebote g ON g.id = r.angebot_id WHERE r.ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  if (!r) return null;
  const par = json<any>(r.parameter, {});
  const preis = Number(par.preisCents) || 0;
  const modell = koopModellVon(par.bereich);
  const gut = Number(r.gutschrift_cents) ? `, abzüglich Gutschrift ${koopEur(Number(r.gutschrift_cents))} für berechtigt reklamierte Kontakte` : "";
  return {
    beschreibung: modell === "platz"
      ? `Partnerplatz ${KOOP_BEREICH[par.bereich as keyof typeof KOOP_BEREICH].name} im FIAON Partner-Netzwerk (Sichtbarkeit, Nennung, Terminorganisation) — fester Monatspreis, unabhängig von Mandaten`
      : modell === "abschluss"
        ? `Vermittelte Abschlüsse laut Ihrer Meldung (Kooperationsvertrag): ${Number(r.anzahl)} Verträge — Aufstellung als Anlage`
        : `Qualifizierte Kontakte mit Einwilligung, Wunschthema und Termin (Kooperationsvertrag): ${Number(r.anzahl)} × ${koopEur(preis)} netto${gut} — Aufstellung als Anlage`,
    zeitraum: `${formatBerlin(`${r.monat}-01T12:00:00Z`, false).replace(/^[^,]+, /, "")} – ${formatBerlin(`${koopMonatEnde(r.monat)}T12:00:00Z`, false).replace(/^[^,]+, /, "")}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER STUNDENLAUF
// ═══════════════════════════════════════════════════════════════════════════
export async function koopLieferLauf(jetzt = new Date()): Promise<{ uebermittelt: number; partnerMails: number; rechnungen: number; rechnungMails: number; erinnerungen: number }> {
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebote') AS g`) as any[];
  if (!t?.g) return { uebermittelt: 0, partnerMails: 0, rechnungen: 0, rechnungMails: 0, erinnerungen: 0 };
  await ensureKoopTabellen();
  let uebermittelt = 0, partnerMails = 0, rechnungen = 0, rechnungMails = 0, erinnerungen = 0;
  // 1. Übermittlungen nachholen (Mail scheiterte) — höchstens zehn Versuche.
  for (const k of (await sqlPool`SELECT id FROM fiaon_koop_kontakte WHERE status = 'geplant' AND mail_versuche < 10 AND created_at < NOW() - INTERVAL '5 minutes' ORDER BY id LIMIT 50`) as any[]) {
    if ((await koopUebermitteln(Number(k.id))).ok) uebermittelt++;
  }
  const partnerListe = await koopPartnerAlle();
  for (const z of partnerListe) {
    const d = koopDatenAus(z);
    // 2. Partnerbereich einmal nach der Annahme schicken — Zeiten und Menge trägt der Partner dort selbst ein.
    const [marke] = (await sqlPool`
      UPDATE fiaon_global_angebote SET schalter = COALESCE(schalter, '{}'::jsonb) || ${jsonb({ partnerMailAm: jetzt.toISOString() })}, updated_at = NOW()
       WHERE id = ${Number(z.id)} AND COALESCE(schalter->>'partnerMailAm', '') = '' RETURNING id`) as any[];
    if (marke) {
      const r = await freitext(d.partner.email, "Ihr FIAON-Partnerbereich: Zeiten freigeben, Termine sehen", [
        `willkommen in der FIAON Partner-Kooperation (${d.ref}). In Ihrem Partnerbereich geben Sie die Zeiten frei, in denen wir Termine für Sie vereinbaren dürfen, und ändern Ihre Wunschmenge je Woche.`,
        "Dort sehen Sie auch jeden übermittelten Kontakt, reklamieren mit einem Klick und finden Ihre Monatsrechnungen. Sobald Ihre Zeiten stehen, beginnt unser Team mit den ersten Terminen.",
        `Ihr Partnerbereich (bitte nicht weitergeben): ${koopPartnerLink(z)}`,
      ].join("\n\n"), { anrede: `${koopPartnerAnrede(d.partner)},`, event: "koop_partnerbereich", personId: z.person_id != null ? Number(z.person_id) : null });
      if (r.ok) partnerMails++;
      else await sqlPool`UPDATE fiaon_global_angebote SET schalter = schalter - 'partnerMailAm' WHERE id = ${Number(z.id)}`;
    }
    // 3. Monatsrechnungen für jeden abgeschlossenen Monat ohne Zeile (holt verpasste Monate nach).
    // E-390: Partnerplatz — jeden Monat ab dem Folgemonat der Annahme bis einschließlich des laufenden (im Voraus).
    if (koopModellVon(d.parameter.bereich) === "platz") {
      const ende = String(schalterAus(z).endeAm ?? "");
      for (let m = koopPlatzStartMonat(z); m <= monatAus(jetzt) && (!/^\d{4}-\d{2}/.test(ende) || m <= ende.slice(0, 7)); m = koopTagPlus(`${m}-28`, 7).slice(0, 7)) {
        const r = await koopMonatsrechnung(z, m, jetzt);
        if (r.angelegt && r.ref) rechnungen++;
      }
      continue;
    }
    const [erste] = (await sqlPool`SELECT MIN(abrechnung_monat) AS m FROM fiaon_koop_kontakte WHERE angebot_id = ${Number(z.id)} AND abrechnung_monat IS NOT NULL`) as any[];
    const vormonat = koopVormonat(monatAus(jetzt));
    if (erste?.m) {
      for (let m = String(erste.m); m <= vormonat; m = koopTagPlus(`${m}-28`, 7).slice(0, 7)) {
        const r = await koopMonatsrechnung(z, m, jetzt);
        if (r.angelegt && r.ref) rechnungen++;
      }
    }
  }
  // 4. Rechnungsmails nachholen.
  for (const r of (await sqlPool`SELECT id FROM fiaon_koop_rechnungen WHERE ref IS NOT NULL AND mail_am IS NULL AND erstellt_am < NOW() - INTERVAL '5 minutes'`) as any[]) {
    if ((await koopRechnungSenden(Number(r.id))).ok) rechnungMails++;
  }
  // 5. Eine Erinnerung am Tag nach der Fälligkeit — mit dem Hinweis, wann die Übermittlung ruht (Ziffer 6).
  const faellig = (await sqlPool`
    SELECT r.id, r.angebot_id, r.monat, a.invoice_number, a.payment_reference, a.amount_due, a.payment_due_date
      FROM fiaon_koop_rechnungen r JOIN fiaon_applications a ON a.ref = r.ref
     WHERE r.erinnert_am IS NULL AND r.mail_am IS NOT NULL AND a.payment_status IN ('pending_payment', 'claimed_paid')
       AND (a.payment_due_date AT TIME ZONE 'Europe/Berlin')::date < ${berlinToday(jetzt)}::date`) as any[];
  for (const r of faellig) {
    const z = partnerListe.find((x) => Number(x.id) === Number(r.angebot_id)) ?? await angebotLesen({ id: Number(r.angebot_id) });
    if (!z) continue;
    const d = koopDatenAus(z);
    const ruhtAb = formatBerlin(`${koopTagPlus(berlinDatum(new Date(r.payment_due_date)), d.parameter.ruhenNachTagen + 1)}T12:00:00Z`, false);
    const res = await freitext(d.partner.email, `Erinnerung: Rechnung ${r.invoice_number} ist offen`, [
      `die Rechnung ${r.invoice_number} (${koopMonatText(r.monat)}, ${koopEur(Math.round(Number(r.amount_due) * 100))} netto) war am ${formatBerlin(new Date(r.payment_due_date), false)} fällig. Falls Sie schon überwiesen haben, ist alles gut — dann kreuzen sich unsere Nachrichten.`,
      `Sonst bitten wir um Zahlung mit dem Verwendungszweck ${r.payment_reference}: ${absoluteUrl(`/zahlung/${r.payment_reference}`)}. Ist die Rechnung ab dem ${ruhtAb} noch offen, ruht die Übermittlung neuer Kontakte bis zum Zahlungseingang (Ziffer 6); vereinbarte Termine bleiben bestehen.`,
    ].join("\n\n"), { anrede: `${koopPartnerAnrede(d.partner)},`, absender: "accounting", event: "koop_rechnung_erinnerung", personId: z.person_id != null ? Number(z.person_id) : null });
    if (res.ok) { await sqlPool`UPDATE fiaon_koop_rechnungen SET erinnert_am = NOW() WHERE id = ${Number(r.id)}`; erinnerungen++; }
  }
  return { uebermittelt, partnerMails, rechnungen, rechnungMails, erinnerungen };
}

/** Für die Liste der Leitung (Reiter „Individualangebote“): Lieferung in einer Zeile + Partnerbereich-Link. */
export async function koopListenLieferung(z: AngebotZeile): Promise<{ zeile: string; partnerLink: string } | null> {
  if (String(z.status) !== "angenommen") return null;
  const s = await koopLieferStand(z).catch(() => null);
  if (!s) return null;
  const teile = [
    `${koopMonatText(s.monat.monat)}: ${s.monat.geliefert} Kontakte`,
    `Woche ${s.woche.geliefert}/${s.woche.wunsch}`,
    ...(s.startRahmen ? [`Start-Rahmen ${s.startRahmen.geliefert}/${s.startRahmen.deckel}`] : []),
    ...(s.ersatzOffen ? [`${s.ersatzOffen} Ersatz offen`] : []),
    s.zeiten ? `Zeiten: ${koopZeitenText(s.zeiten)}` : "Zeiten fehlen (trägt der Partner im Partnerbereich ein)",
    ...(s.ruht ? [`RUHT: Rechnung ${s.ruht.rechnung} offen`] : []),
  ];
  return { zeile: teile.join(" · "), partnerLink: koopPartnerLink(z) };
}
