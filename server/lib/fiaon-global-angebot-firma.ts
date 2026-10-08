// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS FIRMENANGEBOT (B2B): ABLAUF, DATENBANK, RECHNUNGEN, LEITUNG
// Register E-301 (07.10.2026) — eigener Pfad neben dem Individualangebot E-268.
//
// Die Texte stehen in shared/fiaon-global-angebot-firma.ts; hier nur der Ablauf. Der Weg des
// Individualangebots (server/lib/fiaon-global-angebot.ts) wird nur an Verzweigungsstellen berührt:
//   if (istFirmenFassung(z.fassung)) return (await import("./fiaon-global-angebot-firma")).firma…(…)
// So bleibt das offene Angebot von Herrn Hildbrand Byte für Byte gleich (Prüfsumme im Prüfstand).
//
// ── DER WEG ───────────────────────────────────────────────────────────────
//   Anlegen NUR per Skript (scripts/angebot-firma-anlegen.ts, private JSON außerhalb des Repos) →
//   signierter Link (derselbe Token wie E-268) → Kundin liest /business/angebot/:token (FirmaKundenSicht) →
//   Annahme mit zwei Häkchen (Unternehmergeschäft, Vertretung), Unterschrift (gezeichnet oder getippt, Runde 2) und
//   Prüfsumme → Garantiefrist ab dem Tag der Annahme (Fassung C) → Vertrags-PDF mit Annahmevermerk und Unterschrift →
//   Bestellzeile „Gründung“ (Firma, UID, Reverse Charge) → Akte → Person am Angebot (Global-Kunde-Regel E-272) →
//   Startgespräch (E-273) → Aufgaben. Leitung „Shop live“ (Runde 2) → Starttag → Monatsteile des Wachstumsbudgets
//   für die Mindestlaufzeit, erste Monatsrechnung an diesem Tag.
//   Stundenlauf (über globalAngebotLauf): Monatsrechnung am Fälligkeitstag (Berlin), Verlängerung, wenn die
//   Kündigungsfrist ohne Kündigung verstrichen ist, Fristende der Garantie als Aufgabe.
//   Chefbüro (Leitung): Freigabe Anwalt, Bedingungen erfüllt (Garantiefrist), erste Runde erhalten, Frist ruhen,
//   Garantiefall (Erstattung der Gründung), Umsatz eintragen, Verkauf eintragen, Kündigung.
//
// ── WAS BEWUSST NICHT PASSIERT ────────────────────────────────────────────
//   · Kein Geld per SQL. Erstattet wird von Hand (Aufgabe an Justin), gebucht über den einen Weg.
//   · Keine automatische Kundenmail (Justin 07.10.2026): Vertrag, Rechnungen und Termine schickt der Ansprechpartner
//     (Aufgabe je Vorgang). Die Bestätigung des Individualangebots geht an Firmen NIE; der Zahlungstakt erinnert eine
//     Firmenakte nicht per Mail (nur die Aufgabe am zehnten Tag); die Terminerinnerung zum Startgespräch gilt ab der
//     Buchung als erledigt; dazu die Wände an beiden Mail-Türen (fiaon-global-firma-post.ts) — nur von Hand geht etwas raus.
//   · Bilder nie öffentlich: Sie liegen in fiaon_global_angebot_bilder und gehen nur über …/:token/bild/:name raus.
//   · Verkauf durch Gesellschafter: keine Rechnung an die Firma (Ziffer 12 Absatz 5) — Teil vorgemerkt, Aufgabe an Justin.
//   · Nichts wird gelöscht. Kündigung und Wegfall von Monatsteilen sind Status (entfallen_am).
// ═══════════════════════════════════════════════════════════════════════════
import { randomBytes, createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";
import { wrapFiaonDocument, htmlZuPdfMitFusszeile, docHash } from "./fiaon-html-pdf";
import { GLOBAL_VERTRAG_CSS } from "./fiaon-global-vertrag";
import { ANGEBOT_VERTRAG_CSS } from "./fiaon-global-angebot-vertrag";
import {
  ensureAngebotTabellen, firmaTeileCheckSichern, angebotLesen, angebotTokenErzeugen, angebotKundenPfad, angebotStatusAus, verlaufAngebot,
  hemmungRechnen, angebotTokenPruefen, angebotLinkAbgelaufen, ANGEBOT_PAKET_KEY, type AngebotZeile, type AnnahmeKontext,
} from "./fiaon-global-angebot";
import { globalAkteLesen, globalBestellungLesen, globalVerlauf, globalEinstellungen, globalMeinAuftragUrl, ustIdNormalisieren } from "./fiaon-global-auftrag";
import { globalOfficeAuftragPfad } from "@shared/fiaon-global-wege";
import { dachNummer } from "@shared/fiaon-dach-telefon";
import { BUERGIN_VORGABE, type AngebotBuergin } from "@shared/fiaon-global-angebot";
import {
  FIRMA_FASSUNG, FIRMA_FASSUNGEN, FIRMA_VORGABEN, FIRMA_GUELTIG_TAGE, FIRMA_KNOPF, FIRMA_ANNAHME, FIRMA_TEIL_TITEL, FIRMA_START_SPAETESTENS_TAGE,
  ANLAGE1_FIRMA_FASSUNG, COMPLIANCE_CSS, FIRMA_LAND_NAME,
  firmaParameterAus, firmaParameterFehler, firmaPflichtFehlen, firmaVersandSperre, firmaSeite, firmaBestellUebersicht, firmaAnnahmeTexte,
  firmaAnsprechpartner, firmaKundeAnrede, firmaVertreterName, firmaVertragTitel, firmaVertragUnterzeile, firmaRumpfHtml, firmaHashEingabe,
  firmaAnlage1HashEingabe, firmaAnlage1Html, firmaTeilPaketname, firmaRechnungsText, complianceKundenfassung, complianceHtml,
  firmaEur, firmaEurKurz, firmaUsd, firmaTag, monatFaelligAm, monatZeitraum, laufzeitEnde, kuendigungSpaetestens, kuendigungWirksamZum,
  umsatzSchwelleJahr, umsatzBeteiligungRechnen, verkaufBeteiligungRechnen, garantieFristEnde, plusTageIso, zahlwort, monateWort,
  umsatzBeteiligungEnde, kuendigungSperrtGarantie, quartalsEnde, firmaInhaltMitBildLinks, FIRMA_BILD_NAME, garantieAbAnnahme,
  garantieNurAuszahlung, budgetSpaetestensGilt, budgetSpaetesterStart,
  type FirmaDaten, type FirmaParameter, type FirmaFreigaben, type FirmaAnnahmeVermerk, type FirmaUnterschriftVermerk,
} from "@shared/fiaon-global-angebot-firma";
import type { FirmaKunde, FirmaKundenSicht, FirmaLand } from "@shared/fiaon-global-angebot-firma-typen";

// ── Kleine Helfer (wie im Individualangebot) ──────────────────────────────────
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object" && !Buffer.isBuffer(v)) return v as T;
  try { const x = JSON.parse(String(v ?? "")); return (typeof x === "string" ? JSON.parse(x) : x) as T; } catch { return leer; }
}
const jsonb = (v: unknown) => sqlPool.json(v as any);
const isoTag = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return berlinToday(v);
  const s = String(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
type Ergebnis<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const nein = (error: string, status = 400) => ({ ok: false as const, status, error });
const neueRef = () => `FIAON-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").slice(0, 4).toUpperCase()}`;
const CHEF_LINK = "/chef/s/global-auftraege?reiter=angebote";
/**
 * Monats-, Umsatz- und Verkaufsteile teilen sich den Nummernkreis nr je Angebot. Wer eine Nummer zieht, hält dafür eine
 * Sperre je Angebot (pg_advisory_xact_lock, gehalten bis zum Ende der kleinen Transaktion) — sonst könnte ein Umsatzteil
 * die Nummer eines Monats belegen und ON CONFLICT ließe den Monat stillschweigend aus.
 */
async function nummernSperre<T>(id: number, fn: () => Promise<T>): Promise<T> {
  return (await sqlPool.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`fiaon-firma-teile:${id}`}))`;
    return fn();
  })) as T;
}

// ═══════════════════════════════════════════════════════════════════════════
// LESEN
// ═══════════════════════════════════════════════════════════════════════════
/** Die Freigaben (Migration 096) — getrennt gelesen, damit ein fehlendes Feld das Individualangebot nie berührt. */
export async function firmaFreigabenLesen(id: number): Promise<FirmaFreigaben> {
  const [r] = (await sqlPool`SELECT freigaben FROM fiaon_global_angebote WHERE id = ${id} LIMIT 1`.catch(() => [])) as any[];
  return json<FirmaFreigaben>(r?.freigaben, {});
}
export async function firmaFreigabenFuer(ids: number[]): Promise<Map<number, FirmaFreigaben>> {
  if (!ids.length) return new Map();
  const zeilen = (await sqlPool`SELECT id, freigaben FROM fiaon_global_angebote WHERE id = ANY(${ids})`.catch(() => [])) as any[];
  return new Map(zeilen.map((z) => [Number(z.id), json<FirmaFreigaben>(z.freigaben, {})]));
}
/**
 * Die Daten des Angebots. Ein OFFENES Angebot zeigt immer die aktuelle Fassung — auch die aktuelle Kundenfassung des
 * Prüfberichts: complianceKundenfassung läuft beim Lesen erneut (sie ist wiederholbar, Prüfstand), damit ein Bericht, der
 * vor einer Änderung der Filter gespeichert wurde, keine internen Sätze mehr zeigt. Ein angenommenes Angebot behält
 * genau den Text, über den seine Prüfsumme läuft.
 */
export function firmaDatenAus(z: AngebotZeile): FirmaDaten {
  const roh = z.pruefbericht ? json<any>(z.pruefbericht, null) : null;
  const pb = roh && roh.art === "compliance" && String(z.status) === "offen" ? complianceKundenfassung(roh) : roh;
  return {
    ref: String(z.angebot_ref),
    fassung: String(z.status) === "offen" ? FIRMA_FASSUNG : String(z.fassung),
    kunde: json<FirmaKunde>(z.kunde, {} as FirmaKunde),
    parameter: firmaParameterAus(json<Partial<FirmaParameter>>(z.parameter, {})),
    buergin: { ...BUERGIN_VORGABE, ...json<Partial<AngebotBuergin>>(z.buergin, {}), name: BUERGIN_VORGABE.name },
    compliance: pb && pb.art === "compliance" ? pb : null,
    gueltigBis: isoTag(z.gueltig_bis) ?? berlinToday(),
  };
}
function schalterAus(z: AngebotZeile): { starttag: string | null; startWahl: string | null; shopLiveAm: string | null; unterschrift: FirmaUnterschriftVermerk | null } {
  const s = json<Record<string, unknown>>(z.schalter, {});
  const u = s.unterschrift && typeof s.unterschrift === "object" ? (s.unterschrift as FirmaUnterschriftVermerk) : null;
  return {
    starttag: typeof s.starttag === "string" && ISO.test(s.starttag) ? s.starttag : null,
    startWahl: typeof s.startWahl === "string" && ISO.test(s.startWahl) ? s.startWahl : null,
    shopLiveAm: typeof s.shopLiveAm === "string" && ISO.test(s.shopLiveAm) ? s.shopLiveAm : null,
    unterschrift: u && (u.art === "gezeichnet" || u.art === "getippt") ? u : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE UNTERSCHRIFT (Runde 2, Justin 08.10.2026, Punkt 11) — Pflicht für die Annahme, hier geprüft (nicht nur in der Oberfläche)
//   gezeichnet: ein PNG aus dem Feld (data:image/png;base64,…), höchstens 400 KB, mit echter Tinte (nicht leer).
//   getippt:    der Name in Schreibschrift — er muss den Nachnamen der Vertretung enthalten; ein mitgeschicktes Bild (die Seite
//               setzt den Namen in Schreibschrift) wird genauso geprüft und fürs PDF gespeichert, ist aber nicht Pflicht.
// ═══════════════════════════════════════════════════════════════════════════
const PNG_KOPF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/**
 * Hat ein PNG sichtbare Tinte? Gelesen werden IHDR und die IDAT-Daten (entpackt). Bei RGBA mit 8 Bit (so liefert jeder Browser ein
 * Zeichenfeld mit durchsichtigem Grund) ist ein leeres Feld nach jedem Zeilenfilter nur Nullen — ein Byte ungleich null außer dem
 * Filterbyte je Zeile heißt: Es wurde gezeichnet. Andere Farbtypen: nur Größe und Aufbau geprüft. Rückgabe: Grund oder null (gut).
 */
export function firmaPngTintePruefen(png: Buffer): string | null {
  if (png.length < 200 || png.length > 400_000 || !png.subarray(0, 8).equals(PNG_KOPF)) return "kein gültiges Bild";
  let pos = 8; let breite = 0; let hoehe = 0; let tiefe = 0; let farbe = 0; const idat: Buffer[] = [];
  while (pos + 8 <= png.length) {
    const laenge = png.readUInt32BE(pos); const art = png.toString("latin1", pos + 4, pos + 8);
    const daten = png.subarray(pos + 8, pos + 8 + laenge);
    if (daten.length !== laenge) return "Bild abgeschnitten";
    if (art === "IHDR") { breite = daten.readUInt32BE(0); hoehe = daten.readUInt32BE(4); tiefe = daten[8]; farbe = daten[9]; }
    else if (art === "IDAT") idat.push(daten);
    else if (art === "IEND") break;
    pos += 12 + laenge;
  }
  if (breite < 80 || hoehe < 30 || breite > 4000 || hoehe > 2000 || !idat.length) return "Bildmaße unpassend";
  if (farbe !== 6 || tiefe !== 8) return null;
  let roh: Buffer;
  try { roh = inflateSync(Buffer.concat(idat)); } catch { return "Bild nicht lesbar"; }
  const zeile = breite * 4 + 1;
  if (roh.length < zeile * hoehe) return "Bild unvollständig";
  let tinte = 0;
  for (let y = 0; y < hoehe; y++) { const a = y * zeile + 1; for (let x = a; x < a + zeile - 1; x++) if (roh[x] !== 0) { tinte++; if (tinte > 40) return null; } }
  return "Das Unterschriftsfeld ist leer";
}
const kleinName = (t: string) => t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-zß]+/g, " ").trim();
/** Prüft die Unterschrift aus dem Annahme-Body — ok mit dem Vermerk (ohne Zeit/IP, die setzt die Annahme) oder der Fehlersatz. */
export function firmaUnterschriftPruefen(roh: any, kunde: FirmaKunde): { ok: true; vermerk: FirmaUnterschriftVermerk; bild: Buffer | null } | { ok: false; error: string; code: "UNTERSCHRIFT" } {
  const nein2 = (error: string) => ({ ok: false as const, error, code: "UNTERSCHRIFT" as const });
  if (!roh || typeof roh !== "object") return nein2(FIRMA_ANNAHME.fehltUnterschrift);
  const bildAus = (v: unknown): { png: string; buf: Buffer } | null | "falsch" => {
    if (v === undefined || v === null || v === "") return null;
    const m = String(v).match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return "falsch";
    const buf = Buffer.from(m[1], "base64");
    return firmaPngTintePruefen(buf) ? "falsch" : { png: `data:image/png;base64,${m[1]}`, buf };
  };
  if (roh.art === "gezeichnet") {
    const b = bildAus(roh.png);
    if (!b || b === "falsch") return nein2(FIRMA_ANNAHME.fehltUnterschrift);
    return { ok: true, vermerk: { art: "gezeichnet", name: null, png: b.png }, bild: b.buf };
  }
  if (roh.art === "getippt") {
    const name = String(roh.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const nach = kleinName(String(kunde.vertretung?.nachname ?? ""));
    if (name.length < 3 || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(name) || (nach && !kleinName(name).includes(nach))) {
      return nein2(FIRMA_ANNAHME.fehltName(String(kunde.vertretung?.nachname ?? "").trim()));
    }
    const b = bildAus(roh.png);
    return { ok: true, vermerk: { art: "getippt", name, png: b && b !== "falsch" ? b.png : null }, bild: b && b !== "falsch" ? b.buf : null };
  }
  return nein2(FIRMA_ANNAHME.fehltUnterschrift);
}

// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSUMME, HTML, PDF
// ═══════════════════════════════════════════════════════════════════════════
export function firmaAnlage1Pruefsumme(d: FirmaDaten): string { return docHash(firmaAnlage1HashEingabe(d)); }
export function firmaRumpf(d: FirmaDaten, annahme: FirmaAnnahmeVermerk | null = null): string {
  return firmaRumpfHtml(d, firmaAnlage1Pruefsumme(d), annahme);
}
/** Die Prüfsumme über Präambel, Ziffern, Annahmeblock (ohne Vermerk), Anlage 1 und Anlage 2. */
export function firmaTextHash(d: FirmaDaten): string { return docHash(firmaHashEingabe(d, firmaRumpf(d, null))); }
/**
 * Nachprüfung 08.10.2026 (N4): Prüfsumme der Bürgin-Angaben — auch der Felder, die nicht im Vertragstext stehen (Haken
 * „bestätigt“ und seine Grundlage mit dem Status „Active“). Die Freigabe des Anwalts merkt sie sich; ändert die Leitung danach
 * etwas an der Bürgin, sperrt firmaVersandSperre den Versand, bis der Inhaber die Freigabe neu einträgt. Ändert keine
 * Prüfsumme des Vertrags.
 */
export function firmaBuerginPruefsumme(b: AngebotBuergin): string {
  const s = (v: unknown) => String(v ?? "").trim();
  const felder = [s(b.name), s(b.bundesstaat), s(b.anschrift), s(b.registerstelle), s(b.registernummer), s(b.vertreter), s(b.funktion), s(b.unterzeichnetAm), b.bestaetigt === true ? "1" : "0", s(b.bestaetigtGrundlage)];
  return createHash("sha256").update(`fiaon-firma-buergin.v1\n${JSON.stringify(felder)}`).digest("hex");
}
const BILDSCHIRM_CSS = `${GLOBAL_VERTRAG_CSS}${ANGEBOT_VERTRAG_CSS}${COMPLIANCE_CSS}`;
/** Für den Bildschirm: Titel, Unterzeile, Rumpf — exakt der Text, der ins PDF geht. */
export function firmaVorschauHtml(d: FirmaDaten): string {
  return `<style>${BILDSCHIRM_CSS}</style>
<div class="gv" lang="de"><h1 class="gv-titel">${escape(firmaVertragTitel())}</h1><p class="gv-unterzeile">${escape(firmaVertragUnterzeile(d))}</p></div>
${firmaRumpf(d, null)}`;
}
function escape(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
const PDF_CSS = `
  body { font-weight: 400; color: #0f2044; }
  .wordmark { font-weight: 300; letter-spacing: .18em; color: #0f2044; font-size: 17pt; }
  header.doc { border-bottom: 1px solid #0f2044; }
  h1.doc-title { font-weight: 300; font-size: 15pt; line-height: 1.25; color: #0f2044; letter-spacing: -.01em; }
  .doc-subtitle { color: #64748b; text-align: left; }
  footer.doc { display: none; }
  ${BILDSCHIRM_CSS}
`;
const MARKENZEILE = () => "FIAON LTD · Company No. 17318250 · 128 City Road, London, EC1V 2NX, United Kingdom";
const RAND = { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" };
export async function firmaVertragPdf(d: FirmaDaten, annahme: FirmaAnnahmeVermerk | null): Promise<Buffer> {
  const titel = firmaVertragTitel();
  const html = wrapFiaonDocument({
    documentTitle: titel, subtitle: firmaVertragUnterzeile(d), bodyHtml: firmaRumpf(d, annahme),
    watermark: annahme ? null : "Angebot — nicht angenommen", markenzeile: MARKENZEILE(), zusatzCss: PDF_CSS,
  });
  // Der Entwurf nennt die Prüfsumme in der Fußzeile (außerhalb des geprüften Rumpfs): Die Freigabe des Anwalts gilt nur für
  // diese Fassung — so lässt sie sich im Chefbüro mit dem PDF abgleichen, das er geprüft hat.
  return htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · Company No. 17318250 · Fassung ${d.fassung} · Angebot ${d.ref}${annahme ? "" : ` · Entwurf · Prüfsumme ${firmaTextHash(d).slice(0, 12)}`}`, rand: RAND, keinNotbehelf: !!annahme });
}
export async function firmaAnlage1Pdf(d: FirmaDaten): Promise<Buffer> {
  const titel = `Bürgschaftszusage der ${d.buergin.name}`;
  const html = wrapFiaonDocument({
    documentTitle: titel, subtitle: `Anlage 1 zum Angebot ${d.ref} · Fassung ${ANLAGE1_FIRMA_FASSUNG} · ${d.kunde.firma.name}`,
    bodyHtml: `<div class="gv" lang="de">${firmaAnlage1Html(d, firmaAnlage1Pruefsumme(d))}
    <p class="gv-leise">Das unterschriebene Original geht per Post an die Auftraggeberin, ein Scan in die Akte. Die Prüfsumme weist nach, dass das Original genau diese Fassung der Anlage 1 trägt.</p></div>`,
    // Allein gedruckt beginnt die Anlage direkt unter dem Kopf (im Vertrag beginnt sie auf neuer Seite) — sonst bleibt Seite 1 leer.
    markenzeile: MARKENZEILE(), zusatzCss: `${PDF_CSS} .gv .gv-anlage { break-before: auto; page-break-before: auto; margin-top: 0; padding-top: 0; border-top: 0; }`,
  });
  return htmlZuPdfMitFusszeile({ html, titel, fusszeile: `${d.buergin.name} · Anlage 1 zum Angebot ${d.ref} · Fassung ${ANLAGE1_FIRMA_FASSUNG}`, rand: RAND });
}
export async function firmaPruefberichtPdf(d: FirmaDaten): Promise<Buffer | null> {
  if (!d.compliance) return null;
  const titel = "Prüfbericht — Anlage 2";
  const html = wrapFiaonDocument({
    documentTitle: titel, subtitle: `Anlage 2 zum Angebot ${d.ref} · ${d.kunde.firma.name}`,
    bodyHtml: complianceHtml(d.compliance, { ref: d.ref }), markenzeile: MARKENZEILE(), zusatzCss: PDF_CSS,
  });
  return htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · Prüfbericht · Angebot ${d.ref}`, rand: RAND });
}
/** PDFs für Kunde (über den Link) und Leitung. Nach der Annahme ist der Vertrag die Ausfertigung aus der Akte. */
export async function firmaPdfErzeugen(z: AngebotZeile, art: "vertrag" | "pruefbericht" | "anlage1"): Promise<{ status: number; pdf?: Buffer; dateiname?: string; error?: string }> {
  const d = firmaDatenAus(z);
  if (art === "pruefbericht") {
    const pdf = await firmaPruefberichtPdf(d);
    return pdf ? { status: 200, pdf, dateiname: `FIAON_Pruefbericht_${d.ref}.pdf` } : { status: 404, error: "Zu diesem Angebot liegt noch kein Prüfbericht vor." };
  }
  if (art === "anlage1") return { status: 200, pdf: await firmaAnlage1Pdf(d), dateiname: `FIAON_Anlage1_Buergschaftszusage_${d.ref}.pdf` };
  if (String(z.status) === "angenommen") {
    const [r] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${z.id} LIMIT 1`) as any[];
    if (r?.vertrag_pdf) return { status: 200, pdf: Buffer.from(r.vertrag_pdf), dateiname: `FIAON_Global_Firmenvereinbarung_${d.ref}.pdf` };
  }
  return { status: 200, pdf: await firmaVertragPdf(d, null), dateiname: `FIAON_Global_Firmenangebot_${d.ref}_Entwurf.pdf` };
}

// ═══════════════════════════════════════════════════════════════════════════
// BILDER — in der Datenbank am Angebot, ausgeliefert NUR hinter dem Link (Gegenprüfung 07.10.2026)
// Die Bilder zeigen Marke und Produkte der Kundin. Sie liegen nie im Repo und nie unter einer öffentlichen Adresse:
// Das Import-Skript (--bilder) bereinigt sie (fiaon-bild-bereinigen.ts: Typ am Inhalt, ohne EXIF/XMP) und legt sie hier ab;
// GET /api/fiaon/global/angebot/:token/bild/:name prüft den Link genau wie Seite und PDFs. Keine Auflistung, kein Löschen.
// ═══════════════════════════════════════════════════════════════════════════
export interface FirmaBildDatei { name: string; daten: Buffer; typ: "image/webp" | "image/png" | "image/jpeg" }
/** Bilder eines offenen Firmenangebots einspielen (wiederholbar: gleicher Name → neuer Inhalt). */
export async function firmaBilderSpeichern(id: number, bilder: FirmaBildDatei[], wer: string): Promise<Ergebnis<{ gespeichert: number; namen: string[] }>> {
  await ensureAngebotTabellen();
  const z = await angebotLesen({ id });
  if (!z || !istFirmenAngebot(z)) return nein("Kein Firmenangebot.", 404);
  if (String(z.status) !== "offen") return nein(`Das Angebot ist ${String(z.status)} — Bilder nur, solange es offen ist.`, 409);
  for (const b of bilder) if (!FIRMA_BILD_NAME.test(b.name)) return nein(`Bildname „${b.name}“ ungültig (klein, Ziffern, Bindestriche, .webp/.png/.jpg).`);
  for (const b of bilder) {
    const sha = createHash("sha256").update(b.daten).digest("hex");
    await sqlPool`
      INSERT INTO fiaon_global_angebot_bilder (angebot_id, name, mime, daten, groesse, sha256, eingespielt_von)
      VALUES (${id}, ${b.name}, ${b.typ}, ${b.daten}, ${b.daten.length}, ${sha}, ${wer})
      ON CONFLICT (angebot_id, name) DO UPDATE
        SET mime = EXCLUDED.mime, daten = EXCLUDED.daten, groesse = EXCLUDED.groesse, sha256 = EXCLUDED.sha256,
            eingespielt_von = EXCLUDED.eingespielt_von, updated_at = NOW()
        WHERE fiaon_global_angebot_bilder.sha256 IS DISTINCT FROM EXCLUDED.sha256`;
  }
  const namen = bilder.map((b) => b.name).sort();
  if (namen.length) await verlaufAngebot(id, wer, `Bilder eingespielt (${namen.length}): ${namen.join(", ")}`);
  return { ok: true, gespeichert: namen.length, namen };
}
/** Welche Bilder liegen am Angebot? (Namen — für Import-Skript und Prüfstand) */
export async function firmaBilderNamen(id: number): Promise<string[]> {
  const zeilen = (await sqlPool`SELECT name FROM fiaon_global_angebot_bilder WHERE angebot_id = ${id} ORDER BY name`.catch(() => [])) as any[];
  return zeilen.map((r) => String(r.name));
}
/**
 * Ein Bild über den Link — dieselbe Prüfung wie angebotPdfFuerToken (ungültig 403, abgelaufen/zurückgezogen 410,
 * kein Angebot 404) und nur beim Firmenangebot. Unbekannter oder ungültiger Name: 404 (keine Auflistung).
 */
export async function firmaBildFuerToken(token: string, name: string): Promise<{ status: number; daten?: Buffer; typ?: string; sha256?: string; error?: string }> {
  const t = angebotTokenPruefen(token);
  if (!t) return { status: 403, error: "Dieser Link ist ungültig." };
  if (t.urteil === "abgelaufen") return { status: 410, error: "Dieser Link ist abgelaufen." };
  if (!FIRMA_BILD_NAME.test(String(name))) return { status: 404, error: "Dieses Bild gibt es nicht." };
  const z = await angebotLesen({ ref: t.ref });
  if (!z) return { status: 404, error: "Kein Angebot zu diesem Link." };
  if (angebotLinkAbgelaufen(z)) return { status: 410, error: "Dieser Link ist abgelaufen." };
  if (angebotStatusAus(z) === "zurueckgezogen") return { status: 410, error: "Dieses Angebot gilt nicht mehr." };
  if (!istFirmenAngebot(z)) return { status: 404, error: "Dieses Bild gibt es nicht." };
  const [b] = (await sqlPool`SELECT mime, daten, sha256 FROM fiaon_global_angebot_bilder WHERE angebot_id = ${Number(z.id)} AND name = ${String(name)} LIMIT 1`.catch(() => [])) as any[];
  if (!b || !["image/webp", "image/png", "image/jpeg"].includes(String(b.mime))) return { status: 404, error: "Dieses Bild gibt es nicht." };
  return { status: 200, daten: Buffer.from(b.daten), typ: String(b.mime), sha256: String(b.sha256) };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLEGEN UND ÄNDERN (nur Skript bzw. Pflichtfelder der Bürgin aus dem Chefbüro)
// ═══════════════════════════════════════════════════════════════════════════
const LAENDER: FirmaLand[] = ["DE", "AT", "CH"];
export function firmaKundePruefen(k: any): { ok: true; kunde: FirmaKunde } | { ok: false; error: string } {
  const f = k?.firma ?? {}; const v = k?.vertretung ?? {};
  const land = String(f.land ?? "").toUpperCase() as FirmaLand;
  if (!LAENDER.includes(land)) return { ok: false, error: "Firma: Land Deutschland, Österreich oder Schweiz." };
  const uid = ustIdNormalisieren(f.uid);
  const kunde: FirmaKunde = {
    art: "firma",
    firma: {
      name: text(f.name, 200), marke: text(f.marke || f.name, 120), rechtsform: text(f.rechtsform, 80), registergericht: text(f.registergericht, 120),
      registernummer: text(f.registernummer, 60), uid: uid ?? "", strasse: text(f.strasse, 160), plz: text(f.plz, 10), ort: text(f.ort, 120), land,
    },
    vertretung: { anrede: ["Herr", "Frau"].includes(String(v.anrede)) ? (String(v.anrede) as "Herr" | "Frau") : "", vorname: text(v.vorname, 80), nachname: text(v.nachname, 80), funktion: text(v.funktion, 120) },
    email: text(k?.email, 160).toLowerCase(),
    telefon: text(k?.telefon, 40),
  };
  if (kunde.firma.name.length < 2) return { ok: false, error: "Firma: Firmenwortlaut fehlt." };
  if (!uid) return { ok: false, error: "Firma: UID/USt-IdNr. ungültig (z. B. ATU12345678, DE123456789)." };
  if (!kunde.firma.registernummer || !kunde.firma.registergericht) return { ok: false, error: "Firma: Registergericht und Registernummer fehlen." };
  if (kunde.firma.strasse.length < 3 || !kunde.firma.ort) return { ok: false, error: "Firma: Anschrift unvollständig." };
  if (!(land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(kunde.firma.plz)) return { ok: false, error: "Firma: Postleitzahl passt nicht zum Land." };
  if (!kunde.vertretung.vorname || !kunde.vertretung.nachname || !kunde.vertretung.funktion) return { ok: false, error: "Vertretung: Vorname, Nachname und Funktion fehlen." };
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(kunde.email)) return { ok: false, error: "E-Mail-Adresse ungültig." };
  if (kunde.telefon) {
    const t = dachNummer(kunde.telefon, land);
    if (!t) return { ok: false, error: "Telefonnummer: bitte eine Nummer aus Deutschland, Österreich oder der Schweiz." };
    kunde.telefon = t;
  }
  return { ok: true, kunde };
}
/**
 * Die Kundenzeile in der Datenbank trägt zusätzlich anrede/vorname/nachname der Vertretung oben — so lesen die Bausteine,
 * die das Individualangebot schon kennt (Startgespräch E-273, Aufgabentitel), auch das Firmenangebot richtig.
 */
function kundeFuerDb(k: FirmaKunde): Record<string, unknown> {
  return { ...k, anrede: k.vertretung.anrede, vorname: k.vertretung.vorname, nachname: k.vertretung.nachname };
}
function buerginAus(roh: any, basis: AngebotBuergin = BUERGIN_VORGABE): AngebotBuergin {
  const feld = (key: keyof AngebotBuergin, max: number): string | null => {
    if (!roh || !(key in roh)) return (basis[key] as string | null) ?? null;
    const w = text(roh[key], max); return w || null;
  };
  const datum = feld("unterzeichnetAm", 10);
  return {
    name: BUERGIN_VORGABE.name, bundesstaat: feld("bundesstaat", 60), anschrift: feld("anschrift", 200), registerstelle: feld("registerstelle", 160),
    registernummer: feld("registernummer", 40), vertreter: feld("vertreter", 120), funktion: feld("funktion", 80),
    unterzeichnetAm: datum && ISO.test(datum) ? datum : null,
    bestaetigt: roh && "bestaetigt" in roh ? roh.bestaetigt === true : basis.bestaetigt,
    bestaetigtGrundlage: feld("bestaetigtGrundlage", 200),
  };
}
export async function firmaAnlegen(ein: any, wer: string): Promise<Ergebnis<{ id: number; ref: string; link: string }>> {
  await ensureAngebotTabellen();
  const fassung = String(ein?.fassung || FIRMA_FASSUNG);
  if (!(FIRMA_FASSUNGEN as readonly string[]).includes(fassung)) return nein("Diese Fassung des Firmenangebots gibt es nicht.");
  const k = firmaKundePruefen(ein?.kunde);
  if (!k.ok) return nein(k.error);
  const parameter = firmaParameterAus(ein?.parameter);
  const pf = firmaParameterFehler(parameter);
  if (pf) return nein(pf);
  const buergin = buerginAus(ein?.buergin);
  const compliance = ein?.compliance ? complianceKundenfassung(ein.compliance) : null;
  const heute = berlinToday();
  const gueltigBis = ISO.test(String(ein?.gueltigBis ?? "")) ? String(ein.gueltigBis) : plusTageIso(heute, FIRMA_GUELTIG_TAGE);
  if (gueltigBis < heute) return nein("Das Datum „gültig bis“ liegt in der Vergangenheit.");
  const personId = Number(ein?.personId);
  const ref = `FIAON-IA-F${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, pruefbericht, status, gueltig_bis, erstellt_von, verlauf, freigaben)
    VALUES (${ref}, ${Number.isInteger(personId) && personId > 0 ? personId : null}, ${fassung}, ${jsonb(kundeFuerDb(k.kunde))}, ${jsonb(parameter)}, ${jsonb(buergin)},
            ${compliance ? jsonb(compliance) : null}, 'offen', ${gueltigBis}::date, ${wer},
            ${jsonb([{ am: new Date().toISOString(), wer, was: "Firmenangebot angelegt" }])}, ${jsonb({})})
    RETURNING id`) as any[];
  const id = Number(neu.id);
  await sqlPool`
    INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage)
    VALUES (${id}, 1, ${FIRMA_TEIL_TITEL.gruendung}, ${parameter.startCents}, 'sofort', 0)
    ON CONFLICT (angebot_id, nr) DO NOTHING`;
  return { ok: true, id, ref, link: absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(ref, gueltigBis))) };
}
/** Ändern, solange niemand angenommen hat: Bürgin (Chefbüro), Gültigkeit, Parameter und Prüfbericht (Skript). */
export async function firmaAendern(id: number, ein: any, wer: string): Promise<Ergebnis<{ fehlt: string[] }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (String(z.status) !== "offen") return nein(`Das Angebot ist ${String(z.status)} — ändern geht nur, solange es offen ist.`, 409);
  const alt = firmaDatenAus(z);
  const altHash = firmaTextHash(alt);
  const neu: FirmaDaten = { ...alt };
  const geaendert: string[] = [];
  if (ein?.buergin) { neu.buergin = buerginAus(ein.buergin, alt.buergin); geaendert.push("Bürgin"); }
  if (ein?.parameter) { const par = firmaParameterAus(ein.parameter, alt.parameter); const f = firmaParameterFehler(par); if (f) return nein(f); neu.parameter = par; geaendert.push("Parameter"); }
  if (ein?.compliance) { neu.compliance = complianceKundenfassung(ein.compliance); geaendert.push("Prüfbericht"); }
  if (ein?.kunde) { const k = firmaKundePruefen(ein.kunde); if (!k.ok) return nein(k.error); neu.kunde = k.kunde; geaendert.push("Firma"); }
  if (ein?.gueltigBis !== undefined) { const g = String(ein.gueltigBis); if (!ISO.test(g) || g < berlinToday()) return nein("„Gültig bis“: ein Datum ab heute."); neu.gueltigBis = g; geaendert.push("Gültigkeit"); }
  if (!geaendert.length) return nein("Es wurde nichts geändert.");
  await sqlPool`
    UPDATE fiaon_global_angebote
       SET kunde = ${jsonb(kundeFuerDb(neu.kunde))}, parameter = ${jsonb(neu.parameter)}, buergin = ${jsonb(neu.buergin)},
           pruefbericht = ${neu.compliance ? jsonb(neu.compliance) : null}, gueltig_bis = ${neu.gueltigBis}::date, updated_at = NOW()
     WHERE id = ${id} AND status = 'offen'`;
  await sqlPool`UPDATE fiaon_global_angebot_teile SET betrag_cents = ${neu.parameter.startCents} WHERE angebot_id = ${id} AND nr = 1 AND bestell_ref IS NULL`;
  await verlaufAngebot(id, wer, `geändert: ${geaendert.join(", ")}`, { alterHash: altHash });
  return { ok: true, fehlt: firmaPflichtFehlen(neu) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENSEITE (offen) und die Antwort nach der Annahme
// ═══════════════════════════════════════════════════════════════════════════
export async function firmaKundenSicht(token: string, z: AngebotZeile, opts: { leitung?: boolean } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const d = firmaDatenAus(z);
  const fehlt = firmaPflichtFehlen(d);
  const t = encodeURIComponent(token);
  const k = d.kunde;
  const body: FirmaKundenSicht = {
    ok: true, status: "offen", art: "firma", ref: d.ref, fassung: d.fassung, gueltigBis: d.gueltigBis,
    kunde: { firma: k.firma.name, marke: k.firma.marke || k.firma.name, anrede: k.vertretung.anrede, vorname: k.vertretung.vorname, nachname: k.vertretung.nachname, funktion: k.vertretung.funktion, email: k.email },
    kundeAnrede: firmaKundeAnrede(k),
    // Bilder nur hinter dem Link: Namen aus den Angebotsdaten → /api/fiaon/global/angebot/<token>/bild/<name>. Prüfsumme und
    // Vertrag rechnen weiter mit d (die Bilder stehen nicht im Vertrag).
    seite: firmaSeite({ ...d, parameter: { ...d.parameter, inhalt: firmaInhaltMitBildLinks(d.parameter.inhalt, token) } }),
    compliance: d.compliance,
    ansprechpartner: firmaAnsprechpartner(d.parameter),
    uebersicht: firmaBestellUebersicht(d),
    annahme: firmaAnnahmeTexte(d),
    annahmeBereit: fehlt.length === 0 && !opts.leitung,
    gesperrtGrund: fehlt.length ? firmaAnnahmeTexte(d).gesperrt : null,
    ...(opts.leitung ? { vorschauLeitung: true, fehlt } : {}),
    html: firmaVorschauHtml(d),
    textHash: firmaTextHash(d),
    vertragPdf: `/api/fiaon/global/angebot/${t}/vertrag.pdf`,
    anlage1Pdf: `/api/fiaon/global/angebot/${t}/anlage1.pdf`,
    pruefberichtPdf: `/api/fiaon/global/angebot/${t}/pruefbericht.pdf`,
  };
  return { status: 200, body: body as unknown as Record<string, unknown> };
}
/** Dieselben Felder wie die Antwort des Individualangebots nach der Annahme (die angenommene Seite ist dieselbe). */
export async function firmaAngenommenAntwort(z: AngebotZeile): Promise<Record<string, unknown>> {
  const ref1 = z.auftrag_ref ? String(z.auftrag_ref) : null;
  const b = ref1 ? await globalBestellungLesen(ref1) : null;
  const d = firmaDatenAus(z);
  const sch = schalterAus(z);
  const meinAuftrag = ref1 ? globalMeinAuftragUrl(ref1) : null;
  const t = meinAuftrag ? new URL(meinAuftrag).searchParams.get("t") : null;
  const startgespraech = await import("./fiaon-global-angebot-startgespraech")
    .then(async (m) => m.startgespraechFuerKunde(await m.startgespraechStand(Number(z.id))))
    .catch((e) => { console.error(`[FIAON-FIRMA] ${z.angebot_ref}: Startgespräch für die Antwort:`, e); return null; });
  const betrag = firmaEur(d.parameter.startCents);
  return {
    startgespraech, art: "firma",
    ref: d.ref, auftragRef: ref1, email: d.kunde.email, sofortBeginn: !sch.startWahl, starttag: sch.starttag,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null,
    betragCents: d.parameter.startCents,
    zahlungsseite: b?.payment_reference ? `/zahlung/${b.payment_reference}?bereich=business` : null,
    meinAuftrag: ref1 && t ? `/business/auftrag/${encodeURIComponent(ref1)}?t=${encodeURIComponent(t)}` : null,
    vertragUrl: ref1 && t ? `/api/fiaon/global/auftrag/${encodeURIComponent(ref1)}/vertrag.pdf?t=${encodeURIComponent(t)}` : null,
    rechnungUrl: ref1 && t && b?.payment_reference ? `/api/fiaon/global/auftrag/${encodeURIComponent(ref1)}/rechnung.pdf?t=${encodeURIComponent(t)}` : null,
    fertigTitel: FIRMA_ANNAHME.fertigTitel,
    fertigText: garantieAbAnnahme(d.fassung) ? FIRMA_ANNAHME.fertigText(d.kunde.email, budgetSpaetestensGilt(d.fassung) ? monateWort(d.parameter.budgetSpaetestensMonate) : null) : sch.startWahl ? FIRMA_ANNAHME.fertigAb(d.kunde.email, firmaTag(sch.startWahl)) : FIRMA_ANNAHME.fertigSofort(d.kunde.email),
    teil1Bezahlt: String(b?.payment_status) === "paid",
    fertigZahlung: String(b?.payment_status) === "paid" ? FIRMA_ANNAHME.fertigBezahlt : b?.payment_reference ? FIRMA_ANNAHME.fertigFaellig(betrag) : FIRMA_ANNAHME.fertigRechnungFolgt(betrag),
    fertigFuss: FIRMA_ANNAHME.fertigFuss,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANNAHME (gerufen aus annehmen() im Individualangebot: Token, Status, Leitung und Honigtopf sind dort geprüft)
// ═══════════════════════════════════════════════════════════════════════════
export async function firmaAnnehmen(z: AngebotZeile, body: any, kontext: AnnahmeKontext, helfer: { zuViel: (ip: string) => boolean }): Promise<{ status: number; body: Record<string, unknown> }> {
  const fehler = (status: number, error: string, extra: Record<string, unknown> = {}) => ({ status, body: { ok: false, error, ...extra } });
  const d = firmaDatenAus(z);
  if (firmaPflichtFehlen(d).length) return fehler(409, firmaAnnahmeTexte(d).gesperrt, { code: "PFLICHTFELDER" });
  if (helfer.zuViel(kontext.ip)) return fehler(429, "Von Ihrem Anschluss kamen gerade mehrere Versuche. Bitte versuchen Sie es in einigen Minuten noch einmal.");
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(kontext.ip, kontext.userAgent).roboter) {
    return fehler(403, "Diese Annahme können wir nicht entgegennehmen. Bitte öffnen Sie die Seite in Ihrem Browser und nehmen Sie dort an.");
  }
  if (body?.unternehmer !== true || body?.vertretung !== true) {
    return fehler(400, FIRMA_ANNAHME.fehltHaken, { code: "HAEKCHEN", fehlt: [body?.unternehmer !== true ? "unternehmer" : null, body?.vertretung !== true ? "vertretung" : null].filter(Boolean) });
  }
  // Runde 2 (Punkt 11): die Unterschrift ist Pflicht — geprüft HIER, nicht nur in der Oberfläche (AGENTS.md „Eine Pflicht in der
  // Oberfläche ist keine Pflicht“). Seit Fassung C keine Startwahl mehr: Das Wachstumsbudget beginnt am Tag „Shop live“.
  const u = firmaUnterschriftPruefen(body?.unterschrift, d.kunde);
  if (!u.ok) return fehler(400, u.error, { code: u.code });
  const hash = firmaTextHash(d);
  if (String(body?.textHash ?? "") !== hash) return fehler(409, FIRMA_ANNAHME.neuLaden, { code: "GEAENDERT" });
  // Nachprüfung 08.10.2026 (N6): Ohne die CHECKs der Migration 096 lehnte die Datenbank die Monatsteile ab — die Annahme lief
  // halb durch. Jetzt vorher: CHECKs da (oder jetzt nachgeholt)? Sonst 503, und es wird NICHTS gespeichert.
  if (!(await firmaTeileCheckSichern())) {
    return fehler(503, "Ihre Annahme lässt sich gerade technisch nicht speichern. Bitte versuchen Sie es in einigen Minuten noch einmal — es wurde nichts gespeichert.", { code: "TECHNIK" });
  }

  const jetzt = new Date();
  const annahmeTag = berlinToday(jetzt);
  const unterschrift: FirmaUnterschriftVermerk = { ...u.vermerk, am: jetzt.toISOString(), ip: kontext.ip };
  let pdf: Buffer;
  try {
    pdf = await firmaVertragPdf(d, { am: jetzt, ip: kontext.ip, userAgent: kontext.userAgent, hash, starttag: null, unterschrift });
    if (!pdf || pdf.length < 1000) throw new Error("PDF leer");
  } catch (e) {
    console.error(`[FIAON-FIRMA] ${d.ref}: Vertrags-PDF:`, e);
    return fehler(500, "Ihr Vertrag konnte gerade nicht ausgefertigt werden — bitte versuchen Sie es in einer Minute noch einmal. Es wurde nichts gespeichert.");
  }
  // Das Startgespräch (E-273) kommt sofort (sofortBeginn). Kein Starttag bei der Annahme: den setzt die Leitung mit „Shop live“.
  // Die Unterschrift (Bild/Name, Zeit, IP) steht im Schalter des Angebots und im Annahmevermerk des PDF.
  const schalter = { sofortBeginn: true, jahresbetreuung: false, starttag: null, startWahl: null, unternehmer: true, vertretung: true, unterschrift };
  // Fassung C: Die Frist der Garantie läuft ab dem Tag der Annahme (Ziffer 7 Absatz 1 und 3).
  const abAnnahme = garantieAbAnnahme(d.fassung);
  const fristEnde = abAnnahme ? garantieFristEnde(annahmeTag, d.parameter.garantieMonate, 0) : null;
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote
       SET status = 'angenommen', angenommen_am = ${jetzt}, ip = ${kontext.ip}, user_agent = ${String(kontext.userAgent || "").slice(0, 500)},
           text_hash = ${hash}, schalter = ${jsonb(schalter)}, vertrag_pdf = ${pdf}, fassung = ${d.fassung},
           frist_beginn = ${abAnnahme ? annahmeTag : null}::date, frist_ende = ${fristEnde}::date, updated_at = NOW()
     WHERE id = ${z.id} AND status = 'offen' AND gueltig_bis >= ${berlinToday()}::date AND updated_at::text = ${String(z.updated_at_txt)}
     RETURNING id`) as any[];
  if (!frei) {
    const neu = await angebotLesen({ id: Number(z.id) });
    if (neu && String(neu.status) === "angenommen") return { status: 200, body: { ok: true, schon: true, ...(await firmaAngenommenAntwort(neu)) } };
    if (neu && String(neu.status) === "offen") return fehler(409, FIRMA_ANNAHME.neuLaden, { code: "GEAENDERT" });
    return fehler(409, "Das Angebot lässt sich gerade nicht annehmen. Bitte laden Sie die Seite neu.");
  }
  await verlaufAngebot(Number(z.id), `${firmaVertreterName(d.kunde)} (${d.kunde.firma.name})`, `angenommen (${FIRMA_KNOPF}) — Prüfsumme ${hash.slice(0, 12)}…, Unterschrift ${unterschrift.art === "gezeichnet" ? "gezeichnet" : `getippt („${unterschrift.name}“)`}, Unternehmergeschäft und Vertretung bestätigt${fristEnde ? `; Garantiefrist der ersten Runde ab heute bis ${firmaTag(fristEnde)}` : ""}`);
  void import("./fiaon-global-angebot-aufrufe").then((m) => m.aufrufeAnnahmeVermerken(Number(z.id)))
    .catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Annahme in der Aufruf-Aufgabe:`, e));
  const fertig = await firmaFertigstellen(Number(z.id));
  if (!fertig.ok) {
    return { status: 202, body: { ok: true, teilweise: true, hinweis: "Ihre Annahme ist gespeichert. Die Rechnung wird gerade erstellt.", ...(await firmaAngenommenAntwort((await angebotLesen({ id: Number(z.id) }))!)) } };
  }
  await Promise.race([
    import("./fiaon-global-angebot-startgespraech").then((m) => m.angebotStartgespraechBuchen(Number(z.id), { anlass: "annahme" })),
    new Promise((ok) => setTimeout(ok, 8_000)),
  ]).catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Startgespräch bei der Annahme — die Nacharbeit holt es nach:`, e));
  void firmaNacharbeit(Number(z.id)).catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Nacharbeit abgebrochen:`, e));
  return { status: 200, body: { ok: true, ...(await firmaAngenommenAntwort((await angebotLesen({ id: Number(z.id) }))!)) } };
}

/** Bestellzeile anlegen — derselbe Weg wie /business/start (Loopback auf POST /api/fiaon/application), mit Firma und UID. */
async function firmaBestellzeileAnlegen(ref: string, d: FirmaDaten, titel: string, kontext: { ip: string; userAgent: string }): Promise<boolean> {
  const k = d.kunde; const f = k.firma;
  const port = process.env.PORT || 5000;
  const antwort = await fetch(`http://127.0.0.1:${port}/api/fiaon/application`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": kontext.ip || "", "user-agent": kontext.userAgent || "fiaon-global-firmenangebot" },
    body: JSON.stringify({
      ref, type: "business", status: "submitted", currentStep: 6,
      packKey: ANGEBOT_PAKET_KEY, packName: firmaTeilPaketname(titel),
      companyName: f.name, legalForm: f.rechtsform, taxId: f.uid,
      firstName: k.vertretung.vorname, lastName: k.vertretung.nachname,
      contactFirstName: k.vertretung.vorname, contactLastName: k.vertretung.nachname,
      contactEmail: k.email, email: k.email, billingEmail: k.email, contactPhone: k.telefon || null,
      street: f.strasse, zip: f.plz, city: f.ort, country: f.land,
      // Der Vertrag schließt die AGB aus (Ziffer 20) — keine AGB-Zustimmung, keine Bonitätsabfrage; der Vertrag ist angenommen.
      ag1: false, ag2: false, ag3: true,
      webMessungAus: true, messungAus: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!antwort.ok) {
    console.error(`[FIAON-FIRMA] ${ref}: application ${antwort.status}:`, (await antwort.text().catch(() => "")).slice(0, 200));
    return false;
  }
  // Der Firmenwortlaut steht auf der Rechnung GENAU wie im Register (die Bestellroute glättet Namen) — dazu UID und Rechtsform.
  // Reverse Charge gleich hier, VOR der Rechnungsnummer (bestellungFuerAntrag): Die Rechnung ist ab der Nummer richtig,
  // auch wenn danach etwas scheitert (Gegenprüfung 07.10.2026).
  await sqlPool`UPDATE fiaon_applications SET company_name = ${f.name}, tax_id = ${f.uid}, legal_form = ${f.rechtsform},
                       rechnung_ust_modus = ${f.uid ? "reverse_charge" : "none"} WHERE ref = ${ref}`;
  return true;
}
/** Reverse Charge an der Bestellung — nur mit UID (b2bUstModus in fiaon-invoice.ts verlangt sie ebenfalls). Vor UND nach der Nummer gerufen (wiederholbar). */
async function reverseChargeSetzen(ref: string, d: FirmaDaten): Promise<void> {
  await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = ${d.kunde.firma.uid ? "reverse_charge" : "none"}, tax_id = ${d.kunde.firma.uid || null} WHERE ref = ${ref}`;
}

/** Die Monatsteile bis einschließlich Monat `bis` anlegen (wiederholbar; nr = laufende Nummer nach den vorhandenen Teilen). */
async function monatsteileBis(id: number, d: FirmaDaten, starttag: string, bis: number): Promise<number> {
  return nummernSperre(id, () => monatsteileBisOhneSperre(id, d, starttag, bis));
}
async function monatsteileBisOhneSperre(id: number, d: FirmaDaten, starttag: string, bis: number): Promise<number> {
  const teile = (await sqlPool`SELECT nr, titel, faelligkeit FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} ORDER BY nr`) as any[];
  const monate = teile.filter((t) => String(t.faelligkeit) === "monatlich").length;
  let naechsteNr = teile.reduce((m, t) => Math.max(m, Number(t.nr)), 1) + 1;
  let neu = 0;
  for (let k = monate + 1; k <= bis; k++) {
    // Die nächste freie Nummer: bei der Annahme (nur Teil 1 da) sind das genau 2 … Mindestlaufzeit + 1 (Bauauftrag).
    const nr = naechsteNr;
    const zr = monatZeitraum(starttag, k);
    const r = (await sqlPool`
      INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage, faellig_am, zeitraum)
      VALUES (${id}, ${nr}, ${FIRMA_TEIL_TITEL.monat(k)}, ${d.parameter.monatCents}, 'monatlich', ${d.parameter.zahlungszielTage}, ${monatFaelligAm(starttag, k)}::date, ${zr.text})
      ON CONFLICT (angebot_id, nr) DO NOTHING RETURNING id`) as any[];
    if (r.length) neu++;
    naechsteNr = nr + 1;
  }
  return neu;
}

/**
 * Alles nach der Annahme, was eine Antwort braucht — WIEDERHOLBAR: Bestellzeile „Gründung“ (Firma, UID), Teil binden,
 * Akte, Bestellung mit Rechnungsnummer, Reverse Charge, Person am Angebot, Monatsteile. Jeder Schritt prüft, ob er getan ist.
 */
export async function firmaFertigstellen(id: number): Promise<{ ok: boolean; grund?: string }> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen") return { ok: false, grund: "nicht angenommen" };
  const d = firmaDatenAus(z);
  const sch = schalterAus(z);
  const teil1 = (z.teile as any[]).find((x) => Number(x.nr) === 1);
  if (!teil1) return { ok: false, grund: "Teil 1 (Gründung) fehlt" };
  try {
    let ref1 = teil1.bestell_ref ? String(teil1.bestell_ref) : (z.auftrag_ref ? String(z.auftrag_ref) : null);
    if (!ref1) {
      ref1 = neueRef();
      await sqlPool`UPDATE fiaon_global_angebote SET auftrag_ref = ${ref1}, updated_at = NOW() WHERE id = ${id} AND auftrag_ref IS NULL`;
      const [w] = (await sqlPool`SELECT auftrag_ref FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
      ref1 = String(w.auftrag_ref);
    }
    const [da] = (await sqlPool`SELECT ref FROM fiaon_applications WHERE ref = ${ref1} LIMIT 1`) as any[];
    if (!da) {
      const ok = await firmaBestellzeileAnlegen(ref1, d, FIRMA_TEIL_TITEL.gruendung, { ip: String(z.ip || ""), userAgent: String(z.user_agent || "") });
      if (!ok) throw new Error("Bestellzeile Gründung ließ sich nicht anlegen");
    }
    await sqlPool`UPDATE fiaon_global_angebot_teile SET bestell_ref = ${ref1} WHERE angebot_id = ${id} AND nr = 1 AND bestell_ref IS NULL`;

    // ── Die Akte — „Mein Auftrag“, Office, Zahlungstakt (Unternehmen: firma ohne art „privat“). bestaetigungen.firmenangebot
    //    = true: Der Zahlungstakt schickt dieser Akte KEINE Erinnerungsmail, nur die Aufgabe „anrufen“ am zehnten Tag (E-301). ──
    if (!(await globalAkteLesen(ref1))) {
      const [pdfZeile] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
      const f = d.kunde.firma;
      const firma = { land: f.land, name: f.name, rechtsform: f.rechtsform, registergericht: f.registergericht, registernummer: f.registernummer, strasse: f.strasse, plz: f.plz, ort: f.ort, ustId: f.uid, website: null, quelleRegister: null };
      const ansprechpartner = { anrede: d.kunde.vertretung.anrede, vorname: d.kunde.vertretung.vorname, nachname: d.kunde.vertretung.nachname, funktion: d.kunde.vertretung.funktion, email: d.kunde.email, telefon: d.kunde.telefon };
      const bestaetigungen = { annahme: FIRMA_KNOPF, unternehmer: true, vertretung: true, am: new Date(z.angenommen_am).toISOString(), starttag: sch.starttag, firmenangebot: true,
        ...(sch.unterschrift ? { unterschrift: { art: sch.unterschrift.art, name: sch.unterschrift.name ?? null, am: sch.unterschrift.am ?? null } } : {}) };
      const pngM = String(sch.unterschrift?.png ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
      const unterschriftPng = pngM ? Buffer.from(pngM[1], "base64") : null;
      await sqlPool`
        INSERT INTO fiaon_global_auftraege
          (ref, paket_key, land, firma, ansprechpartner, ust_id, bestaetigungen, unterschrift_png, vertrag_pdf, vertrag_version, vertrag_sprache,
           unterschrieben_am, ip, user_agent, quelle, status, doc_hash, firma_name, email, rechnung_ust_modus, ust_hinweis,
           jahresbetreuung, jahresbetreuung_preis_cents, angebot_id)
        VALUES
          (${ref1}, ${ANGEBOT_PAKET_KEY}, ${f.land}, ${JSON.stringify(firma)}::jsonb, ${JSON.stringify(ansprechpartner)}::jsonb, ${f.uid || null},
           ${JSON.stringify(bestaetigungen)}::jsonb, ${unterschriftPng}, ${pdfZeile?.vertrag_pdf ?? null}, ${d.fassung}, 'de',
           ${new Date(z.angenommen_am)}, ${z.ip}, ${z.user_agent}, 'individualangebot', 'offen', ${z.text_hash}, ${f.name}, ${d.kunde.email},
           ${f.uid ? "reverse_charge" : "none"}, ${f.uid ? null : "Keine UID am Firmenangebot — Rechnung ohne Reverse Charge, bitte klären."},
           FALSE, ${null}, ${id})
        ON CONFLICT (ref) DO NOTHING`;
    }
    // ── Die Bestellung: Betrag aus dem Teil (Wand 087), Zahlungsziel sofort, Rechnungsnummer aus dem einen Kreis ──
    //    Reverse Charge VOR der Nummer — auch wenn die Bestellzeile aus einem früheren Versuch schon steht.
    await reverseChargeSetzen(ref1, d);
    const b = await globalBestellungLesen(ref1);
    if (!b?.payment_reference || !["pending_payment", "claimed_paid", "paid"].includes(String(b.payment_status))) {
      const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
      const erg = await bestellungFuerAntrag(ref1, { globalMailFolgt: true });
      if (erg.status !== 200) throw new Error(`Bestellung: ${erg.status} ${JSON.stringify(erg.body).slice(0, 160)}`);
    }
    await reverseChargeSetzen(ref1, d);
    await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = COALESCE(rechnung_am, NOW()) WHERE angebot_id = ${id} AND nr = 1`;
    // ── Die Person am Angebot (E-272): Global-Kunde-Regel nimmt sie aus allen Privat-Abläufen ──
    let [person] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref1}`) as any[];
    if (!person?.person_id) {
      const { bindePersonAnAntrag } = await import("../fiaon-person-model");
      await bindePersonAnAntrag(ref1).catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Person an der Bestellzeile:`, e));
      [person] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref1}`) as any[];
    }
    if (person?.person_id) await sqlPool`UPDATE fiaon_global_angebote SET person_id = COALESCE(person_id, ${Number(person.person_id)}) WHERE id = ${id}`;
    // ── Monatsteile für die Mindestlaufzeit ──
    if (sch.starttag) await monatsteileBis(id, d, sch.starttag, d.parameter.mindestMonate);
    await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = NULL, updated_at = NOW() WHERE id = ${id} AND nacharbeit_fehler IS NOT NULL`;
    return { ok: true };
  } catch (e) {
    const grund = e instanceof Error ? e.message : String(e);
    console.error(`[FIAON-FIRMA] ${z.angebot_ref}: Fertigstellen:`, e);
    await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = ${grund.slice(0, 500)}, updated_at = NOW() WHERE id = ${id}`.catch(() => {});
    try {
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: z.person_id != null ? Number(z.person_id) : null, ref: z.auftrag_ref ? String(z.auftrag_ref) : null,
        titel: `Firmenangebot ${z.angebot_ref}: Annahme gespeichert, Bestellung/Rechnung hängt — ${d.kunde.firma.name}`,
        text: `Die Annahme steht (Prüfsumme in der Akte), aber Bestellzeile, Akte oder Rechnung ließen sich nicht anlegen: ${grund.slice(0, 300)}. Nachholen: Reiter „Individualangebote“ → „Nachholen“ (der Stundenlauf versucht es ebenfalls).`,
        dringend: true, anBetreiber: true, schluessel: `global:${z.angebot_ref}:nacharbeit`, bereich: "technik", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
      });
    } catch (e2) { console.error(`[FIAON-FIRMA] ${z.angebot_ref}: Aufgabe „Nacharbeit hängt“:`, e2); }
    return { ok: false, grund };
  }
}

/** Hinter der Antwort: Startgespräch sicherstellen, Aufgaben an die zuständige Person und an Justin. KEINE Kundenmail. */
export async function firmaNacharbeit(id: number): Promise<void> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen" || !z.auftrag_ref) return;
  const ref1 = String(z.auftrag_ref);
  const d = firmaDatenAus(z); const sch = schalterAus(z);
  const b = await globalBestellungLesen(ref1);
  const akte = await globalAkteLesen(ref1);
  const name = `${d.kunde.firma.name} (${firmaVertreterName(d.kunde)})`;
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const SG = await import("./fiaon-global-angebot-startgespraech");
  await SG.angebotStartgespraechSicherstellen(id, { anlass: "nacharbeit" }).catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Startgespräch in der Nacharbeit:`, e));
  const sg = await SG.startgespraechStand(id).catch(() => null);
  const sgZeile = sg?.stand === "gebucht" && sg.termin ? `STARTGESPRÄCH: gebucht — ${sg.termin.tagText}, ${sg.termin.uhrzeit} Uhr mit ${sg.termin.mit}.` : "STARTGESPRÄCH: noch nicht gebucht — bitte im Reiter „Individualangebote“ nachsehen.";
  const einstellungen = await globalEinstellungen();
  const teilText = `Gründungskosten ${firmaEur(d.parameter.startCents)} (Rechnung ${b?.invoice_number ?? "—"}, Verwendungszweck ${b?.payment_reference ?? "—"}, sofort fällig, Reverse Charge) · Wachstumsbudget: Anteil ${firmaEur(d.parameter.monatCents)}/Monat (die Hälfte von ${firmaEur(d.parameter.budgetGesamtCents)}) ${sch.starttag ? `ab ${firmaTag(sch.starttag)}` : "ab dem Tag „Shop live“ — im Chefbüro eintragen, wenn der Shop live ist"} (Rechnungen automatisch am Fälligkeitstag)`;
  const fe = isoTag(z.frist_ende);
  try {
    if (!akte?.zustaendig_agent_id) {
      const erg = await auftragFuerKunden({
        personId: b?.person_id != null ? Number(b.person_id) : null, ref: ref1,
        titel: `FIAON Global: Firmenangebot angenommen — ${name}`,
        text: [
          `${name} hat das Firmenangebot ${d.ref} angenommen (${new Date(z.angenommen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}). Unternehmergeschäft, kein Widerruf.`,
          teilText,
          garantieAbAnnahme(d.fassung)
            ? `ERSTE RUNDE (Ziffer 7): ${firmaUsd(d.parameter.kapitalUsd)} innerhalb von ${zahlwort(d.parameter.garantieMonate)} Monaten AB DER ANNAHME — Frist bis ${firmaTag(fe)}, sonst Erstattung der Gründungskosten. Unterlagen der Bürgschaft (Ziffer 8 Absatz 4) sofort in Textform anfordern (mindestens sieben Tage Frist) — fehlen sie danach, ruht die Frist („Garantiefrist ruhen lassen“). Sind alle da: Leitung „Bedingungen erfüllt“.`
            : `ERSTE RUNDE (Ziffer 7): ${firmaUsd(d.parameter.kapitalUsd)} innerhalb von ${zahlwort(d.parameter.garantieMonate)} Monaten nach erfüllten Bedingungen der Bürgschaft — sonst Erstattung der Gründung. Bedingungen (Ziffer 8 Absatz 4) jetzt gemeinsam abarbeiten; sind alle erfüllt, der Leitung sagen („Bedingungen erfüllt“).`,
          sgZeile,
          `Vertrag und Rechnung bitte heute per Mail an ${d.kunde.email} schicken (für Firmenangebote gibt es noch keine automatische Mail). Vor Leistungsbeginn: Identifizierung der Vertretung und der wirtschaftlich Berechtigten, Sanktionslisten erneut abgleichen.`,
          `Office: ${globalOfficeAuftragPfad(ref1)} · Leitung: ${CHEF_LINK}`,
        ].join("\n"),
        schluessel: `global:${ref1}:auftrag`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
        link: globalOfficeAuftragPfad(ref1), agentId: einstellungen.zustaendigAgentId, anlageText: `Firmenangebot ${d.ref} angenommen.`,
      });
      if (erg.agentId) await sqlPool`UPDATE fiaon_global_auftraege SET zustaendig_agent_id = ${erg.agentId}, updated_at = NOW() WHERE ref = ${ref1} AND zustaendig_agent_id IS NULL`;
    }
  } catch (e) { console.error(`[FIAON-FIRMA] ${d.ref}: Aufgabe an die zuständige Person:`, e); }
  await auftragFuerKunden({
    personId: b?.person_id != null ? Number(b.person_id) : null, ref: ref1,
    titel: `Firmenangebot angenommen: ${name} — ${firmaEur(d.parameter.startCents)} erwartet`,
    text: [
      `${name} hat das Firmenangebot ${d.ref} angenommen. ${teilText}.`, sgZeile,
      "Zahlungseingang wie immer über den einen Weg buchen. Vertrag (Chefbüro, PDF mit Annahmevermerk) und Rechnung per Mail an die Kundin — es geht keine automatische Mail raus.",
      `Bürgschaftszusage (Anlage 1): das eigenhändig unterschriebene Original per Post an ${d.kunde.firma.strasse}, ${d.kunde.firma.plz} ${d.kunde.firma.ort} — Prüfsumme ${firmaAnlage1Pruefsumme(d).slice(0, 16)}….`,
    ].join("\n"),
    anBetreiber: true, schluessel: `global:${ref1}:angebot-justin`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
    anlageText: `Firmenangebot ${d.ref} angenommen.`,
  }).catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Aufgabe an Justin:`, e));
  await globalVerlauf(ref1, `FIAON Global: Firmenangebot ${d.ref} angenommen (${FIRMA_KNOPF}). Vertrag mit Prüfsumme in der Akte; Rechnung Gründung ${b?.invoice_number ?? ""} über ${firmaEur(d.parameter.startCents)}, sofort fällig, Reverse Charge. Starttag ${firmaTag(sch.starttag)}.`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNG (aus angebotNachZahlung — alle Buchungswege gehen durch onCustomerPaid)
// ═══════════════════════════════════════════════════════════════════════════
export async function firmaNachZahlung(ref: string, t: any, z: AngebotZeile): Promise<{ gestartet: boolean; grund?: string }> {
  const d = firmaDatenAus(z);
  const b = await globalBestellungLesen(ref);
  if (!b || String(b.payment_status) !== "paid") return { gestartet: false, grund: "nicht bezahlt" };
  const [erstmals] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET bezahlt_am = ${b.completed_at ?? new Date()} WHERE id = ${t.id} AND bezahlt_am IS NULL RETURNING id`) as any[];
  const ref1 = String(z.auftrag_ref || ref);
  if (String(t.faelligkeit) !== "sofort") {
    if (erstmals) {
      await verlaufAngebot(Number(z.id), "System", `${String(t.titel)} bezahlt (${firmaEur(Number(t.betrag_cents))}, ${b.payment_reference})`);
      await globalVerlauf(ref1, `FIAON Global: ${String(t.titel)} des Firmenangebots ${d.ref} bezahlt (${b.payment_reference}).`);
    }
    return { gestartet: false, grund: `${String(t.titel)} bezahlt — kein Start` };
  }
  // ── Gründung bezahlt: Auftrag startet (Unternehmen — keine Widerrufsfrist) ──
  await sqlPool`UPDATE fiaon_global_auftraege SET status = 'bezahlt', bezahlt_am = COALESCE(bezahlt_am, ${b.completed_at ?? new Date()}), updated_at = NOW() WHERE ref = ${ref1} AND status = 'offen'`;
  const akte = await globalAkteLesen(ref1);
  if (!akte) return { gestartet: false, grund: "Akte fehlt" };
  if (String(akte.status) === "gestartet") return { gestartet: false, grund: "schon gestartet" };
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const zustaendig = (akte.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null) ?? (await globalEinstellungen()).zustaendigAgentId;
  let agentId: number | null = null; let aufgabeId: number | null = null;
  try {
    const erg = await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref: ref1,
      titel: `FIAON Global: Firmenangebot starten — ${d.kunde.firma.name}`,
      text: [
        `Die Zahlung für die Gründung (${firmaEur(d.parameter.startCents)}) liegt vor — der Auftrag startet JETZT.`,
        "1. Startgespräch führen. 2. Identifizierung der Vertretung und der wirtschaftlich Berechtigten, Sanktionslisten erneut abgleichen. 3. Bundesstaat mit Partner-Steuerberater, Gründung, EIN, ITIN, Konto, Registered Agent, FDA-U.S.-Agent, Adresse und Telefon in Miami.",
        garantieAbAnnahme(d.fassung)
          ? "4. Unterlagen der Bürgschaft (Ziffer 8 Absatz 4) einsammeln — die Garantiefrist der ersten Runde läuft seit der Annahme; fehlen Unterlagen nach Aufforderung, „Garantiefrist ruhen lassen“. Sind alle da: Leitung „Bedingungen erfüllt“. 5. Ist der Shop live: Leitung „Shop live“ (startet das Wachstumsbudget). Kein Bankname gegenüber der Kundin."
          : "4. Bedingungen der Bürgschaft (Ziffer 8 Absatz 4) einsammeln — sind alle erfüllt: Leitung „Bedingungen erfüllt“ (damit beginnt die Garantiefrist der ersten Runde). Kein Bankname gegenüber der Kundin.",
      ].join("\n"),
      dringend: true, schluessel: `global:${ref1}:start`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: globalOfficeAuftragPfad(ref1), agentId: zustaendig, anlageText: "Zahlungseingang Gründung — Firmenangebot startet.",
    });
    aufgabeId = erg.id; agentId = erg.agentId;
  } catch (e) { console.error(`[FIAON-FIRMA] ${d.ref}: Aufgabe „Firmenangebot starten“:`, e); }
  if (!aufgabeId) return { gestartet: false, grund: "Aufgabe nicht angelegt" };
  await sqlPool`UPDATE fiaon_global_auftraege SET status = 'gestartet', gestartet_am = COALESCE(gestartet_am, NOW()), zustaendig_agent_id = COALESCE(${agentId}, zustaendig_agent_id), updated_at = NOW() WHERE ref = ${ref1} AND status IN ('offen', 'bezahlt')`;
  await import("./fiaon-global-bereich").then((m) => m.globalStartVermerken(ref1)).catch((e) => console.error(`[FIAON-FIRMA] ${ref1}: Etappe 1:`, e));
  await verlaufAngebot(Number(z.id), "System", "Gründung bezahlt — Auftrag gestartet");
  await globalVerlauf(ref1, `FIAON Global: Gründung des Firmenangebots ${d.ref} bezahlt, Auftrag gestartet.`);
  return { gestartet: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// RECHNUNG JE TEIL (Monat, Umsatz, Verkauf) — derselbe Weg wie Teil 2 im Individualangebot
// ═══════════════════════════════════════════════════════════════════════════
export async function firmaTeilBerechnen(id: number, teilId: number, wer: string): Promise<Ergebnis<{ ref: string; meldung: string }>> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen") return nein("Das Angebot ist nicht angenommen.", 409);
  const d = firmaDatenAus(z);
  const teil = (z.teile as any[]).find((x) => Number(x.id) === teilId);
  if (!teil) return nein("Diesen Teil gibt es nicht.", 404);
  if (teil.bestell_ref) return { ok: true, ref: String(teil.bestell_ref), meldung: "schon berechnet" };
  // Ziffer 12 Absatz 5: Verkaufen Gesellschafter, schulden SIE — keine Rechnung an die Firma (nur Vormerkung + Aufgabe an Justin).
  if (String(teil.schuldner ?? "") === "gesellschafter") return nein(FIRMA_SCHULDNER_GESELLSCHAFTER, 409);
  // Ein stornierter Auftrag stellt keine Rechnungen mehr — weder Monat noch Umsatz noch Verkauf.
  if (await auftragStorniert(z)) return nein("Der Auftrag ist storniert — es wird keine Rechnung mehr gestellt.", 409);
  // Anspruch: rechnung_am als Marke „in Arbeit“ — ein zweiter Lauf findet nichts mehr.
  const [frei] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = NOW() WHERE id = ${teilId} AND bestell_ref IS NULL AND rechnung_am IS NULL AND entfallen_am IS NULL RETURNING id`) as any[];
  if (!frei) return nein("Dieser Teil wird gerade berechnet oder ist entfallen.", 409);
  const zurueck = async () => { await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = NULL WHERE id = ${teilId} AND bestell_ref IS NULL`.catch(() => {}); };
  const ref = neueRef();
  const ok = await firmaBestellzeileAnlegen(ref, d, String(teil.titel), { ip: String(z.ip || ""), userAgent: String(z.user_agent || "") }).catch((e) => { console.error(`[FIAON-FIRMA] ${d.ref}: Bestellzeile ${teil.titel}:`, e); return false; });
  if (!ok) { await zurueck(); return nein(`Die Bestellzeile für „${teil.titel}“ ließ sich nicht anlegen — der nächste Lauf versucht es erneut.`, 502); }
  const [gebunden] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET bestell_ref = ${ref} WHERE id = ${teilId} AND bestell_ref IS NULL AND entfallen_am IS NULL RETURNING id`) as any[];
  if (!gebunden) {
    await sqlPool`UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE ref = ${ref} AND payment_status IN ('pending', 'pending_payment')`.catch(() => {});
    return nein("Der Teil ist inzwischen entfallen oder berechnet — keine Rechnung.", 409);
  }
  // Reverse Charge steht schon seit der Bestellzeile (firmaBestellzeileAnlegen) — vor der Rechnungsnummer.
  const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
  const erg = await bestellungFuerAntrag(ref, { globalMailFolgt: true });
  if (erg.status !== 200) return nein(`Die Rechnung für „${teil.titel}“ ließ sich nicht anlegen: ${String((erg.body as any)?.error || erg.status)}`, 502);
  await reverseChargeSetzen(ref, d);
  const nr = await firmaRechnungSteht(id, z, d, teil, ref, wer, "gestellt");
  return { ok: true, ref, meldung: `Rechnung „${teil.titel}“ über ${firmaEur(Number(teil.betrag_cents))} gestellt (${nr ?? ref}).` };
}

/**
 * „Rechnung steht“ — EIN Weg für beide Fälle (frisch gestellt und nachgeholt, Gegenprüfung 07.10.2026): Verlauf im Angebot
 * und in der Akte, dazu die Aufgabe „Rechnung schicken“ an die zuständige Person. Für Firmenangebote geht keine automatische
 * Mail raus — ohne diese Aufgabe erreichte eine nachgeholte Rechnung die Kundin nie. Idempotent über den Schlüssel
 * global:<ref>:rechnung:<teilId>. Nur aufrufen, wenn die Rechnungsnummer GERADE entstanden ist — auftragFuerKunden öffnet
 * eine erledigte Aufgabe mit demselben Schlüssel wieder („Die Rechnung steht schon“ ruft sie deshalb nicht).
 * Rückgabe: die Rechnungsnummer (oder null).
 */
async function firmaRechnungSteht(id: number, z: AngebotZeile, d: FirmaDaten, teil: any, ref: string, wer: string, wort: "gestellt" | "nachgeholt"): Promise<string | null> {
  const b = await globalBestellungLesen(ref);
  const ref1 = String(z.auftrag_ref || "");
  const betrag = firmaEur(Number(teil.betrag_cents));
  await verlaufAngebot(id, wer, `Rechnung „${teil.titel}“ ${wort} (${betrag}, ${b?.invoice_number ?? "—"}, ${ref})`);
  if (ref1) await globalVerlauf(ref1, `FIAON Global: Rechnung „${teil.titel}“ des Firmenangebots ${d.ref} über ${betrag} ${wort} (${b?.payment_reference ?? ref}).`);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const akte = ref1 ? await globalAkteLesen(ref1) : null;
  await auftragFuerKunden({
    personId: b?.person_id != null ? Number(b.person_id) : null, ref: ref1 || ref,
    titel: `Rechnung schicken: ${teil.titel} — ${d.kunde.firma.name}`,
    text: `Die Rechnung „${teil.titel}“ über ${betrag} (${b?.invoice_number ?? "—"}, Verwendungszweck ${b?.payment_reference ?? "—"}, zahlbar binnen ${zahlwort(Number(teil.zahlungsziel_tage || d.parameter.zahlungszielTage))} Tagen, Reverse Charge) ist ${wort}. Bitte als PDF an ${d.kunde.email} schicken — für Firmenangebote geht keine automatische Mail raus.`,
    schluessel: `global:${d.ref}:rechnung:${Number(teil.id)}`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
    agentId: akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null, link: ref1 ? globalOfficeAuftragPfad(ref1) : CHEF_LINK,
  }).catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Aufgabe „Rechnung schicken“:`, e));
  return b?.invoice_number ? String(b.invoice_number) : null;
}

/**
 * „Rechnung jetzt stellen“ (Chefbüro): für einen fälligen Teil, dessen Rechnung hing. Ist die Bestellzeile schon
 * gebunden, wird nur die Bestellung nachgeholt (wiederholbar); sonst wird der Anspruch gelöst und neu berechnet.
 */
export async function firmaTeilJetztBerechnen(id: number, teilId: number, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ ref: string; meldung: string }>> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen") return nein("Das Angebot ist nicht angenommen.", 409);
  const d = firmaDatenAus(z);
  const teil = (z.teile as any[]).find((x) => Number(x.id) === teilId);
  if (!teil) return nein("Diesen Teil gibt es nicht.", 404);
  if (teil.entfallen_am) return nein("Dieser Teil ist entfallen.", 409);
  if (Number(teil.nr) === 1) return nein("Die Gründung wird mit der Annahme berechnet — dafür gibt es „Nachholen“.", 409);
  if (String(teil.schuldner ?? "") === "gesellschafter") return nein(FIRMA_SCHULDNER_GESELLSCHAFTER, 409);
  if (await auftragStorniert(z)) return nein("Der Auftrag ist storniert — es wird keine Rechnung mehr gestellt.", 409);
  // Der Stundenlauf rechnet mit SEINEM Tag (heute aus jetzt) — derselbe Tag wie seine Auswahl der fälligen Teile.
  const faellig = isoTag(teil.faellig_am);
  const heute = opts.heute && ISO.test(opts.heute) ? opts.heute : berlinToday();
  if (faellig && faellig > heute) return nein(`Dieser Teil ist erst am ${firmaTag(faellig)} fällig.`, 409);
  if (teil.bestell_ref) {
    const ref = String(teil.bestell_ref);
    const b = await globalBestellungLesen(ref);
    // Steht die Rechnung schon, entsteht KEINE neue Aufgabe (eine erledigte „Rechnung schicken“ bliebe sonst nicht erledigt).
    if (b?.payment_reference && ["pending_payment", "claimed_paid", "paid"].includes(String(b.payment_status))) return { ok: true, ref, meldung: "Die Rechnung steht schon." };
    // Reverse Charge VOR der Nummer — auch im Nachholweg.
    await reverseChargeSetzen(ref, d);
    const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
    const erg = await bestellungFuerAntrag(ref, { globalMailFolgt: true });
    if (erg.status !== 200) return nein(`Die Rechnung ließ sich nicht anlegen: ${String((erg.body as any)?.error || erg.status)}`, 502);
    await reverseChargeSetzen(ref, d);
    const nr = await firmaRechnungSteht(id, z, d, teil, ref, wer, "nachgeholt");
    return { ok: true, ref, meldung: `Rechnung „${teil.titel}“ nachgeholt (${nr ?? ref}).` };
  }
  await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = NULL WHERE id = ${teilId} AND bestell_ref IS NULL`;
  return firmaTeilBerechnen(id, teilId, wer);
}
/** Warum ein Verkauf durch Gesellschafter keine Rechnung an die Firma bekommt (Ziffer 12 Absatz 5) — eine Quelle für Aktion und Liste. */
const FIRMA_SCHULDNER_GESELLSCHAFTER = "Verkauf durch Gesellschafter: Schuldner sind die veräußernden Gesellschafter (Ziffer 12 Absatz 5), nicht die Firma — keine Rechnung an die Firma. Rechnung und Umsatzsteuer klärt Justin von Hand.";
/**
 * Ist der Auftrag zu diesem Angebot storniert? Zwei Wege führen dorthin (Gegenprüfung 07.10.2026):
 *   · der Storno-Weg der Akte (fiaon-global-storno.ts) → fiaon_global_auftraege.status = 'storniert';
 *   · die Zahlungsliste (POST /admin/payments/:ref/cancel) oder ein Archiv → die GRÜNDUNGSbestellung ist cancelled,
 *     superseded oder archiviert, die Akte bleibt dabei 'offen'.
 * Beides stoppt Monatsrechnungen und Verlängerung. Eine Erstattung (refunded, Garantiefall) stoppt NICHT — der Vertrag
 * läuft dann weiter (Ziffer 7 Absatz 5). Eine neu ausgestellte Gründung läuft über „Nachholen“ an derselben Akte.
 */
async function auftragStorniert(z: AngebotZeile): Promise<boolean> {
  if (!z.auftrag_ref) return false;
  const ref1 = String(z.auftrag_ref);
  const [g] = (await sqlPool`SELECT status FROM fiaon_global_auftraege WHERE ref = ${ref1} LIMIT 1`) as any[];
  if (String(g?.status) === "storniert") return true;
  const [b] = (await sqlPool`SELECT payment_status, cancelled_at, archived_at FROM fiaon_applications WHERE ref = ${ref1} LIMIT 1`) as any[];
  return !!b && (!!b.cancelled_at || !!b.archived_at || ["cancelled", "superseded"].includes(String(b.payment_status)));
}
/**
 * Nach einem Storno des Firmenauftrags: alle Teile ohne Rechnung entfallen (Status, nichts gelöscht). Gerufen aus dem
 * Storno-Weg (fiaon-global-storno.ts) — wiederholbar. Rückgabe: wie viele Teile entfallen sind (0 = kein Firmenangebot).
 */
export async function firmaNachStorno(auftragRef: string, wer: string): Promise<number> {
  const [a] = (await sqlPool`SELECT id, angebot_ref, fassung FROM fiaon_global_angebote WHERE auftrag_ref = ${auftragRef} LIMIT 1`) as any[];
  if (!a || !istFirmenAngebot(a)) return 0;
  const weg = (await sqlPool`
    UPDATE fiaon_global_angebot_teile SET entfallen_am = NOW(), entfallen_grund = ${`Storno des Auftrags (${wer})`}
     WHERE angebot_id = ${a.id} AND nr > 1 AND bestell_ref IS NULL AND entfallen_am IS NULL RETURNING id`) as any[];
  await verlaufAngebot(Number(a.id), wer, `Auftrag storniert — ${weg.length} Teile ohne Rechnung entfallen; der Stundenlauf stellt keine Rechnungen mehr.`);
  return weg.length;
}

/** Hat die Bestellung eines Teils eine Rechnung? Nur diese drei Stände (payment_reference trägt jede Bestellzeile ab dem Anlegen). */
const FIRMA_RECHNUNG_STATUS = ["pending_payment", "claimed_paid", "paid"] as const;
/** … oder ist sie schon beendet (storniert, ersetzt, erstattet)? Dann holt der Stundenlauf nichts nach. */
const FIRMA_RECHNUNG_STATUS_ODER_ENDE = [...FIRMA_RECHNUNG_STATUS, "cancelled", "superseded", "refunded"];
function rechnungSteht(status: unknown): boolean { return (FIRMA_RECHNUNG_STATUS as readonly string[]).includes(String(status ?? "")); }
/** Ist diese Zeile ein Firmenangebot? (Fassung mit Präfix IA-FIRMA-) */
export function istFirmenAngebot(z: { fassung?: unknown } | null | undefined): boolean {
  return String(z?.fassung ?? "").startsWith("IA-FIRMA-");
}

// ═══════════════════════════════════════════════════════════════════════════
// DER STUNDENLAUF (aus globalAngebotLauf): Monatsrechnungen, Verlängerung, Fristende der Garantie
// ═══════════════════════════════════════════════════════════════════════════
export async function firmaStundenlauf(jetzt: Date = new Date()): Promise<{ rechnungen: number; verlaengert: number; fristende: number; starttagErinnert: number; fehler: number }> {
  await ensureAngebotTabellen();
  const heute = berlinToday(jetzt);
  // Storniert ist ein Auftrag auf zwei Wegen (auftragStorniert): Akte 'storniert' ODER die Gründungsbestellung über die
  // Zahlungsliste storniert/ersetzt/archiviert — beides stoppt Monatsrechnungen und Verlängerung (Gegenprüfung 07.10.2026).
  const zeilen = (await sqlPool`
    SELECT a.id FROM fiaon_global_angebote a
      LEFT JOIN fiaon_global_auftraege g ON g.ref = a.auftrag_ref
      LEFT JOIN fiaon_applications b ON b.ref = a.auftrag_ref
     WHERE a.status = 'angenommen' AND a.fassung LIKE 'IA-FIRMA-%' AND a.auftrag_ref IS NOT NULL AND a.nacharbeit_fehler IS NULL
       AND (g.status IS NULL OR g.status <> 'storniert')
       AND (b.ref IS NULL OR (b.cancelled_at IS NULL AND b.archived_at IS NULL AND COALESCE(b.payment_status, '') NOT IN ('cancelled', 'superseded')))
     ORDER BY a.id LIMIT 200`) as any[];
  let rechnungen = 0; let verlaengert = 0; let fristende = 0; let starttagErinnert = 0; let fehler = 0;
  for (const { id } of zeilen) {
    try {
      const z = await angebotLesen({ id: Number(id) });
      if (!z) continue;
      const d = firmaDatenAus(z); const sch = schalterAus(z); const fr = await firmaFreigabenLesen(Number(id));
      // Gegenprüfung 08.10.2026 (Fund 2): Ohne Starttag entfallen NUR Verlängerung und Monatsrechnungen (sie hängen am Starttag).
      // Hängende Teile (etwa ein Verkauf), das Fristende der Garantie (Ziffer 7 Absatz 5) und die Erinnerung an den spätesten
      // Starttag (Ziffer 10 Absatz 2) laufen immer — vorher übersprang „kein Starttag“ den ganzen Lauf, auch die Erstattungsaufgabe.
      if (sch.starttag) {
        // ── Verlängerung: Kündigungsfrist ohne Kündigung verstrichen → die nächsten Monate anlegen ──
        const monate = (z.teile as any[]).filter((t) => String(t.faelligkeit) === "monatlich").length;
        if (!fr.kuendigung && monate > 0) {
          const ende = laufzeitEnde(sch.starttag, monate);
          if (heute > kuendigungSpaetestens(ende, d.parameter.kuendigungMonate)) {
            const neu = await monatsteileBis(Number(id), d, sch.starttag, monate + d.parameter.verlaengerungMonate);
            if (neu > 0) {
              verlaengert++;
              await verlaufAngebot(Number(id), "System", `Vertrag um ${monateWort(d.parameter.verlaengerungMonate)} verlängert (keine Kündigung bis ${firmaTag(kuendigungSpaetestens(ende, d.parameter.kuendigungMonate))}) — neues Laufzeitende ${firmaTag(laufzeitEnde(sch.starttag, monate + d.parameter.verlaengerungMonate))}`);
            }
          }
        }
        // ── Fällige Monatsteile berechnen (Fälligkeitstag in Berlin erreicht) ──
        const frisch = (await sqlPool`
          SELECT id FROM fiaon_global_angebot_teile
           WHERE angebot_id = ${id} AND faelligkeit = 'monatlich' AND bestell_ref IS NULL AND rechnung_am IS NULL AND entfallen_am IS NULL
             AND faellig_am IS NOT NULL AND faellig_am <= ${heute}::date
           ORDER BY faellig_am LIMIT 3`) as any[];
        for (const t of frisch) {
          const r = await firmaTeilBerechnen(Number(id), Number(t.id), "System (Monatslauf)");
          if (r.ok) rechnungen++; else { fehler++; console.error(`[FIAON-FIRMA] ${d.ref}: Monatsrechnung:`, r.error); }
        }
      }
      // ── Hängende Teile nachholen: Bestellzeile gebunden, aber keine Rechnung — oder seit über einer Stunde „in Arbeit“
      //    ohne Bestellzeile (Prozess zwischen den Schritten beendet). Schlägt es wieder fehl: Aufgabe an die Leitung.
      //    „Keine Rechnung“ heißt: Die Bestellung steht noch nicht auf pending_payment/claimed_paid/paid. payment_reference
      //    ist in fiaon_applications NOT NULL (die Bestellzeile trägt ihn ab dem Anlegen) — an ihm lässt sich das nicht
      //    ablesen (Vor-Live-Prüfung 08.10.2026: die alte Bedingung „payment_reference IS NULL“ traf nie). ──
      const haengt = (await sqlPool`
        SELECT t.id, t.titel FROM fiaon_global_angebot_teile t
          LEFT JOIN fiaon_applications b ON b.ref = t.bestell_ref
         WHERE t.angebot_id = ${id} AND t.nr > 1 AND t.entfallen_am IS NULL AND t.faellig_am IS NOT NULL AND t.faellig_am <= ${heute}::date
           AND t.schuldner IS DISTINCT FROM 'gesellschafter'
           AND ((t.bestell_ref IS NOT NULL AND COALESCE(b.payment_status, '') <> ALL(${FIRMA_RECHNUNG_STATUS_ODER_ENDE}::text[])
                 AND (t.rechnung_am IS NULL OR t.rechnung_am < NOW() - INTERVAL '15 minutes'))
             OR (t.bestell_ref IS NULL AND t.rechnung_am IS NOT NULL AND t.rechnung_am < NOW() - INTERVAL '1 hour'))
         ORDER BY t.nr LIMIT 3`) as any[];
      for (const t of haengt) {
        const r = await firmaTeilJetztBerechnen(Number(id), Number(t.id), "System (Stundenlauf, nachgeholt)", { heute });
        if (r.ok) { rechnungen++; continue; }
        fehler++;
        console.error(`[FIAON-FIRMA] ${d.ref}: Rechnung „${t.titel}“ hängt:`, r.error);
        const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
        await auftragFuerKunden({
          personId: z.person_id != null ? Number(z.person_id) : null, ref: String(z.auftrag_ref),
          titel: `Rechnung hängt: ${t.titel} — ${d.kunde.firma.name}`,
          text: `Die Rechnung „${t.titel}“ des Firmenangebots ${d.ref} ließ sich zweimal nicht stellen: ${r.error}. Im Chefbüro „Rechnung jetzt stellen“ auslösen; hilft das nicht, Technik ansehen.`,
          dringend: true, anBetreiber: true, schluessel: `global:${d.ref}:rechnung-haengt:${t.id}`, bereich: "technik", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
        }).catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Aufgabe „Rechnung hängt“:`, e));
      }
      // ── Spätester Starttag erreicht, aber kein Starttag eingetragen (Fassung D, Ziffer 10 Absatz 2): EINE Aufgabe an die Leitung.
      //    Einmal je Angebot — die Marke im Schalter wird atomar gesetzt (ein zweiter Lauf findet sie und legt nichts an). Nach einer
      //    Kündigung nicht: „Shop live“ ist dann gesperrt, es beginnt kein Wachstumsbudget mehr. ──
      if (!sch.starttag && !fr.kuendigung && budgetSpaetestensGilt(d.fassung) && z.angenommen_am) {
        const annahmeTag = berlinToday(new Date(z.angenommen_am));
        const spaetester = budgetSpaetesterStart(annahmeTag, d.parameter);
        if (heute >= spaetester) {
          const [neu] = (await sqlPool`
            UPDATE fiaon_global_angebote SET schalter = COALESCE(schalter, '{}'::jsonb) || ${jsonb({ spaetesterStartErinnertAm: heute })}
             WHERE id = ${id} AND COALESCE(schalter->>'spaetesterStartErinnertAm', '') = '' AND COALESCE(schalter->>'starttag', '') = '' RETURNING id`) as any[];
          if (neu) {
            starttagErinnert++;
            await verlaufAngebot(Number(id), "System", `Spätester Starttag (${firmaTag(spaetester)}, Ziffer 10 Absatz 2) erreicht — kein Starttag eingetragen; Aufgabe an die Leitung`);
            const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
            await auftragFuerKunden({
              personId: z.person_id != null ? Number(z.person_id) : null, ref: z.auftrag_ref ? String(z.auftrag_ref) : null,
              titel: `Spätester Starttag erreicht — Starttag eintragen (${d.kunde.firma.name})`,
              text: `Beim Firmenangebot ${d.ref} ist der späteste Starttag erreicht: ${firmaTag(spaetester)} (${monateWort(d.parameter.budgetSpaetestensMonate)} nach der Annahme am ${firmaTag(annahmeTag)}, Ziffer 10 Absatz 2) — im Chefbüro ist noch kein Starttag eingetragen, das Wachstumsbudget läuft also nicht. Ist der Shop live: „Shop live“ mit dem echten Tag eintragen. Ist er nicht live und liegt die Verzögerung NICHT bei FIAON: „Spätester Starttag“ wählen — Starttag ist dann der ${firmaTag(spaetester)}, fällige Monatsrechnungen stellt das System sofort. Liegt die Verzögerung bei FIAON: „Shop live“ erst eintragen, wenn der Shop live ist (mit dem Haken „Verzögerung bei FIAON“). Der Kundin den Starttag in Textform mitteilen — es geht keine automatische Mail raus.`,
              dringend: true, anBetreiber: true, faelligAm: heute, schluessel: `global:${d.ref}:spaetester-starttag`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
            }).catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Aufgabe „Spätester Starttag“:`, e));
          }
        }
      }
      // ── Fristende der Garantie ohne „erste Runde erhalten“: Aufgabe an Justin (auch ohne Starttag — Ziffer 7 Absatz 5) ──
      const fe = isoTag(z.frist_ende);
      if (fe && heute > fe && !z.garantie_erfuellt_am && !z.erstattung_ausgeloest_am && !z.frist_abgelaufen_am) {
        const [frei] = (await sqlPool`UPDATE fiaon_global_angebote SET frist_abgelaufen_am = NOW() WHERE id = ${id} AND frist_abgelaufen_am IS NULL RETURNING id`) as any[];
        if (frei) {
          fristende++;
          const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
          await auftragFuerKunden({
            personId: z.person_id != null ? Number(z.person_id) : null, ref: String(z.auftrag_ref),
            titel: `Garantiefrist abgelaufen — erste Runde prüfen (${d.kunde.firma.name})`,
            text: `Die Garantiefrist des Firmenangebots ${d.ref} endete am ${firmaTag(fe)}, ohne dass „erste Runde erhalten“ eingetragen ist. Lag die erste Runde (${firmaUsd(d.parameter.kapitalUsd)}) vorher vor: im Chefbüro eintragen. Sonst „Garantiefall“: Erstattung der Gründung (${firmaEur(d.parameter.startCents)}) binnen ${zahlwort(d.parameter.erstattungTage)} Tagen nach Fristende, von Hand.${kuendigungSperrtGarantie(fr.kuendigung, fe) ? ` ACHTUNG: Der Vertrag endete durch eine Kündigung aus wichtigem Grund zum ${firmaTag(fr.kuendigung!.zum)}, vor dem Fristende — die Garantie ist entfallen (Ziffer 14 Absatz 3), „Garantiefall“ bleibt gesperrt.` : ""}`,
            dringend: true, anBetreiber: true, faelligAm: heute, schluessel: `global:${d.ref}:garantie-fristende`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
          }).catch((e) => console.error(`[FIAON-FIRMA] ${d.ref}: Fristende:`, e));
        }
      }
    } catch (e) { fehler++; console.error(`[FIAON-FIRMA] Stundenlauf, Angebot ${id}:`, e); }
  }
  return { rechnungen, verlaengert, fristende, starttagErinnert, fehler };
}

// ═══════════════════════════════════════════════════════════════════════════
// LEITUNG (requireChef("leitung")) — jede Aktion rein geprüft, Knopf-Zustand kommt aus denselben Prüfungen
// ═══════════════════════════════════════════════════════════════════════════
interface Lage { z: AngebotZeile; d: FirmaDaten; fr: FirmaFreigaben; sch: { starttag: string | null; startWahl: string | null }; heute: string; gruendungBezahlt: boolean }
async function lageLesen(id: number, heuteVorgabe?: string): Promise<Lage | null> {
  const z = await angebotLesen({ id });
  if (!z) return null;
  const teil1 = (z.teile as any[]).find((x) => Number(x.nr) === 1);
  const b1 = teil1?.bestell_ref ? await globalBestellungLesen(String(teil1.bestell_ref)) : null;
  return { z, d: firmaDatenAus(z), fr: await firmaFreigabenLesen(id), sch: schalterAus(z), heute: heuteVorgabe && ISO.test(heuteVorgabe) ? heuteVorgabe : berlinToday(), gruendungBezahlt: String(b1?.payment_status) === "paid" };
}
async function freigabeSetzen(id: number, teil: Partial<FirmaFreigaben>): Promise<void> {
  await sqlPool`UPDATE fiaon_global_angebote SET freigaben = COALESCE(freigaben, '{}'::jsonb) || ${jsonb(teil)}, updated_at = NOW() WHERE id = ${id}`;
}
const tagOk = (v: unknown) => ISO.test(String(v ?? "")) ? String(v) : null;
/**
 * Ein Euro-Betrag → Cent. Text: ganze Euro mit Tausenderpunkten, Nachkommastellen nur mit Komma („1.234.567,89“).
 * Eine Zahl gilt ebenfalls als EURO (nie als Cent) — ob Euro oder Cent, entscheidet das Feld, nicht der Typ.
 */
export function euroZuCents(roh: unknown): number | null {
  if (typeof roh === "number") return Number.isFinite(roh) && roh >= 0 ? Math.round(roh * 100) : null;
  const s = String(roh ?? "").trim().replace(/\s|€/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(s)) return null;
  const [ganz, nach = ""] = s.replace(/\./g, "").split(",");
  return Number(ganz) * 100 + Number((nach + "00").slice(0, 2));
}

/** Ein Feld …Cents: nur eine ganze, nicht negative Zahl (Cent). Ein Text darin ist ein Fehler, keine Umdeutung. */
export function centsFeld(roh: unknown): number | null {
  return typeof roh === "number" && Number.isInteger(roh) && roh >= 0 ? roh : null;
}
/** Betrag aus dem Paar „…Cents“ (ganze Zahl in Cent) bzw. dem Euro-Feld (Text oder Zahl in Euro). */
function betragAus(ein: any, centsFeldName: string, euroFeldName: string): { cents: number | null; fehler: string | null } {
  if (ein && ein[centsFeldName] !== undefined && ein[centsFeldName] !== null && ein[centsFeldName] !== "") {
    const c = centsFeld(ein[centsFeldName]);
    return c == null ? { cents: null, fehler: `„${centsFeldName}“ nur als ganze Zahl in Cent — Euro-Beträge als Text in „${euroFeldName}“.` } : { cents: c, fehler: null };
  }
  return { cents: euroZuCents(ein?.[euroFeldName]), fehler: null };
}

/** Knopf-Zustände aus denselben Regeln wie die Aktionen — frei (null) oder der Grund. */
export function firmaKnoepfe(l: { status: string; fr: FirmaFreigaben; fristBeginn: string | null; fristEnde: string | null; garantieErfuelltAm: string | null; erstattungAusgeloest: boolean; gruendungBezahlt: boolean; heute: string; starttag: string | null }) {
  const angenommen = l.status === "angenommen";
  const ohneStart = "Erst wenn „Shop live“ eingetragen ist (Starttag).";
  return {
    // Runde 2: „Shop live“ setzt den Starttag — damit beginnt das Wachstumsbudget (Monatsteile, erste Rechnung an diesem Tag).
    // Gegenprüfung 08.10.2026 (Fund 3): Nach einer Kündigung beginnt kein Wachstumsbudget mehr — keine Monatsteile für einen gekündigten Vertrag.
    shopLive: !angenommen ? "Erst nach der Annahme." : l.starttag ? `Schon eingetragen (Starttag ${firmaTag(l.starttag)}).` : l.fr.kuendigung ? `Der Vertrag ist gekündigt (zum ${firmaTag(l.fr.kuendigung.zum)}) — es beginnt kein Wachstumsbudget mehr.` : null,
    freigabe: l.status === "offen" || angenommen ? null : "Nur bei offenen oder angenommenen Angeboten.",
    aendern: l.status === "offen" ? null : "Nur solange das Angebot offen ist.",
    bedingungen: !angenommen ? "Erst nach der Annahme." : l.fr.bedingungenErfuelltAm ? `Schon eingetragen (${firmaTag(l.fr.bedingungenErfuelltAm)}).` : null,
    kapital: !angenommen ? "Erst nach der Annahme." : !l.fristEnde ? "Erst wenn „Bedingungen erfüllt“ eingetragen ist." : l.garantieErfuelltAm ? `Schon eingetragen (${firmaTag(l.garantieErfuelltAm)}).` : l.erstattungAusgeloest ? "Der Garantiefall ist vorgemerkt." : null,
    hemmung: !l.fristEnde || l.garantieErfuelltAm || l.erstattungAusgeloest ? "Nur während die Garantiefrist läuft." : null,
    garantiefall: !angenommen ? "Erst nach der Annahme." : !l.fristEnde ? "Die Garantiefrist läuft noch nicht." : l.garantieErfuelltAm ? "Die erste Runde ist erhalten — kein Garantiefall." : l.erstattungAusgeloest ? "Schon vorgemerkt." : l.heute <= l.fristEnde ? `Die Frist läuft bis ${firmaTag(l.fristEnde)} — erst danach.` : !l.gruendungBezahlt ? "Die Gründung ist nicht bezahlt — nichts zu erstatten." : kuendigungSperrtGarantie(l.fr.kuendigung, l.fristEnde) ? `Der Vertrag endete durch eine Kündigung aus wichtigem Grund zum ${firmaTag(l.fr.kuendigung!.zum)}, vor dem Fristende — die Garantie ist entfallen (Ziffer 14 Absatz 3).` : null,
    umsatz: !angenommen ? "Erst nach der Annahme." : !l.starttag ? ohneStart : null,
    verkauf: !angenommen ? "Erst nach der Annahme." : null,
    // Nach einer ordentlichen Kündigung bleibt eine Kündigung aus wichtigem Grund möglich (Ziffer 14 Absatz 3).
    // Gegenprüfung 08.10.2026 (Fund 3): Aus wichtigem Grund geht auch VOR dem Starttag (sonst griffe kuendigungSperrtGarantie nie);
    // die ordentliche Kündigung bleibt an den Starttag gebunden (Ziffer 14 Absatz 2: Laufzeit ab dem Starttag) — kuendigungOrdentlich.
    kuendigung: !angenommen ? "Erst nach der Annahme." : l.fr.kuendigung?.art === "ausserordentlich" ? `Schon eingetragen: aus wichtigem Grund zum ${firmaTag(l.fr.kuendigung.zum)}.` : null,
    kuendigungOrdentlich: !angenommen ? "Erst nach der Annahme." : l.fr.kuendigung ? `Schon eingetragen: ${l.fr.kuendigung.art === "ausserordentlich" ? "aus wichtigem Grund" : "ordentlich"} zum ${firmaTag(l.fr.kuendigung.zum)}. Danach ist nur noch eine Kündigung aus wichtigem Grund möglich.` : !l.starttag ? "Ordentlich erst ab dem Starttag („Shop live“) — die Laufzeit zählt ab dann (Ziffer 14 Absatz 2). Vorher nur aus wichtigem Grund." : null,
  };
}
function knoepfeAus(l: Lage) {
  return firmaKnoepfe({ status: String(l.z.status), fr: l.fr, fristBeginn: isoTag(l.z.frist_beginn), fristEnde: isoTag(l.z.frist_ende), garantieErfuelltAm: isoTag(l.z.garantie_erfuellt_am), erstattungAusgeloest: !!l.z.erstattung_ausgeloest_am, gruendungBezahlt: l.gruendungBezahlt, heute: l.heute, starttag: l.sch.starttag });
}

export async function firmaFreigabeAnwalt(id: number, ein: any, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ meldung: string }>> {
  const l = await lageLesen(id, opts.heute); if (!l) return nein("Dieses Angebot gibt es nicht.", 404);
  const k = knoepfeAus(l).freigabe; if (k) return nein(k, 409);
  const name = text(ein?.name, 120); const am = tagOk(ein?.am);
  if (name.length < 3) return nein("Name des Anwalts bzw. der Kanzlei (mindestens drei Zeichen).");
  if (!am || am > l.heute) return nein("Datum der Freigabe (JJJJ-MM-TT, nicht in der Zukunft).");
  // Die Freigabe gilt für GENAU diese Fassung: Prüfsumme des Vertrags und der Anlage 1 jetzt (Gegenprüfung 07.10.2026).
  // Ändert sich danach ein Wort, sperrt die Versandsperre wieder, bis die Freigabe neu eingetragen ist.
  // Nachprüfung 08.10.2026 (N4): dazu die Angaben der Bürgin, wie sie jetzt stehen (Registerauszug, Status „Active“).
  const aktuell = { textHash: firmaTextHash(l.d), anlage1: firmaAnlage1Pruefsumme(l.d), buergin: firmaBuerginPruefsumme(l.d.buergin) };
  const anwalt = { name, am, von: wer, fassung: l.d.fassung, ...aktuell };
  await freigabeSetzen(id, { anwalt });
  await verlaufAngebot(id, wer, `Freigabe Anwalt: ${name}, ${firmaTag(am)} — für Fassung ${l.d.fassung}, Prüfsumme Vertrag ${aktuell.textHash.slice(0, 12)}…, Anlage 1 ${aktuell.anlage1.slice(0, 12)}…`);
  const sperre = firmaVersandSperre(l.d.buergin, { ...l.fr, anwalt }, aktuell);
  return { ok: true, meldung: sperre ? `Freigabe eingetragen (Prüfsumme ${aktuell.textHash.slice(0, 12)}…). Versand bleibt gesperrt: ${sperre}` : `Freigabe eingetragen für Prüfsumme ${aktuell.textHash.slice(0, 12)}… — der Link darf raus.` };
}

export async function firmaBedingungenErfuellt(id: number, ein: any, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ meldung: string; fristEnde: string }>> {
  const l = await lageLesen(id, opts.heute); if (!l) return nein("Dieses Angebot gibt es nicht.", 404);
  const k = knoepfeAus(l).bedingungen; if (k) return nein(k, 409);
  const am = tagOk(ein?.am);
  const angenommen = l.z.angenommen_am ? berlinToday(new Date(l.z.angenommen_am)) : l.heute;
  if (!am || am > l.heute || am < angenommen) return nein(`Tag der erfüllten Bedingungen (JJJJ-MM-TT, zwischen ${firmaTag(angenommen)} und heute).`);
  if (garantieAbAnnahme(l.z.fassung)) {
    // Fassung C: Die Frist läuft seit der Annahme — „Bedingungen erfüllt“ macht nur die Bürgschaft wirksam (Ziffer 8 Absatz 4/5).
    const fe = isoTag(l.z.frist_ende) ?? "";
    await freigabeSetzen(id, { bedingungenErfuelltAm: am });
    await verlaufAngebot(id, wer, `Bedingungen der Bürgschaft erfüllt am ${firmaTag(am)} — die Bürgschaft ist wirksam; die Garantiefrist läuft seit der Annahme${fe ? ` bis ${firmaTag(fe)}` : ""}`);
    if (l.z.auftrag_ref) await globalVerlauf(String(l.z.auftrag_ref), `FIAON Global: Bedingungen der Bürgschaft erfüllt (${firmaTag(am)}) — der Kundin den Tag in Textform bestätigen (Ziffer 8 Absatz 5).`);
    return { ok: true, fristEnde: fe, meldung: `Bedingungen erfüllt am ${firmaTag(am)} — die Bürgschaft ist wirksam. Die Garantiefrist läuft seit der Annahme${fe ? ` bis ${firmaTag(fe)}` : ""}. Den Tag bitte der Kundin in Textform bestätigen.` };
  }
  const ende = garantieFristEnde(am, l.d.parameter.garantieMonate, 0);
  const [r] = (await sqlPool`UPDATE fiaon_global_angebote SET frist_beginn = ${am}::date, frist_ende = ${ende}::date, updated_at = NOW() WHERE id = ${id} AND frist_beginn IS NULL RETURNING id`) as any[];
  if (!r) return nein("Die Garantiefrist läuft schon.", 409);
  await freigabeSetzen(id, { bedingungenErfuelltAm: am });
  await verlaufAngebot(id, wer, `Bedingungen der Bürgschaft erfüllt am ${firmaTag(am)} — Garantiefrist der ersten Runde bis ${firmaTag(ende)}`);
  if (l.z.auftrag_ref) await globalVerlauf(String(l.z.auftrag_ref), `FIAON Global: Bedingungen der Bürgschaft erfüllt (${firmaTag(am)}). Garantiefrist der ersten Runde bis ${firmaTag(ende)} — der Kundin in Textform mitteilen (Ziffer 7 Absatz 3).`);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: l.z.person_id != null ? Number(l.z.person_id) : null, ref: l.z.auftrag_ref ? String(l.z.auftrag_ref) : null,
    titel: `Garantiefrist läuft bis ${firmaTag(ende)} — erste Runde für ${l.d.kunde.firma.name}`,
    text: `${wer} hat eingetragen: Bedingungen der Bürgschaft erfüllt am ${firmaTag(am)}. Die erste Runde (${firmaUsd(l.d.parameter.kapitalUsd)}) muss bis ${firmaTag(ende)} ausgezahlt oder verbindlich zugesagt sein. Beginn und Ende der Kundin in Textform mitteilen (Ziffer 7 Absatz 3).`,
    dringend: true, anBetreiber: true, schluessel: `global:${l.d.ref}:garantiefrist`, bereich: "konten", quelle: "global", autorName: wer, link: CHEF_LINK,
  }).catch((e) => console.error(`[FIAON-FIRMA] ${l.d.ref}: Aufgabe Garantiefrist:`, e));
  return { ok: true, fristEnde: ende, meldung: `Bedingungen erfüllt am ${firmaTag(am)} — Garantiefrist bis ${firmaTag(ende)}. Bitte der Kundin in Textform mitteilen.` };
}

/**
 * „Shop live“ (Runde 2, Justin 08.10.2026, Punkt 8): Die Leitung trägt den Tag ein, an dem der Shop live ist. Er ist der Starttag
 * (Ziffer 10 Absatz 2): Das gemeinsame Wachstumsbudget beginnt, die Monatsteile der Mindestlaufzeit entstehen ab diesem Tag, die
 * erste Monatsrechnung wird an diesem Tag gestellt (hier sofort, sonst im nächsten Stundenlauf). KEINE Mail an die Kundin —
 * die zuständige Person bekommt die Aufgabe, den Tag in Textform mitzuteilen (und die Rechnung „Rechnung schicken“).
 * Fassung D (Runde 3, Punkt 5): Ist der Shop zum spätesten Starttag (Annahme + budgetSpaetestensMonate) nicht live und liegt die
 * Verzögerung nicht bei FIAON, trägt die Leitung art „spaetestens“ ein — Starttag ist dann genau dieser Tag. Ein Tag „Shop live“
 * NACH dem spätesten Starttag geht nur mit der Bestätigung, dass die Verzögerung bei FIAON liegt (verzoegerungFiaon).
 */
export async function firmaShopLive(id: number, ein: any, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ meldung: string; starttag: string; monate: number }>> {
  const l = await lageLesen(id, opts.heute); if (!l) return nein("Dieses Angebot gibt es nicht.", 404);
  const k = knoepfeAus(l).shopLive; if (k) return nein(k, 409);
  if (await auftragStorniert(l.z)) return nein("Der Auftrag ist storniert — kein Wachstumsbudget.", 409);
  const angenommen = l.z.angenommen_am ? berlinToday(new Date(l.z.angenommen_am)) : l.heute;
  const spaetester = budgetSpaetestensGilt(l.d.fassung) ? budgetSpaetesterStart(angenommen, l.d.parameter) : null;
  const spaetestensArt = String(ein?.art ?? "") === "spaetestens";
  let am: string | null;
  if (spaetestensArt) {
    if (!spaetester) return nein("Den spätesten Starttag gibt es erst ab Fassung D — hier nur „Shop live“ mit Datum.");
    if (l.heute < spaetester) return nein(`Der späteste Starttag ist der ${firmaTag(spaetester)} — vorher nur „Shop live“ mit dem echten Tag.`);
    am = spaetester;
  } else {
    am = tagOk(ein?.am);
    if (!am || am > l.heute || am < angenommen) return nein(`Tag „Shop live“ (JJJJ-MM-TT, zwischen ${firmaTag(angenommen)} und heute) — der Tag, an dem der Shop erreichbar ist und Bestellungen annimmt.`);
    if (spaetester && am > spaetester && ein?.verzoegerungFiaon !== true) {
      return nein(`Der Tag liegt nach dem spätesten Starttag (${firmaTag(spaetester)}, Ziffer 10 Absatz 2). Entweder „Spätester Starttag“ eintragen — oder bestätigen, dass die Verzögerung auf Umständen beruht, die FIAON zu vertreten hat.`);
    }
  }
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote
       SET schalter = COALESCE(schalter, '{}'::jsonb) || ${jsonb({ starttag: am, shopLiveAm: spaetestensArt ? null : am, starttagArt: spaetestensArt ? "spaetestens" : "shop-live", ...(spaetestensArt ? {} : { verzoegerungFiaon: ein?.verzoegerungFiaon === true && !!spaetester && am > spaetester }), shopLiveVon: wer, shopLiveEingetragen: new Date().toISOString() })}, updated_at = NOW()
     WHERE id = ${id} AND status = 'angenommen' AND COALESCE(schalter->>'starttag', '') = ''
       AND COALESCE(freigaben->'kuendigung', 'null'::jsonb) = 'null'::jsonb RETURNING id`) as any[];
  if (!frei) return nein("Der Starttag ist schon eingetragen — oder der Vertrag wurde gerade gekündigt.", 409);
  const monate = await monatsteileBis(id, l.d, am, l.d.parameter.mindestMonate);
  const ende = laufzeitEnde(am, l.d.parameter.mindestMonate);
  const wie = spaetestensArt ? `Spätester Starttag ${firmaTag(am)} (Ziffer 10 Absatz 2: Shop nach ${monateWort(l.d.parameter.budgetSpaetestensMonate)} nicht live, Verzögerung nicht bei FIAON)` : `Shop live am ${firmaTag(am)}${spaetester && am > spaetester ? ` (nach dem spätesten Starttag ${firmaTag(spaetester)} — Verzögerung bei FIAON bestätigt)` : ""}`;
  await verlaufAngebot(id, wer, `${wie} — Starttag: Wachstumsbudget beginnt (Anteil ${firmaEur(l.d.parameter.monatCents)}/Monat), ${monate} Monatsteile angelegt, Mindestlaufzeit bis ${firmaTag(ende)}`);
  if (l.z.auftrag_ref) await globalVerlauf(String(l.z.auftrag_ref), `FIAON Global: ${wie} — das gemeinsame Wachstumsbudget beginnt (Ziffer 10 Absatz 2). Der Kundin den Tag in Textform mitteilen.`);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const akte = l.z.auftrag_ref ? await globalAkteLesen(String(l.z.auftrag_ref)) : null;
  await auftragFuerKunden({
    personId: l.z.person_id != null ? Number(l.z.person_id) : null, ref: l.z.auftrag_ref ? String(l.z.auftrag_ref) : null,
    titel: `${spaetestensArt ? "Spätesten Starttag" : "Shop live"} mitteilen: ${l.d.kunde.firma.name} — Wachstumsbudget ab ${firmaTag(am)}`,
    text: `${wer} hat ${spaetestensArt ? "den spätesten Starttag" : "„Shop live“"} am ${firmaTag(am)} eingetragen. Das ist der Starttag nach Ziffer 10 Absatz 2: Anteil ${firmaEur(l.d.parameter.monatCents)} im Monat (die Hälfte von ${firmaEur(l.d.parameter.budgetGesamtCents)}), Mindestlaufzeit bis ${firmaTag(ende)}, Kündigung spätestens ${firmaTag(kuendigungSpaetestens(ende, l.d.parameter.kuendigungMonate))}. Bitte den Tag der Kundin in Textform mitteilen — es geht keine automatische Mail raus. Die Monatsrechnungen stellt das System am Fälligkeitstag; jede kommt als Aufgabe „Rechnung schicken“.`,
    schluessel: `global:${l.d.ref}:shop-live`, bereich: "konten", quelle: "global", autorName: wer,
    agentId: akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null, link: l.z.auftrag_ref ? globalOfficeAuftragPfad(String(l.z.auftrag_ref)) : CHEF_LINK,
  }).catch((e) => console.error(`[FIAON-FIRMA] ${l.d.ref}: Aufgabe „Shop live mitteilen“:`, e));
  // Die erste Monatsrechnung „an diesem Tag“ — sofort (höchstens drei fällige Teile; der Stundenlauf holt den Rest).
  const faellig = (await sqlPool`
    SELECT id FROM fiaon_global_angebot_teile
     WHERE angebot_id = ${id} AND faelligkeit = 'monatlich' AND bestell_ref IS NULL AND rechnung_am IS NULL AND entfallen_am IS NULL
       AND faellig_am IS NOT NULL AND faellig_am <= ${l.heute}::date ORDER BY faellig_am LIMIT 3`) as any[];
  const gestellt: string[] = [];
  for (const t of faellig) {
    const r = await firmaTeilBerechnen(id, Number(t.id), wer).catch((e) => ({ ok: false as const, status: 500, error: String(e) }));
    if (r.ok) gestellt.push(r.meldung); else console.error(`[FIAON-FIRMA] ${l.d.ref}: erste Monatsrechnung nach „Shop live“:`, r.error);
  }
  return { ok: true, starttag: am, monate, meldung: `${spaetestensArt ? "Spätester Starttag" : "Shop live am"} ${firmaTag(am)} eingetragen — ${monate} Monatsteile, Mindestlaufzeit bis ${firmaTag(ende)}. ${gestellt.length ? gestellt.join(" ") : "Die erste Monatsrechnung stellt der Stundenlauf."} Bitte der Kundin den Tag in Textform mitteilen.` };
}

export async function firmaKapitalErhalten(id: number, ein: any, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ meldung: string }>> {
  const l = await lageLesen(id, opts.heute); if (!l) return nein("Dieses Angebot gibt es nicht.", 404);
  const k = knoepfeAus(l).kapital; if (k) return nein(k, 409);
  const am = tagOk(ein?.am); const beginn = isoTag(l.z.frist_beginn)!; const ende = isoTag(l.z.frist_ende)!;
  // Fassung D (Runde 3, Punkt 4): garantiert ist die Auszahlung — eine Zusage erfüllt die Garantie nicht mehr.
  const nurAuszahlung = garantieNurAuszahlung(l.d.fassung);
  const arten = nurAuszahlung ? ["ausgezahlt", "abgelehnt"] : ["ausgezahlt", "zugesagt", "abgelehnt"];
  const art = arten.includes(String(ein?.art)) ? String(ein.art) : null;
  if (!art) return nein(nurAuszahlung ? "Bitte wählen: ausgezahlt oder von der Kundin abgelehnt — eine Zusage allein erfüllt die Garantie nach Ziffer 7 nicht (Fassung D)." : "Bitte wählen: ausgezahlt, verbindlich zugesagt oder von der Kundin abgelehnt.");
  if (!am || am > l.heute) return nein("Datum (JJJJ-MM-TT, nicht in der Zukunft).");
  if (am > ende) return nein(`Das Datum liegt nach dem Fristende (${firmaTag(ende)}) — dann gilt der Garantiefall.`);
  const roh = String(ein?.betragUsd ?? "").trim();
  if (!/^\d+$|^\d{1,3}([.\s]\d{3})+$/.test(roh)) return nein("Betrag in ganzen US-Dollar ohne Cent (z. B. 250.000).");
  const betrag = Number(roh.replace(/[.\s]/g, ""));
  if (betrag < l.d.parameter.kapitalUsd) return nein(`Die erste Runde muss mindestens ${firmaUsd(l.d.parameter.kapitalUsd)} betragen.`);
  const beleg = text(ein?.beleg, 800);
  if (beleg.length < 20) return nein("Bitte den Beleg in einem Satz festhalten (mindestens 20 Zeichen) — intern, kein Bankname gegenüber der Kundin.");
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote SET garantie_erfuellt_am = ${am}::date, garantie_rahmen_usd = ${betrag}, garantie_beleg = ${`${art}: ${beleg}`},
           garantie_von = ${wer}, garantie_eingetragen_am = NOW(), updated_at = NOW()
     WHERE id = ${id} AND garantie_erfuellt_am IS NULL AND erstattung_ausgeloest_am IS NULL RETURNING id`) as any[];
  if (!frei) return nein("Schon eingetragen — oder der Garantiefall ist vorgemerkt.", 409);
  const satz = `Erste Runde ${art === "abgelehnt" ? "angeboten und von der Kundin abgelehnt (zählt als erhalten)" : art === "zugesagt" ? "verbindlich zugesagt" : "ausgezahlt"} am ${firmaTag(am)}: ${firmaUsd(betrag)} (Frist ${firmaTag(beginn)}–${firmaTag(ende)})`;
  await verlaufAngebot(id, wer, satz, { beleg });
  if (l.z.auftrag_ref) await globalVerlauf(String(l.z.auftrag_ref), `FIAON Global: ${satz} — Garantie erfüllt.`);
  return { ok: true, meldung: `${satz}. Die Garantie ist erfüllt; kein Garantiefall mehr.` };
}

export async function firmaFristHemmen(id: number, ein: any, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ fristEnde: string; tage: number }>> {
  const l = await lageLesen(id, opts.heute); if (!l) return nein("Dieses Angebot gibt es nicht.", 404);
  const k = knoepfeAus(l).hemmung; if (k) return nein(k, 409);
  const grund = text(ein?.grund, 500);
  if (grund.length < 20) return nein("Welche Mitwirkung fehlt? In einem Satz (mindestens 20 Zeichen) — die Frist ruht nur nach Aufforderung in Textform (Ziffer 7 Absatz 4).");
  const bisher = json<any[]>(l.z.verlauf, []).map((v) => (typeof v?.hemmungBis === "string" ? v.hemmungBis : null)).filter((x): x is string => !!x).sort().pop() ?? null;
  const erbracht = String(ein?.erbrachtAm ?? "").trim();
  const h = hemmungRechnen({ aufgefordertAm: String(ein?.aufgefordertAm ?? "").trim(), erbrachtAm: erbracht || null, heute: l.heute, bisher });
  if (!h.ok) return nein(h.error);
  const [r] = (await sqlPool`UPDATE fiaon_global_angebote SET frist_hemmung_tage = frist_hemmung_tage + ${h.tage}, frist_ende = frist_ende + ${h.tage}::int, updated_at = NOW() WHERE id = ${id} RETURNING frist_ende`) as any[];
  const ende = isoTag(r.frist_ende)!;
  await verlaufAngebot(id, wer, `Garantiefrist ruhte vom ${firmaTag(h.von)} bis ${firmaTag(h.bis)} (${h.tage} Tage): ${grund} — neues Fristende ${firmaTag(ende)}`, { hemmungVon: h.von, hemmungBis: h.bis, hemmungTage: h.tage });
  if (l.z.auftrag_ref) await globalVerlauf(String(l.z.auftrag_ref), `FIAON Global: Garantiefrist ruhte vom ${firmaTag(h.von)} bis ${firmaTag(h.bis)}. Neues Fristende ${firmaTag(ende)} — der Kundin in Textform mitteilen.`);
  return { ok: true, fristEnde: ende, tage: h.tage };
}

/** Der Garantiefall: Frist abgelaufen, erste Runde nicht erhalten → Erstattung der Gründung vormerken. Geld bewegt nur Justin. */
export async function firmaGarantiefall(id: number, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ meldung: string }>> {
  const l = await lageLesen(id, opts.heute); if (!l) return nein("Dieses Angebot gibt es nicht.", 404);
  const k = knoepfeAus(l).garantiefall; if (k) return nein(k, 409);
  const teil1 = (l.z.teile as any[]).find((x) => Number(x.nr) === 1);
  const betrag = Number(teil1?.betrag_cents ?? l.d.parameter.startCents);
  const ende = isoTag(l.z.frist_ende)!; const bis = plusTageIso(ende, l.d.parameter.erstattungTage);
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote SET erstattung_ausgeloest_am = NOW(), erstattung_ausgeloest_von = ${wer}, erstattung_cents = ${betrag}, updated_at = NOW()
     WHERE id = ${id} AND erstattung_ausgeloest_am IS NULL AND garantie_erfuellt_am IS NULL RETURNING id`) as any[];
  if (!frei) return nein("Schon vorgemerkt — oder die erste Runde wurde gerade eingetragen.", 409);
  const b1 = teil1?.bestell_ref ? await globalBestellungLesen(String(teil1.bestell_ref)) : null;
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: l.z.person_id != null ? Number(l.z.person_id) : null, ref: l.z.auftrag_ref ? String(l.z.auftrag_ref) : null,
    titel: `Erstattung veranlassen (Garantie): ${firmaEur(betrag)} an ${l.d.kunde.firma.name}`,
    text: [
      `GARANTIE (Ziffer 7 des Firmenangebots ${l.d.ref}): Die erste Runde über ${firmaUsd(l.d.parameter.kapitalUsd)} ist bis zum Fristende ${firmaTag(ende)} nicht eingetragen.`,
      `Zu erstatten: die Gründung, ${firmaEur(betrag)} (Zweck ${b1?.payment_reference ?? "—"}${b1?.invoice_number ? `, Rechnung ${b1.invoice_number}` : ""}) — vollständig, ohne Abzug, bis spätestens ${firmaTag(bis)} auf das Konto, von dem gezahlt wurde. Gutschrift mit der Buchhaltung klären.`,
      "Der Vertrag läuft weiter (Monatspauschale, Laufzeit) — die Erstattung ist die abschließende Folge der Garantie. Das System hat KEIN Geld bewegt. Danach „Erstattung überwiesen“ eintragen.",
    ].join("\n"),
    dringend: true, anBetreiber: true, faelligAm: bis, schluessel: `global:${l.d.ref}:erstattung`, bereich: "konten", quelle: "global", autorName: wer, link: CHEF_LINK,
  }).catch((e) => console.error(`[FIAON-FIRMA] ${l.d.ref}: Erstattungsaufgabe:`, e));
  await verlaufAngebot(id, wer, `Garantiefall vorgemerkt — Gründung ${firmaEur(betrag)} bis ${firmaTag(bis)} zu erstatten`);
  if (l.z.auftrag_ref) await globalVerlauf(String(l.z.auftrag_ref), `FIAON Global: Garantiefall des Firmenangebots ${l.d.ref} — Erstattung der Gründung (${firmaEur(betrag)}) bis ${firmaTag(bis)}.`);
  return { ok: true, meldung: `Garantiefall vorgemerkt: ${firmaEur(betrag)} bis ${firmaTag(bis)} zu erstatten. Justin hat die dringende Aufgabe — überwiesen wird von Hand. Der Kundin bitte schriftlich mitteilen.` };
}

/** Besteht eine Bürgschaft? Nur, wenn die erste Runde ausgezahlt oder zugesagt ist (nicht bei „abgelehnt“). Ihr Ende kennt das System nicht. */
function buergschaftBesteht(z: AngebotZeile): boolean {
  return !!z.garantie_erfuellt_am && !String(z.garantie_beleg ?? "").startsWith("abgelehnt:");
}
/** Das Ende der Umsatzbeteiligung (Quartalsende) aus Kündigung, Verkauf und Bürgschaft — oder null (läuft). */
export function firmaUmsatzEnde(l: Pick<Lage, "z" | "fr">): string | null {
  return umsatzBeteiligungEnde(l.fr, buergschaftBesteht(l.z));
}

export async function firmaUmsatz(id: number, ein: any, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ meldung: string; rechnungCents: number; gutschriftCents: number; schwelleCents: number; beteiligungJahrCents: number }>> {
  const l = await lageLesen(id, opts.heute); if (!l) return nein("Dieses Angebot gibt es nicht.", 404);
  const k = knoepfeAus(l).umsatz; if (k) return nein(k, 409);
  const starttag = l.sch.starttag!;
  const jahr = Number(ein?.jahr);
  const quartal: number | "jahr" = String(ein?.quartal) === "jahr" ? "jahr" : Number(ein?.quartal);
  const startJahr = Number(starttag.slice(0, 4)); const heuteJahr = Number(l.heute.slice(0, 4));
  if (!Number.isInteger(jahr) || jahr < startJahr || jahr > heuteJahr) return nein(`Kalenderjahr zwischen ${startJahr} und ${heuteJahr}.`);
  if (quartal !== "jahr" && (!Number.isInteger(quartal) || quartal < 1 || quartal > 4)) return nein("Quartal 1 bis 4 — oder „jahr“ für den Jahresabgleich.");
  const pEnde = quartal === "jahr" ? `${jahr}-12-31` : `${jahr}-${["03-31", "06-30", "09-30", "12-31"][quartal - 1]}`;
  if (pEnde >= l.heute) return nein(`Gemeldet wird nach dem Ende des Zeitraums (${firmaTag(pEnde)}).`);
  if (pEnde < `${starttag.slice(0, 7)}-01`) return nein(`Dieser Zeitraum endet vor dem Monat des Starttags (${firmaTag(starttag)}) — dafür gibt es keine Umsatzbeteiligung.`);
  // Ziffer 11 Absatz 8: Nach dem Ende der Beteiligung gibt es keine Quartalsmeldung mehr; das Jahr des Endes wird noch abgeglichen.
  const ende = firmaUmsatzEnde(l);
  if (ende && (quartal === "jahr" ? jahr > Number(ende.slice(0, 4)) : pEnde > ende)) return nein(`Die Umsatzbeteiligung endete am ${firmaTag(ende)} (Ziffer 11 Absatz 8) — für ${quartal === "jahr" ? `das Jahr ${jahr}` : `Q${quartal} ${jahr}`} gibt es keine Beteiligung.`, 409);
  const betrag = betragAus(ein, "kumuliertCents", "kumuliert");
  if (betrag.fehler) return nein(betrag.fehler);
  const kumuliert = betrag.cents;
  if (kumuliert == null) return nein("Kumulierter Netto-Umsatz des Kalenderjahres in Euro (z. B. 812.345,00).");
  const beleg = text(ein?.beleg, 600);
  if (beleg.length < 10) return nein("Beleg in einem Satz (z. B. „UVA Q3 2027 vom 12.10.2027 liegt im Dokumentenraum“).");
  const zeitraum = quartal === "jahr" ? `Jahr ${jahr}` : `Q${quartal} ${jahr}`;
  const titel = FIRMA_TEIL_TITEL.umsatz(jahr, quartal);
  const meldungen = l.fr.umsatzMeldungen ?? {};
  if (meldungen[`Jahr ${jahr}`]) return nein(`Das Jahr ${jahr} ist schon abgeglichen (${firmaTag(meldungen[`Jahr ${jahr}`].am)}).`, 409);
  if (meldungen[zeitraum]) return nein(`Für ${zeitraum} ist schon eine Meldung eingetragen (${firmaTag(meldungen[zeitraum].am)}).`, 409);
  const vorher = (await sqlPool`
    SELECT betrag_cents, bemessung_cents, zeitraum FROM fiaon_global_angebot_teile
     WHERE angebot_id = ${id} AND faelligkeit = 'umsatz' AND entfallen_am IS NULL AND zeitraum LIKE ${`% ${jahr}`}`) as any[];
  if (vorher.some((t) => String(t.zeitraum) === zeitraum)) return nein(`Für ${zeitraum} ist schon eine Beteiligung abgerechnet.`, 409);
  if (vorher.some((t) => String(t.zeitraum) === `Jahr ${jahr}`)) return nein(`Das Jahr ${jahr} ist schon abgeglichen.`, 409);
  const ausJahr = Object.entries(meldungen).filter(([z]) => z.endsWith(` ${jahr}`)).map(([, m]) => m);
  const letzteKum = Math.max(0, ...vorher.map((t) => Number(t.bemessung_cents ?? 0)), ...ausJahr.map((m) => Number(m.kumuliertCents ?? 0)));
  if (quartal !== "jahr" && kumuliert < letzteKum) return nein(`Der kumulierte Umsatz (${firmaEur(kumuliert)}) ist kleiner als bei der letzten Meldung (${firmaEur(letzteKum)}) — Korrekturen im Jahresabgleich.`);
  const bereits = vorher.reduce((s2, t) => s2 + Number(t.betrag_cents), 0);
  const sw = umsatzSchwelleJahr(l.d.parameter, jahr, starttag, ende);
  const r = umsatzBeteiligungRechnen({ kumuliertCents: kumuliert, schwelleCents: sw.schwelleCents, satzProzent: l.d.parameter.umsatzSatzProzent, bereitsCents: bereits });
  const rechen = `kumuliert ${firmaEur(kumuliert)}, Schwelle ${firmaEur(sw.schwelleCents)} (${sw.monate}/12), ${l.d.parameter.umsatzSatzProzent} % = ${firmaEur(r.beteiligungJahrCents)} im Jahr, bereits ${firmaEur(bereits)}`;
  // Die Meldung zuerst festhalten — unabhängig vom Ergebnis (auch null oder Gutschrift), atomar: ein zweiter Klick findet sie.
  const marke = { am: l.heute, kumuliertCents: kumuliert, ergebnisCents: r.rechnungCents > 0 ? r.rechnungCents : -r.gutschriftCents, von: wer };
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote
       SET freigaben = jsonb_set(COALESCE(freigaben, '{}'::jsonb), '{umsatzMeldungen}',
                                 COALESCE(freigaben->'umsatzMeldungen', '{}'::jsonb) || ${jsonb({ [zeitraum]: marke })}), updated_at = NOW()
     WHERE id = ${id} AND NOT (COALESCE(freigaben->'umsatzMeldungen', '{}'::jsonb) ? ${zeitraum})
       AND NOT (COALESCE(freigaben->'umsatzMeldungen', '{}'::jsonb) ? ${`Jahr ${jahr}`})
     RETURNING id`) as any[];
  if (!frei) return nein(`Für ${zeitraum} ist gerade eine Meldung eingetragen worden.`, 409);
  let meldung: string;
  if (r.rechnungCents > 0) {
    const t = await nummernSperre(id, async () => {
      const [max] = (await sqlPool`SELECT COALESCE(MAX(nr), 1) AS m FROM fiaon_global_angebot_teile WHERE angebot_id = ${id}`) as any[];
      const [neu] = (await sqlPool`
        INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage, faellig_am, bemessung_cents, zeitraum, beleg, meilenstein_von)
        VALUES (${id}, ${Number(max.m) + 1}, ${titel}, ${r.rechnungCents}, 'umsatz', ${l.d.parameter.zahlungszielTage}, ${l.heute}::date, ${kumuliert}, ${zeitraum}, ${beleg}, ${wer})
        RETURNING id`) as any[];
      return neu;
    });
    await verlaufAngebot(id, wer, `Umsatz ${zeitraum} eingetragen: ${rechen} → Rechnung ${firmaEur(r.rechnungCents)}`, { beleg });
    const rb = await firmaTeilBerechnen(id, Number(t.id), wer);
    meldung = rb.ok ? `${zeitraum}: ${rechen}. ${rb.meldung}` : `${zeitraum}: Beteiligung ${firmaEur(r.rechnungCents)} eingetragen — die Rechnung hing: ${rb.error} (der Teil steht; bitte im Chefbüro „Rechnung jetzt stellen“).`;
  } else if (r.gutschriftCents > 0) {
    await verlaufAngebot(id, wer, `Jahresabgleich ${jahr}: ${rechen} → Gutschrift ${firmaEur(r.gutschriftCents)}`, { beleg });
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: l.z.person_id != null ? Number(l.z.person_id) : null, ref: l.z.auftrag_ref ? String(l.z.auftrag_ref) : null,
      titel: `Gutschrift Umsatzbeteiligung ${jahr}: ${firmaEur(r.gutschriftCents)} an ${l.d.kunde.firma.name}`,
      text: `Jahresabgleich ${jahr} (Ziffer 11 Absatz 6): ${rechen}. FIAON erstattet ${firmaEur(r.gutschriftCents)} binnen vierzehn Tagen. Gutschrift mit der Buchhaltung, Überweisung von Hand.`,
      dringend: true, anBetreiber: true, schluessel: `global:${l.d.ref}:umsatz-gutschrift-${jahr}`, bereich: "konten", quelle: "global", autorName: wer, link: CHEF_LINK,
    }).catch((e) => console.error(`[FIAON-FIRMA] ${l.d.ref}: Gutschrift:`, e));
    meldung = `Jahresabgleich ${jahr}: ${rechen} — Gutschrift ${firmaEur(r.gutschriftCents)} an die Kundin (Aufgabe an Justin).`;
  } else {
    await verlaufAngebot(id, wer, `Umsatz ${zeitraum} eingetragen: ${rechen} → keine Beteiligung`, { beleg });
    meldung = `${zeitraum}: ${rechen} — keine Beteiligung fällig.`;
  }
  return { ok: true, meldung, rechnungCents: r.rechnungCents, gutschriftCents: r.gutschriftCents, schwelleCents: sw.schwelleCents, beteiligungJahrCents: r.beteiligungJahrCents };
}

/** Wer veräußert (Pflichtfeld „Verkauf eintragen“, Ziffer 12 Absatz 5) — die Auftraggeberin oder ihre Gesellschafter. */
export type FirmaVeraeusserer = "auftraggeberin" | "gesellschafter";
export async function firmaVerkauf(id: number, ein: any, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ meldung: string; betragCents: number; teilId: number; rechnung: boolean }>> {
  const l = await lageLesen(id, opts.heute); if (!l) return nein("Dieses Angebot gibt es nicht.", 404);
  const k = knoepfeAus(l).verkauf; if (k) return nein(k, 409);
  // Pflicht: Wer veräußert? Die Auftraggeberin schuldet nur für eigene Verkäufe (Marke, Betrieb, Anteile an der
  // US-Gesellschaft); verkaufen Gesellschafter, schulden SIE nach ihrer Beitrittserklärung — keine Rechnung an die Firma.
  const veraeusserer = String(ein?.veraeusserer ?? "");
  if (veraeusserer !== "auftraggeberin" && veraeusserer !== "gesellschafter") {
    return nein("Wer veräußert? Auftraggeberin (Marke, Betrieb, Anteile an der US-Gesellschaft) oder Gesellschafter (ihre Anteile) — Pflichtfeld (Ziffer 12 Absatz 5).");
  }
  const betrag0 = betragAus(ein, "gegenleistungCents", "gegenleistung");
  if (betrag0.fehler) return nein(betrag0.fehler);
  const gegen = betrag0.cents;
  if (gegen == null || gegen <= 0) return nein("Zugeflossene Gegenleistung in Euro (z. B. 2.000.000,00).");
  const am = tagOk(ein?.am);
  if (!am || am > l.heute) return nein("Tag des Zuflusses (JJJJ-MM-TT, nicht in der Zukunft).");
  const beleg = text(ein?.beleg, 600);
  if (beleg.length < 20) return nein("Beleg in einem Satz (mindestens 20 Zeichen) — Kaufvertrag, Zufluss.");
  // Ziffer 11 Absatz 8: Geht mehr als die Hälfte der Anteile oder der Betrieb im Ganzen über, endet die Umsatzbeteiligung.
  const endetUmsatz = ein?.endetUmsatz === true || ein?.endetUmsatz === "ja";
  const betrag = verkaufBeteiligungRechnen(gegen, l.d.parameter.verkaufSatzProzent);
  const gesellschafter = veraeusserer === "gesellschafter";
  const zeitraum = `Zufluss ${firmaTag(am)}`;
  // Doppelbuchungsschutz (Gegenprüfung 07.10.2026): unter derselben Sperre wie die Nummer — derselbe Zufluss mit derselben
  // Gegenleistung steht nur einmal. Ein zweiter Klick nach einem Fehler bekommt 409 und den Hinweis auf den vorhandenen Teil.
  const t = await nummernSperre(id, async () => {
    const [schon] = (await sqlPool`
      SELECT id, nr FROM fiaon_global_angebot_teile
       WHERE angebot_id = ${id} AND faelligkeit = 'verkauf' AND entfallen_am IS NULL AND bemessung_cents = ${gegen} AND zeitraum = ${zeitraum}
       LIMIT 1`) as any[];
    if (schon) return { doppelt: Number(schon.nr) } as const;
    const [max] = (await sqlPool`SELECT COALESCE(MAX(nr), 1) AS m FROM fiaon_global_angebot_teile WHERE angebot_id = ${id}`) as any[];
    const [neu] = (await sqlPool`
      INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage, faellig_am, bemessung_cents, zeitraum, beleg, meilenstein_von, schuldner)
      VALUES (${id}, ${Number(max.m) + 1}, ${FIRMA_TEIL_TITEL.verkauf}, ${betrag}, 'verkauf', ${l.d.parameter.zahlungszielTage}, ${l.heute}::date, ${gegen}, ${zeitraum}, ${beleg}, ${wer},
              ${gesellschafter ? "gesellschafter" : null})
      RETURNING id`) as any[];
    return { id: Number(neu.id) } as const;
  });
  if ("doppelt" in t) {
    return nein(`Dieser Verkauf (${firmaEur(gegen)}, ${zeitraum}) steht schon als Teil ${t.doppelt} — hing die Rechnung, dort „Rechnung jetzt stellen“.`, 409);
  }
  // Ein früherer Verkauf, der die Umsatzbeteiligung schon beendet hat, bleibt maßgeblich.
  if (!l.fr.verkauf?.endetUmsatz) await freigabeSetzen(id, { verkauf: { am, von: wer, endetUmsatz } });
  const satz = `${l.d.parameter.verkaufSatzProzent} % = ${firmaEur(betrag)}`;
  const ende = endetUmsatz ? ` — Mehrheit bzw. Betrieb im Ganzen: Umsatzbeteiligung endet zum ${firmaTag(quartalsEnde(am))}` : "";
  if (gesellschafter) {
    await verlaufAngebot(id, wer, `Verkauf durch Gesellschafter eingetragen: Gegenleistung ${firmaEur(gegen)} zugeflossen am ${firmaTag(am)} → ${satz} vorgemerkt, KEINE Rechnung an die Firma (Ziffer 12 Absatz 5)${ende}`, { beleg });
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: l.z.person_id != null ? Number(l.z.person_id) : null, ref: l.z.auftrag_ref ? String(l.z.auftrag_ref) : null,
      titel: `Verkaufsbeteiligung (Gesellschafter): ${firmaEur(betrag)} — ${l.d.kunde.firma.name}`,
      text: [
        `${wer} hat einen Verkauf durch Gesellschafter eingetragen: Gegenleistung ${firmaEur(gegen)}, zugeflossen am ${firmaTag(am)} → ${satz} (Teil ${t.id}).`,
        "Schuldner sind die veräußernden Gesellschafter nach ihrer Beitrittserklärung zu Ziffer 12 — NICHT die Firma. Das System hat KEINE Rechnung gestellt.",
        "Bitte von Hand klären: Liegt die Beitrittserklärung vor, wer genau schuldet, Rechnung an wen, Umsatzsteuer (kein Reverse Charge der Firma). Beleg: " + beleg,
      ].join("\n"),
      dringend: true, anBetreiber: true, schluessel: `global:${l.d.ref}:verkauf-gesellschafter:${t.id}`, bereich: "konten", quelle: "global", autorName: wer, link: CHEF_LINK,
    }).catch((e) => console.error(`[FIAON-FIRMA] ${l.d.ref}: Aufgabe Verkauf durch Gesellschafter:`, e));
    return { ok: true, betragCents: betrag, teilId: t.id, rechnung: false, meldung: `Verkaufsbeteiligung ${firmaEur(betrag)} (${l.d.parameter.verkaufSatzProzent} % von ${firmaEur(gegen)}) vorgemerkt — Verkauf durch Gesellschafter: keine Rechnung an die Firma, Justin hat die Aufgabe.` };
  }
  await verlaufAngebot(id, wer, `Verkauf durch die Auftraggeberin eingetragen: Gegenleistung ${firmaEur(gegen)} zugeflossen am ${firmaTag(am)} → ${satz}${ende}`, { beleg });
  const rb = await firmaTeilBerechnen(id, t.id, wer);
  return { ok: true, betragCents: betrag, teilId: t.id, rechnung: rb.ok, meldung: rb.ok ? `Verkaufsbeteiligung ${firmaEur(betrag)} (${l.d.parameter.verkaufSatzProzent} % von ${firmaEur(gegen)}). ${rb.meldung}` : `Verkaufsbeteiligung ${firmaEur(betrag)} eingetragen — die Rechnung hing: ${rb.error} (im Chefbüro „Rechnung jetzt stellen“).` };
}

export async function firmaKuendigung(id: number, ein: any, wer: string, opts: { heute?: string } = {}): Promise<Ergebnis<{ meldung: string; zum: string }>> {
  const l = await lageLesen(id, opts.heute); if (!l) return nein("Dieses Angebot gibt es nicht.", 404);
  const kn = knoepfeAus(l); const k = kn.kuendigung; if (k) return nein(k, 409);
  // Ohne Starttag (vor „Shop live“) nur aus wichtigem Grund — dann entstehen keine Monatsteile (Gegenprüfung 08.10.2026, Fund 3).
  const starttag = l.sch.starttag;
  const am = tagOk(ein?.am);
  if (!am || am > l.heute) return nein("Eingang der Kündigung in Textform (JJJJ-MM-TT, nicht in der Zukunft).");
  const seite = String(ein?.seite || "auftraggeberin");
  const art = String(ein?.art || "ordentlich");
  if (seite !== "auftraggeberin" && seite !== "fiaon") return nein("Wer kündigt: Auftraggeberin oder FIAON.");
  if (art !== "ordentlich" && art !== "ausserordentlich") return nein("Art der Kündigung: ordentlich oder aus wichtigem Grund.");
  if (art === "ordentlich" && kn.kuendigungOrdentlich) return nein(kn.kuendigungOrdentlich, 409);
  const gewuenscht = tagOk(ein?.zum);
  let zum: string; let monate: number;
  let garantieEntfaellt = false;
  if (art === "ordentlich") {
    if (!starttag) return nein("Ordentlich erst ab dem Starttag („Shop live“) — vorher nur aus wichtigem Grund.", 409); // doppelt gesichert (kuendigungOrdentlich)
    const w = kuendigungWirksamZum(starttag, l.d.parameter, am);
    zum = w.zum; monate = w.monateGesamt;
    if (gewuenscht) {
      if (gewuenscht < w.zum) return nein(`Frühestmöglich zum ${firmaTag(w.zum)} (Kündigung ${monateWort(l.d.parameter.kuendigungMonate)} vor Ablauf).`);
      let m = w.monateGesamt; let gefunden = false;
      for (let i = 0; i < 100 && !gefunden; i++) { if (laufzeitEnde(starttag, m) === gewuenscht) gefunden = true; else m += l.d.parameter.verlaengerungMonate; }
      if (!gefunden) return nein(`Kündigung nur zum Ende einer Laufzeit — frühestens zum ${firmaTag(w.zum)}.`);
      zum = gewuenscht; monate = m;
    }
  } else {
    // Aus wichtigem Grund (Ziffer 14 Absatz 3): wirkt zum genannten Tag, frühestens am Tag des Eingangs. Die Garantie entfällt,
    // wenn die Auftraggeberin kündigt, ohne dass FIAON den Grund gegeben hat, oder FIAON aus einem Grund kündigt, den die
    // Auftraggeberin zu vertreten hat — beides bestätigt die Leitung mit „garantieEntfaellt“ (Vorgabe: ja).
    zum = gewuenscht ?? am;
    if (zum < am) return nein("Eine Kündigung aus wichtigem Grund wirkt frühestens am Tag ihres Eingangs.");
    const vorhanden = (l.z.teile as any[]).filter((t) => String(t.faelligkeit) === "monatlich").length;
    monate = vorhanden;
    garantieEntfaellt = ein?.garantieEntfaellt !== false && ein?.garantieEntfaellt !== "nein";
  }
  if (starttag) await monatsteileBis(id, l.d, starttag, monate);
  await freigabeSetzen(id, { kuendigung: { am, zum, von: wer, seite: seite as "auftraggeberin" | "fiaon", art: art as "ordentlich" | "ausserordentlich", garantieEntfaellt } });
  const weg = (await sqlPool`
    UPDATE fiaon_global_angebot_teile SET entfallen_am = NOW(), entfallen_grund = ${`Kündigung vom ${firmaTag(am)} zum ${firmaTag(zum)}`}
     WHERE angebot_id = ${id} AND faelligkeit = 'monatlich' AND bestell_ref IS NULL AND entfallen_am IS NULL AND faellig_am > ${zum}::date RETURNING id`) as any[];
  const wer2 = seite === "fiaon" ? "FIAON" : "die Auftraggeberin";
  const artText = art === "ordentlich" ? "ordentliche Kündigung" : `Kündigung aus wichtigem Grund${garantieEntfaellt ? " — die Garantie entfällt, wenn der Vertrag vor dem Fristende endet (Ziffer 14 Absatz 3)" : " — die Garantie bleibt (der Grund liegt bei FIAON)"}`;
  const vorStart = starttag ? "" : " Vor dem Starttag gekündigt: Es beginnt kein Wachstumsbudget mehr („Shop live“ ist gesperrt).";
  await verlaufAngebot(id, wer, `Kündigung durch ${wer2} eingegangen am ${firmaTag(am)} — wirksam zum ${firmaTag(zum)} (${artText}); ${weg.length} Monatsteile entfallen${vorStart}`);
  if (l.z.auftrag_ref) await globalVerlauf(String(l.z.auftrag_ref), `FIAON Global: ${art === "ordentlich" ? "Ordentliche Kündigung" : "Kündigung aus wichtigem Grund"} des Firmenangebots ${l.d.ref} durch ${wer2} vom ${firmaTag(am)}, wirksam zum ${firmaTag(zum)}. Eingang in Textform bestätigen; Übergabe der Zugänge und US-Dienste vorbereiten (Ziffer 14 Absatz 4).`);
  return { ok: true, zum, meldung: `Kündigung eingetragen (${artText}): wirksam zum ${firmaTag(zum)}. ${weg.length} Monatsteile danach entfallen.${vorStart} Bitte den Eingang schriftlich bestätigen.` };
}

// ═══════════════════════════════════════════════════════════════════════════
// RECHNUNGSZEILE, „MEIN AUFTRAG“, LISTE DER LEITUNG
// ═══════════════════════════════════════════════════════════════════════════
export async function firmaRechnungsZeile(ref: string): Promise<{ beschreibung: string; zeitraum: string } | null> {
  const [t] = (await sqlPool`
    SELECT t.titel, t.faelligkeit, t.zeitraum, t.bemessung_cents, a.angebot_ref, a.auftrag_ref
      FROM fiaon_global_angebot_teile t JOIN fiaon_global_angebote a ON a.id = t.angebot_id
     WHERE t.bestell_ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  if (!t) return null;
  return firmaRechnungsText({ angebotRef: String(t.angebot_ref), auftragRef: String(t.auftrag_ref || ref), faelligkeit: String(t.faelligkeit), titel: String(t.titel), zeitraum: t.zeitraum ?? null, bemessungCents: t.bemessung_cents != null ? Number(t.bemessung_cents) : null });
}

/**
 * Die Zeile zum Wachstumsbudget in „Mein Auftrag“. Fassung D (Ziffer 10 Absatz 2): Starttag = Tag „Shop live“, spätestens
 * budgetSpaetestensMonate nach der Annahme — der Satz nennt beides (Gegenprüfung 08.10.2026, Fund 1). Ältere Fassungen unverändert.
 */
export function firmaTeil2Bedingung(d: Pick<FirmaDaten, "fassung" | "parameter">): string {
  const anteil = `Wachstumsbudget: Ihr Anteil ${firmaEur(d.parameter.monatCents)} pro Monat im Voraus`;
  return budgetSpaetestensGilt(d.fassung)
    ? `${anteil} ab dem Starttag („Shop live“, spätestens ${monateWort(d.parameter.budgetSpaetestensMonate)} nach Annahme)`
    : `${anteil} ab dem Tag „Shop live“`;
}
/** „Mein Auftrag“: Teile mit Stand, Garantiefrist, Bürgin — dieselben Schlüssel wie beim Individualangebot. */
export async function firmaSichtZurAkte(z: AngebotZeile): Promise<Record<string, unknown>> {
  const d = firmaDatenAus(z);
  const teile = await Promise.all((z.teile as any[]).filter((x) => x.bestell_ref || String(x.faelligkeit) === "sofort").map(async (x) => {
    const b = x.bestell_ref ? await globalBestellungLesen(String(x.bestell_ref)) : null;
    const stand = x.entfallen_am ? "entfallen" : b ? (String(b.payment_status) === "paid" ? "bezahlt" : ["cancelled", "superseded", "refunded"].includes(String(b.payment_status)) ? "storniert" : "offen") : "noch nicht fällig";
    return { nr: Number(x.nr), titel: String(x.titel), betragCents: Number(x.betrag_cents), stand, rechnungsnummer: b?.invoice_number ?? null, bestellRef: x.bestell_ref ?? null };
  }));
  return {
    art: "firma", ref: d.ref, teile, fristBeginn: isoTag(z.frist_beginn), fristEnde: isoTag(z.frist_ende), buergin: d.buergin.name,
    erstattungAusgeloest: !!z.erstattung_ausgeloest_am,
    teil2Bedingung: firmaTeil2Bedingung(d),
    garantieZiel: `erste Runde über ${firmaUsd(d.parameter.kapitalUsd)} für die US-Gesellschaft`,
    garantieErfuelltAm: isoTag(z.garantie_erfuellt_am),
    erstattungCents: z.erstattung_cents != null ? Number(z.erstattung_cents) : null,
    startgespraech: await import("./fiaon-global-angebot-startgespraech").then(async (m) => m.startgespraechFuerKunde(await m.startgespraechStand(Number(z.id)))).catch(() => null),
  };
}

/**
 * Justin (07.10.2026): „Link nur an Justin.“ Solange der Versand eines OFFENEN Firmenangebots gesperrt ist (Registerauszug
 * „Active“ oder Freigabe des Anwalts fehlt), bekommt den vollen Kundenlink in der Liste nur die Stufe „inhaber“ — jede andere
 * Stufe sieht den Grund der Sperre, aber keinen Link (Nachprüfung 08.10.2026). Rein: Individualangebote, freie und angenommene
 * Firmenangebote bleiben, wie sie sind.
 */
export function firmaListeFuerStufe<T extends Record<string, unknown>>(eintraege: T[], stufe: string | null | undefined): T[] {
  if (stufe === "inhaber") return eintraege;
  return eintraege.map((e) => (e?.art === "firma" && e.status === "offen" && e.versandSperre && e.link ? { ...e, link: null, linkNurInhaber: true } : e));
}

/** Der Eintrag eines Firmenangebots in der Liste der Leitung (Reiter „Individualangebote“). Rein — alles Gelesene kommt herein. */
export function firmaListenEintrag(z: AngebotZeile, teile: any[], ext: { fr: FirmaFreigaben; heute: string; aufrufe: unknown; startgespraech: unknown }): Record<string, unknown> {
  const d = firmaDatenAus(z); const sch = schalterAus(z); const fr = ext.fr;
  const status = angebotStatusAus(z, ext.heute);
  const fehlt = firmaPflichtFehlen(d);
  const t1 = teile.find((t) => Number(t.nr) === 1);
  const gruendungBezahlt = String(t1?.payment_status) === "paid";
  const monate = teile.filter((t) => String(t.faelligkeit) === "monatlich" && !t.entfallen_am).length;
  const teilAus = (t: any) => ({
    id: Number(t.id), nr: Number(t.nr), titel: String(t.titel), betragCents: Number(t.betrag_cents), faelligkeit: String(t.faelligkeit),
    faelligAm: isoTag(t.faellig_am) ?? (t.payment_due_date ? berlinToday(new Date(t.payment_due_date)) : null), zeitraum: t.zeitraum ?? null,
    zahlungszielTage: Number(t.zahlungsziel_tage), bestellRef: t.bestell_ref ?? null, verwendungszweck: t.payment_reference ?? null,
    rechnungsnummer: t.invoice_number ?? null, zahlungsstatus: t.payment_status ?? null, zahlbarBis: t.payment_due_date ? berlinToday(new Date(t.payment_due_date)) : null,
    bezahltAm: t.bezahlt_am ? new Date(t.bezahlt_am).toISOString() : (String(t.payment_status) === "paid" && t.completed_at ? new Date(t.completed_at).toISOString() : null),
    entfallenAm: t.entfallen_am ? new Date(t.entfallen_am).toISOString() : null, entfallenGrund: t.entfallen_grund ?? null,
    bemessungCents: t.bemessung_cents != null ? Number(t.bemessung_cents) : null, beleg: t.beleg ?? null, schuldner: t.schuldner ?? null,
    rechnungUrl: t.bestell_ref && rechnungSteht(t.payment_status) ? `/api/fiaon/admin/global/auftraege/${encodeURIComponent(String(t.bestell_ref))}/rechnung.pdf` : null,
    // Knopf „Rechnung jetzt stellen“ (Zustand vom Server): frei, wenn der Teil fällig ist und keine Rechnung trägt.
    rechnungKnopf: String(z.status) !== "angenommen" ? "Erst nach der Annahme."
      : Number(t.nr) === 1 ? "Die Gründung wird mit der Annahme berechnet."
      : t.entfallen_am ? "Entfallen."
      : String(t.schuldner ?? "") === "gesellschafter" ? "Schuldner sind die Gesellschafter — keine Rechnung an die Firma (Ziffer 12 Absatz 5)."
      : t.bestell_ref && (rechnungSteht(t.payment_status) || ["cancelled", "superseded", "refunded"].includes(String(t.payment_status))) ? "Rechnung steht."
      : isoTag(t.faellig_am) && isoTag(t.faellig_am)! > ext.heute ? `Fällig am ${firmaTag(isoTag(t.faellig_am))}.`
      : null,
  });
  const summe = (f: (t: any) => boolean) => teile.filter(f).reduce((s, t) => s + Number(t.betrag_cents), 0);
  const knoepfe = firmaKnoepfe({ status: String(z.status), fr, fristBeginn: isoTag(z.frist_beginn), fristEnde: isoTag(z.frist_ende), garantieErfuelltAm: isoTag(z.garantie_erfuellt_am), erstattungAusgeloest: !!z.erstattung_ausgeloest_am, gruendungBezahlt, heute: ext.heute, starttag: sch.starttag });
  return {
    art: "firma", id: Number(z.id), ref: d.ref, status, fassung: d.fassung, personId: z.person_id ?? null,
    kunde: d.kunde, kundeName: d.kunde.firma.name, vertreter: firmaVertreterName(d.kunde), email: d.kunde.email,
    parameter: { ...d.parameter, inhalt: undefined }, buergin: d.buergin, fehlt, annahmeBereit: fehlt.length === 0 && status === "offen",
    // Die Freigabe des Anwalts zählt nur für die Fassung, die er gesehen hat — verglichen mit den Prüfsummen von jetzt.
    versandSperre: firmaVersandSperre(d.buergin, fr, { textHash: firmaTextHash(d), anlage1: firmaAnlage1Pruefsumme(d), buergin: firmaBuerginPruefsumme(d.buergin) }), freigaben: fr,
    pruefsummeJetzt: firmaTextHash(d),
    gueltigBis: d.gueltigBis, erstelltAm: new Date(z.created_at).toISOString(), erstelltVon: z.erstellt_von ?? null,
    link: status === "offen" || status === "angenommen" ? absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(d.ref, d.gueltigBis))) : null,
    vertragUrl: `/api/fiaon/admin/global/angebote/${z.id}/vertrag.pdf`,
    pruefberichtUrl: d.compliance ? `/api/fiaon/admin/global/angebote/${z.id}/pruefbericht.pdf` : null,
    anlage1Url: `/api/fiaon/admin/global/angebote/${z.id}/anlage1.pdf`,
    anlage1Pruefsumme: firmaAnlage1Pruefsumme(d),
    compliance: d.compliance ? { ampel: d.compliance.gesamt.ampel, titel: d.compliance.gesamt.titel, bereiche: d.compliance.bereiche.length } : null,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null, ip: z.ip ?? null, textHash: z.text_hash ?? null,
    starttag: sch.starttag, startWahl: sch.startWahl, shopLiveAm: sch.shopLiveAm, garantieAbAnnahme: garantieAbAnnahme(d.fassung),
    garantieNurAuszahlung: garantieNurAuszahlung(d.fassung),
    spaetesterStart: budgetSpaetestensGilt(d.fassung) && z.angenommen_am ? budgetSpaetesterStart(berlinToday(new Date(z.angenommen_am)), d.parameter) : null,
    unterschrift: sch.unterschrift ? { art: sch.unterschrift.art, name: sch.unterschrift.name ?? null, am: sch.unterschrift.am ?? null, ip: sch.unterschrift.ip ?? null } : null,
    auftragRef: z.auftrag_ref ?? null, officeLink: z.auftrag_ref ? globalOfficeAuftragPfad(String(z.auftrag_ref)) : null,
    laufzeitEnde: sch.starttag && monate ? laufzeitEnde(sch.starttag, monate) : null,
    kuendigungSpaetestens: sch.starttag && monate && !fr.kuendigung ? kuendigungSpaetestens(laufzeitEnde(sch.starttag, monate), d.parameter.kuendigungMonate) : null,
    garantie: {
      bedingungenErfuelltAm: fr.bedingungenErfuelltAm ?? null, fristBeginn: isoTag(z.frist_beginn), fristEnde: isoTag(z.frist_ende), ruhtTage: Number(z.frist_hemmung_tage || 0),
      erfuelltAm: isoTag(z.garantie_erfuellt_am), betragUsd: z.garantie_rahmen_usd != null ? Number(z.garantie_rahmen_usd) : null,
      erstattungAusgeloestAm: z.erstattung_ausgeloest_am ? new Date(z.erstattung_ausgeloest_am).toISOString() : null,
      erstattungCents: z.erstattung_cents != null ? Number(z.erstattung_cents) : null, erstattetAm: isoTag(z.erstattet_am), erstattungNotiz: z.erstattung_notiz ?? null,
    },
    summen: { gestellt: summe((t) => !!t.bestell_ref && !t.entfallen_am && rechnungSteht(t.payment_status)), bezahlt: summe((t) => String(t.payment_status) === "paid") },
    teile: teile.sort((a, b) => Number(a.nr) - Number(b.nr)).map(teilAus),
    knoepfe,
    nacharbeitFehler: z.nacharbeit_fehler ?? null,
    zurueckgezogenAm: z.zurueckgezogen_am ? new Date(z.zurueckgezogen_am).toISOString() : null, zurueckgezogenGrund: z.zurueckgezogen_grund ?? null,
    verlauf: json<any[]>(z.verlauf, []).slice(-15),
    aufrufe: ext.aufrufe ?? null,
    startgespraech: ext.startgespraech ?? null,
    landName: FIRMA_LAND_NAME[d.kunde.firma.land] ?? d.kunde.firma.land,
    startSpaetestensTage: FIRMA_START_SPAETESTENS_TAGE,
  };
}
