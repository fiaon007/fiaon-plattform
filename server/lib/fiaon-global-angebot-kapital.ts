// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS KAPITAL-ANGEBOT FÜR FIRMENKUNDEN: ABLAUF (Register E-399, 19.10.2026)
//
// Texte, Vertrag und Regeln: shared/fiaon-global-angebot-kapital.ts. Gebaut wie Begleit-/Kooperationsvertrag; der Weg des
// Individualangebots wird nur an den Verzweigungsstellen berührt:
//   if (istKapitalFassung(z.fassung)) return (await import("./fiaon-global-angebot-kapital")).kapital…(…)
//
// ── DER WEG ───────────────────────────────────────────────────────────────
//   Anlegen NUR per Skript (scripts/angebot-kapital-anlegen.ts: Kunde, Bürgin, Parameter, Prüfbericht aus privaten Dateien) →
//   Teil 1 (Festpreis) steht sofort in fiaon_global_angebot_teile → signierter Link → Seite /business/angebot/:token mit
//   Compliance-Bühne → Annahme mit LLC-Namen, „vertretungsberechtigt“, „gelesen“, Unterschrift und Prüfsumme →
//   Vertrags-PDF mit Annahmevermerk → kapitalFertigstellen: Bestellzeile global_individuell (Betrag aus Teil 1), Akte mit
//   bestaetigungen.firmenangebot (E-301: keine automatische Kundenmail; E-350: Mara schweigt), Reverse Charge, Rechnung →
//   Aufgabe + Mail an Justin. Hängt ein Schritt, holt der Stundenlauf des Individualangebots ihn nach (auftrag_ref gesetzt).
// ═══════════════════════════════════════════════════════════════════════════
import { randomBytes } from "node:crypto";
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";
import { wrapFiaonDocument, htmlZuPdfMitFusszeile, docHash } from "./fiaon-html-pdf";
import { GLOBAL_VERTRAG_CSS } from "./fiaon-global-vertrag";
import { ANGEBOT_VERTRAG_CSS } from "./fiaon-global-angebot-vertrag";
import {
  ensureAngebotTabellen, angebotLesen, angebotTokenErzeugen, angebotKundenPfad, angebotStatusAus, verlaufAngebot,
  ANGEBOT_PAKET_KEY, firmaTeileCheckSichern, type AngebotZeile, type AnnahmeKontext,
} from "./fiaon-global-angebot";
import { firmaUnterschriftPruefen, firmaKundePruefen, firmaBestellzeileAnlegen } from "./fiaon-global-angebot-firma";
import { globalAkteLesen, globalBestellungLesen, globalMeinAuftragUrl, globalVerlauf } from "./fiaon-global-auftrag";
import { globalOfficeAuftragPfad } from "@shared/fiaon-global-wege";
import { zahlwort } from "@shared/fiaon-global-angebot-firma";
import { complianceKundenfassung, complianceHtml } from "@shared/fiaon-global-angebot-firma";
import type { ComplianceKundenfassung, FirmaKunde } from "@shared/fiaon-global-angebot-firma-typen";
import { llcWahlPruefen } from "@shared/fiaon-global-angebot-begleit";
import {
  KAPITAL_FASSUNG, KAPITAL_FASSUNGEN, KAPITAL_GUELTIG_TAGE, KAPITAL_KNOPF, KAPITAL_ANNAHME, KAPITAL_TEIL_TITEL,
  kapitalParameterAus, kapitalParameterFehler, kapitalBuerginFehler, kapitalPflichtFehlen, kapitalSeite, kapitalBestellUebersicht,
  kapitalAnnahmeTexte, kapitalAnsprechpartner, kapitalAnrede, kapitalVertretungName, kapitalVertragTitel, kapitalVertragUnterzeile,
  kapitalRumpfHtml, kapitalHashEingabe, kapitalEur, kapitalChf, kapitalTag, istKapitalFassung,
  KAPITAL_GEBUEHREN, KAPITAL_SPERRGRUND, kapitalGebuehrPruefen, istKapitalGebuehrArt, kapitalMitGebuehren, kapitalMeinAuftrag, type KapitalGebuehrArt,
  kapitalGarantieWochen, kapitalGarantieFrist, kapitalStartAufgabe, kapitalTeilBezahltVermerk,
  type KapitalDaten, type KapitalParameter, type KapitalBuergin, type KapitalAnnahmeVermerk, type KapitalWahl,
  type KapitalUnterschriftVermerk, type KapitalKundenSicht,
} from "@shared/fiaon-global-angebot-kapital";

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
const CHEF_LINK = "/chef/s/global-auftraege?reiter=angebote";
const STAAT_KURZ: Record<string, string> = { Florida: "FL", Wyoming: "WY", Delaware: "DE", "New Mexico": "NM" };

// ═══════════════════════════════════════════════════════════════════════════
// LESEN
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalBuerginAus(roh: any): KapitalBuergin {
  return {
    name: text(roh?.name, 160), bundesstaat: text(roh?.bundesstaat, 40), anschrift: text(roh?.anschrift, 200),
    registernummer: text(roh?.registernummer, 40), vertreter: text(roh?.vertreter, 120), funktion: text(roh?.funktion, 80),
  };
}
export function kapitalDatenAus(z: AngebotZeile): KapitalDaten {
  const roh = json<any>((z as any).pruefbericht, null);
  // Wie beim Firmenangebot: Die Kundenfassung läuft für ein OFFENES Angebot beim Lesen erneut (wiederholbar).
  const pb = roh && roh.art === "compliance" && String(z.status) === "offen" ? complianceKundenfassung(roh) : roh;
  return {
    ref: String(z.angebot_ref),
    fassung: String(z.status) === "offen" ? KAPITAL_FASSUNG : String(z.fassung),
    kunde: json<FirmaKunde>(z.kunde, {} as FirmaKunde),
    buergin: kapitalBuerginAus(json<any>(z.buergin, {})),
    parameter: kapitalParameterAus(json<Partial<KapitalParameter>>(z.parameter, {})),
    compliance: pb && pb.art === "compliance" ? (pb as ComplianceKundenfassung) : null,
    gueltigBis: isoTag(z.gueltig_bis) ?? berlinToday(),
  };
}
export function kapitalWahlAus(z: AngebotZeile): (KapitalWahl & { unterschrift: KapitalUnterschriftVermerk | null }) | null {
  const s = json<Record<string, any>>(z.schalter, {});
  if (!s.llc || typeof s.llc !== "object") return null;
  return {
    llc: { wunsch: String(s.llc.wunsch ?? ""), alternative1: String(s.llc.alternative1 ?? ""), alternative2: String(s.llc.alternative2 ?? "") },
    unterschrift: s.unterschrift && typeof s.unterschrift === "object" ? (s.unterschrift as KapitalUnterschriftVermerk) : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSUMME, HTML, PDF
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalTextHash(d: KapitalDaten): string { return docHash(kapitalHashEingabe(d, kapitalRumpfHtml(d, null), d.compliance)); }
const BILDSCHIRM_CSS = `${GLOBAL_VERTRAG_CSS}${ANGEBOT_VERTRAG_CSS}`;
function escape(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
export function kapitalVorschauHtml(d: KapitalDaten): string {
  return `<style>${BILDSCHIRM_CSS}</style>
<div class="gv" lang="de"><h1 class="gv-titel">${escape(kapitalVertragTitel())}</h1><p class="gv-unterzeile">${escape(kapitalVertragUnterzeile(d))}</p></div>
${kapitalRumpfHtml(d, null)}`;
}
const PDF_CSS = `
  body { font-weight: 400; color: #0f2044; }
  .wordmark { font-weight: 300; letter-spacing: .18em; color: #0f2044; font-size: 17pt; }
  header.doc { border-bottom: 1px solid #0f2044; }
  h1.doc-title { font-weight: 300; font-size: 15pt; line-height: 1.25; color: #0f2044; letter-spacing: -.01em; }
  .doc-subtitle { color: #64748b; text-align: left; }
  footer.doc { display: none; }
  ${BILDSCHIRM_CSS}
`;
const MARKENZEILE = "FIAON LTD · Company No. 17318250 · 128 City Road, London, EC1V 2NX, United Kingdom";
const RAND = { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" };
export async function kapitalVertragPdf(d: KapitalDaten, annahme: KapitalAnnahmeVermerk | null): Promise<Buffer> {
  const titel = kapitalVertragTitel();
  const anlage = d.compliance ? `<section class="gv-anlage" id="anlage" style="break-before:page;page-break-before:always"><h2>Anlage — Prüfbericht</h2>${complianceHtml(d.compliance, { ref: d.ref })}</section>` : "";
  const html = wrapFiaonDocument({
    documentTitle: titel, subtitle: kapitalVertragUnterzeile(d), bodyHtml: `${kapitalRumpfHtml(d, annahme)}<div class="gv" lang="de">${anlage}</div>`,
    watermark: annahme ? null : "Angebot — nicht angenommen", markenzeile: MARKENZEILE, zusatzCss: PDF_CSS,
  });
  return htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · Company No. 17318250 · Fassung ${d.fassung} · Angebot ${d.ref}${annahme ? "" : ` · Entwurf · Prüfsumme ${kapitalTextHash(d).slice(0, 12)}`}`, rand: RAND, keinNotbehelf: !!annahme });
}
export async function kapitalPruefberichtPdf(d: KapitalDaten): Promise<Buffer | null> {
  if (!d.compliance) return null;
  const titel = "Prüfbericht — Anlage";
  const html = wrapFiaonDocument({
    documentTitle: titel, subtitle: `Anlage zum Angebot ${d.ref} · ${d.kunde.firma.name}`,
    bodyHtml: complianceHtml(d.compliance, { ref: d.ref }), markenzeile: MARKENZEILE, zusatzCss: PDF_CSS,
  });
  return htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · Prüfbericht · Angebot ${d.ref}`, rand: RAND });
}
export async function kapitalPdfErzeugen(z: AngebotZeile, art: "vertrag" | "pruefbericht" | "anlage1"): Promise<{ status: number; pdf?: Buffer; dateiname?: string; error?: string }> {
  const d = kapitalDatenAus(z);
  if (art === "pruefbericht") {
    const pdf = await kapitalPruefberichtPdf(d);
    return pdf ? { status: 200, pdf, dateiname: `FIAON_Pruefbericht_${d.ref}.pdf` } : { status: 404, error: "Zu diesem Angebot liegt noch kein Prüfbericht vor." };
  }
  if (art !== "vertrag") return { status: 404, error: "Dieses Dokument gibt es zu diesem Angebot nicht." };
  if (String(z.status) === "angenommen") {
    const [r] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${z.id} LIMIT 1`) as any[];
    if (r?.vertrag_pdf) return { status: 200, pdf: Buffer.from(r.vertrag_pdf), dateiname: `FIAON_Global_Kapitalvertrag_${d.ref}.pdf` };
  }
  return { status: 200, pdf: await kapitalVertragPdf(d, null), dateiname: `FIAON_Global_Kapitalangebot_${d.ref}_Entwurf.pdf` };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLEGEN UND ÄNDERN (nur Skript)
// ═══════════════════════════════════════════════════════════════════════════
export async function kapitalAnlegen(ein: any, wer: string): Promise<Ergebnis<{ id: number; ref: string; link: string }>> {
  await ensureAngebotTabellen();
  const fassung = String(ein?.fassung || KAPITAL_FASSUNG);
  if (!(KAPITAL_FASSUNGEN as readonly string[]).includes(fassung)) return nein("Diese Fassung des Kapital-Angebots gibt es nicht.");
  const k = firmaKundePruefen(ein?.kunde);
  if (!k.ok) return nein(k.error);
  const parameter = kapitalParameterAus(ein?.parameter);
  const pf = kapitalParameterFehler(parameter);
  if (pf) return nein(pf);
  const buergin = kapitalBuerginAus(ein?.buergin);
  const bf = kapitalBuerginFehler(buergin);
  if (bf) return nein(`Fehlt: ${bf}`);
  const compliance = ein?.compliance ? complianceKundenfassung(ein.compliance) : null;
  const heute = berlinToday();
  const gueltigBis = ISO.test(String(ein?.gueltigBis ?? "")) ? String(ein.gueltigBis) : new Date(Date.parse(`${heute}T12:00:00Z`) + KAPITAL_GUELTIG_TAGE * 864e5).toISOString().slice(0, 10);
  if (gueltigBis < heute) return nein("Das Datum „gültig bis“ liegt in der Vergangenheit.");
  const personId = Number(ein?.personId);
  const ref = `FIAON-IA-C${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, pruefbericht, status, gueltig_bis, erstellt_von, verlauf)
    VALUES (${ref}, ${Number.isInteger(personId) && personId > 0 ? personId : null}, ${fassung}, ${jsonb(k.kunde)}, ${jsonb(parameter)}, ${jsonb(buergin)},
            ${compliance ? jsonb(compliance) : null}, 'offen', ${gueltigBis}::date, ${wer}, ${jsonb([{ am: new Date().toISOString(), wer, was: "Kapital-Angebot angelegt" }])})
    RETURNING id`) as any[];
  const id = Number(neu.id);
  await sqlPool`
    INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage)
    VALUES (${id}, 1, ${KAPITAL_TEIL_TITEL}, ${parameter.preisCents}, 'sofort', ${parameter.zahlungszielTage})
    ON CONFLICT (angebot_id, nr) DO NOTHING`;
  return { ok: true, id, ref, link: absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(ref, gueltigBis))) };
}
export async function kapitalAendern(id: number, ein: any, wer: string): Promise<Ergebnis<{ fehlt: string[] }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (String(z.status) !== "offen") return nein(`Das Angebot ist ${String(z.status)} — ändern geht nur, solange es offen ist.`, 409);
  const alt = kapitalDatenAus(z); const altHash = kapitalTextHash(alt);
  const neu: KapitalDaten = { ...alt }; const geaendert: string[] = [];
  if (ein?.parameter) { const par = kapitalParameterAus(ein.parameter, alt.parameter); const f = kapitalParameterFehler(par); if (f) return nein(f); neu.parameter = par; geaendert.push("Parameter"); }
  if (ein?.kunde) { const k = firmaKundePruefen(ein.kunde); if (!k.ok) return nein(k.error); neu.kunde = k.kunde; geaendert.push("Kunde"); }
  if (ein?.buergin) { const b = kapitalBuerginAus(ein.buergin); const f = kapitalBuerginFehler(b); if (f) return nein(`Fehlt: ${f}`); neu.buergin = b; geaendert.push("Bürgin"); }
  if (ein?.compliance) { neu.compliance = complianceKundenfassung(ein.compliance); geaendert.push("Prüfbericht"); }
  if (ein?.gueltigBis !== undefined) { const g = String(ein.gueltigBis); if (!ISO.test(g) || g < berlinToday()) return nein("„Gültig bis“: ein Datum ab heute."); neu.gueltigBis = g; geaendert.push("Gültigkeit"); }
  if (!geaendert.length) return nein("Es wurde nichts geändert.");
  await sqlPool`
    UPDATE fiaon_global_angebote SET kunde = ${jsonb(neu.kunde)}, parameter = ${jsonb(neu.parameter)}, buergin = ${jsonb(neu.buergin)},
           pruefbericht = ${neu.compliance ? jsonb(neu.compliance) : null}, gueltig_bis = ${neu.gueltigBis}::date, updated_at = NOW()
     WHERE id = ${id} AND status = 'offen'`;
  await sqlPool`UPDATE fiaon_global_angebot_teile SET betrag_cents = ${neu.parameter.preisCents}, zahlungsziel_tage = ${neu.parameter.zahlungszielTage}
                 WHERE angebot_id = ${id} AND nr = 1 AND bestell_ref IS NULL`;
  await verlaufAngebot(id, wer, `geändert: ${geaendert.join(", ")}`, { alterHash: altHash });
  return { ok: true, fehlt: kapitalPflichtFehlen(neu) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE (offen) und die Antwort nach der Annahme
// ═══════════════════════════════════════════════════════════════════════════
export async function kapitalKundenSicht(token: string, z: AngebotZeile, opts: { leitung?: boolean } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const d = kapitalDatenAus(z);
  const fehlt = kapitalPflichtFehlen(d);
  const k = d.kunde;
  const annahme = kapitalAnnahmeTexte(d);
  const t = encodeURIComponent(token);
  const body: KapitalKundenSicht = {
    ok: true, status: "offen", art: "kapital", ref: d.ref, fassung: d.fassung, gueltigBis: d.gueltigBis,
    kunde: { firma: k.firma.name, marke: k.firma.marke || k.firma.name, anrede: k.vertretung.anrede, vorname: k.vertretung.vorname, nachname: k.vertretung.nachname, email: k.email },
    kundeAnrede: kapitalAnrede(k),
    seite: kapitalSeite(d, token),
    compliance: d.compliance,
    ansprechpartner: kapitalAnsprechpartner(d.parameter).map((p) => ({ ...p, portrait: `/portraits/${p.kuerzel}.jpg` })),
    uebersicht: kapitalBestellUebersicht(d),
    annahme,
    annahmeBereit: fehlt.length === 0 && !opts.leitung,
    gesperrtGrund: fehlt.length ? annahme.gesperrt : null,
    ...(opts.leitung ? { vorschauLeitung: true, fehlt } : {}),
    html: kapitalVorschauHtml(d),
    textHash: kapitalTextHash(d),
    vertragPdf: `/api/fiaon/global/angebot/${t}/vertrag.pdf`,
    pruefberichtPdf: d.compliance ? `/api/fiaon/global/angebot/${t}/pruefbericht.pdf` : null,
  };
  return { status: 200, body: body as unknown as Record<string, unknown> };
}
/** Dieselben Felder wie die Antwort des Individualangebots nach der Annahme — die Ansicht „fertig“ ist dieselbe. */
export async function kapitalAngenommenAntwort(z: AngebotZeile): Promise<Record<string, unknown>> {
  const d = kapitalDatenAus(z);
  const w = kapitalWahlAus(z);
  const llc = w?.llc.wunsch || "Ihre Gesellschaft";
  const token = angebotTokenErzeugen(d.ref, d.gueltigBis);
  const ref1 = z.auftrag_ref ? String(z.auftrag_ref) : null;
  const b = ref1 ? await globalBestellungLesen(ref1).catch(() => null) : null;
  const zweck = b?.payment_reference ? String(b.payment_reference) : null;
  const bezahlt = String(b?.payment_status ?? "") === "paid";
  return {
    art: "kapital", startgespraech: null,
    ref: d.ref, auftragRef: ref1, email: d.kunde.email, sofortBeginn: true,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null,
    betragCents: d.parameter.preisCents,
    zahlungsseite: zweck ? `/zahlung/${encodeURIComponent(zweck)}?bereich=business` : null,
    // E-402: „Mein Auftrag“ — dort lädt er den Reisepass hoch (wir gründen auf ihn persönlich) und sieht die Rechnung.
    meinAuftrag: ref1 && (await globalAkteLesen(ref1).catch(() => null)) ? globalMeinAuftragUrl(ref1) : null, rechnungUrl: null,
    schrittTitel: KAPITAL_ANNAHME.schrittTitel, schrittText: KAPITAL_ANNAHME.schrittText, schrittKnopf: KAPITAL_ANNAHME.schrittKnopf,
    vertragUrl: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/vertrag.pdf`,
    fertigTitel: KAPITAL_ANNAHME.fertigTitel,
    fertigText: KAPITAL_ANNAHME.fertigText(d.kunde.email, llc),
    teil1Bezahlt: bezahlt,
    fertigZahlung: KAPITAL_ANNAHME.fertigZahlung,
    fertigFuss: KAPITAL_ANNAHME.fertigFuss,
    llc: w?.llc ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANNAHME (gerufen aus annehmen() im Individualangebot: Token, Status, Leitung und Honigtopf sind dort geprüft)
// ═══════════════════════════════════════════════════════════════════════════
export async function kapitalAnnehmen(z: AngebotZeile, body: any, kontext: AnnahmeKontext, helfer: { zuViel: (ip: string) => boolean }): Promise<{ status: number; body: Record<string, unknown> }> {
  const fehler = (status: number, error: string, extra: Record<string, unknown> = {}) => ({ status, body: { ok: false, error, ...extra } });
  const d = kapitalDatenAus(z);
  const texte = kapitalAnnahmeTexte(d);
  if (kapitalPflichtFehlen(d).length) return fehler(409, texte.gesperrt, { code: "PFLICHTFELDER" });
  if (helfer.zuViel(kontext.ip)) return fehler(429, "Von Ihrem Anschluss kamen gerade mehrere Versuche. Bitte versuchen Sie es in einigen Minuten noch einmal.");
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(kontext.ip, kontext.userAgent).roboter) {
    return fehler(403, "Diese Annahme können wir nicht entgegennehmen. Bitte öffnen Sie die Seite in Ihrem Browser und nehmen Sie dort an.");
  }
  const llc = llcWahlPruefen(body?.llc);
  if (!llc.ok) return fehler(400, llc.error, { code: "LLC", feld: llc.feld });
  if (body?.vertretung !== true) return fehler(400, KAPITAL_ANNAHME.fehltVertretung, { code: "HAEKCHEN", fehlt: ["vertretung"] });
  if (body?.gelesen !== true) return fehler(400, KAPITAL_ANNAHME.fehltGelesen, { code: "HAEKCHEN", fehlt: ["gelesen"] });
  const u = firmaUnterschriftPruefen(body?.unterschrift, d.kunde);
  if (!u.ok) return fehler(400, u.error, { code: u.code });
  const hash = kapitalTextHash(d);
  if (String(body?.textHash ?? "") !== hash) return fehler(409, KAPITAL_ANNAHME.neuLaden, { code: "GEAENDERT" });

  const jetzt = new Date();
  const wahl: KapitalWahl = { llc: llc.wahl };
  const unterschrift: KapitalUnterschriftVermerk = { ...u.vermerk, am: jetzt.toISOString(), ip: kontext.ip };
  let pdf: Buffer;
  try {
    pdf = await kapitalVertragPdf(d, { am: jetzt, ip: kontext.ip, userAgent: kontext.userAgent, hash, wahl, unterschrift });
    if (!pdf || pdf.length < 1000) throw new Error("PDF leer");
  } catch (e) {
    console.error(`[FIAON-KAPITAL] ${d.ref}: Vertrags-PDF:`, e);
    return fehler(500, "Ihr Vertrag konnte gerade nicht ausgefertigt werden — bitte versuchen Sie es in einer Minute noch einmal. Es wurde nichts gespeichert.");
  }
  const schalter = { ...wahl, vertretung: true, unternehmer: true, gelesen: true, unterschrift };
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote
       SET status = 'angenommen', angenommen_am = ${jetzt}, ip = ${kontext.ip}, user_agent = ${String(kontext.userAgent || "").slice(0, 500)},
           text_hash = ${hash}, schalter = ${jsonb(schalter)}, vertrag_pdf = ${pdf}, fassung = ${d.fassung}, updated_at = NOW()
     WHERE id = ${z.id} AND status = 'offen' AND gueltig_bis >= ${berlinToday()}::date AND updated_at::text = ${String(z.updated_at_txt)}
     RETURNING id`) as any[];
  if (!frei) {
    const neu = await angebotLesen({ id: Number(z.id) });
    if (neu && String(neu.status) === "angenommen") return { status: 200, body: { ok: true, schon: true, ...(await kapitalAngenommenAntwort(neu)) } };
    if (neu && String(neu.status) === "offen") return fehler(409, KAPITAL_ANNAHME.neuLaden, { code: "GEAENDERT" });
    return fehler(409, "Das Angebot lässt sich gerade nicht annehmen. Bitte laden Sie die Seite neu.");
  }
  await verlaufAngebot(Number(z.id), kapitalVertretungName(d.kunde), `angenommen (${KAPITAL_KNOPF}) — Prüfsumme ${hash.slice(0, 12)}…, LLC „${wahl.llc.wunsch}“${wahl.llc.alternative1 ? ` (Ausweich: ${[wahl.llc.alternative1, wahl.llc.alternative2].filter(Boolean).join(", ")})` : ""}, Unterschrift ${unterschrift.art}`);
  void import("./fiaon-global-angebot-aufrufe").then((m) => m.aufrufeAnnahmeVermerken(Number(z.id)))
    .catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Annahme in der Aufruf-Aufgabe:`, e));
  // Rechnung sofort (der Kunde liest gleich „Ihre Rechnung kommt“) — scheitert es, holt der Stundenlauf nach.
  await kapitalFertigstellen(Number(z.id)).catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Fertigstellen:`, e));
  void kapitalNacharbeit(Number(z.id)).catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Nacharbeit abgebrochen:`, e));
  return { status: 200, body: { ok: true, ...(await kapitalAngenommenAntwort((await angebotLesen({ id: Number(z.id) }))!)) } };
}

/**
 * Nach der Annahme: Bestellzeile (Teil 1), Akte, Rechnung — derselbe Weg wie firmaFertigstellen (E-301), ohne Monatsteile.
 * Wiederholbar: jede Stufe prüft, ob es sie schon gibt.
 */
export async function kapitalFertigstellen(id: number): Promise<{ ok: boolean; grund?: string }> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen" || !istKapitalFassung(z.fassung)) return { ok: false, grund: "nicht angenommen" };
  const d = kapitalDatenAus(z);
  const w = kapitalWahlAus(z);
  const sch = json<Record<string, any>>(z.schalter, {});
  const teil1 = ((z as any).teile as any[] | undefined)?.find((x) => Number(x.nr) === 1);
  if (!teil1) return { ok: false, grund: "Teil 1 fehlt" };
  try {
    let ref1 = teil1.bestell_ref ? String(teil1.bestell_ref) : (z.auftrag_ref ? String(z.auftrag_ref) : null);
    if (!ref1) {
      ref1 = `FIAON-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").slice(0, 4).toUpperCase()}`;
      await sqlPool`UPDATE fiaon_global_angebote SET auftrag_ref = ${ref1}, updated_at = NOW() WHERE id = ${id} AND auftrag_ref IS NULL`;
      const [r] = (await sqlPool`SELECT auftrag_ref FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
      ref1 = String(r.auftrag_ref);
    }
    const [da] = (await sqlPool`SELECT ref FROM fiaon_applications WHERE ref = ${ref1} LIMIT 1`) as any[];
    if (!da) {
      const ok = await firmaBestellzeileAnlegen(ref1, { kunde: d.kunde } as any, KAPITAL_TEIL_TITEL, { ip: String(z.ip || ""), userAgent: String(z.user_agent || "") });
      if (!ok) throw new Error("Bestellzeile ließ sich nicht anlegen");
    }
    await sqlPool`UPDATE fiaon_global_angebot_teile SET bestell_ref = ${ref1} WHERE angebot_id = ${id} AND nr = 1 AND bestell_ref IS NULL`;
    // ── Die Akte — Firmenkunde, bestaetigungen.firmenangebot = true (E-301: keine automatische Mail; E-350: Mara schweigt) ──
    if (!(await globalAkteLesen(ref1))) {
      const [pdfZeile] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
      const f = d.kunde.firma;
      const firma = { land: f.land, name: f.name, rechtsform: f.rechtsform, registergericht: f.registergericht, registernummer: f.registernummer, strasse: f.strasse, plz: f.plz, ort: f.ort, ustId: f.uid, website: null, quelleRegister: null };
      const ansprechpartner = { anrede: d.kunde.vertretung.anrede, vorname: d.kunde.vertretung.vorname, nachname: d.kunde.vertretung.nachname, funktion: d.kunde.vertretung.funktion, email: d.kunde.email, telefon: d.kunde.telefon };
      const bestaetigungen = { annahme: KAPITAL_KNOPF, unternehmer: true, vertretung: true, am: new Date(z.angenommen_am).toISOString(), firmenangebot: true, kapitalangebot: true,
        ...(sch.unterschrift ? { unterschrift: { art: sch.unterschrift.art, name: sch.unterschrift.name ?? null, am: sch.unterschrift.am ?? null } } : {}) };
      const pngM = String(sch.unterschrift?.png ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
      await sqlPool`
        INSERT INTO fiaon_global_auftraege
          (ref, paket_key, land, firma, ansprechpartner, ust_id, bestaetigungen, unterschrift_png, vertrag_pdf, vertrag_version, vertrag_sprache,
           unterschrieben_am, ip, user_agent, quelle, status, doc_hash, firma_name, email, rechnung_ust_modus, ust_hinweis,
           jahresbetreuung, jahresbetreuung_preis_cents, angebot_id)
        VALUES
          (${ref1}, ${ANGEBOT_PAKET_KEY}, ${f.land}, ${JSON.stringify(firma)}::jsonb, ${JSON.stringify(ansprechpartner)}::jsonb, ${f.uid || null},
           ${JSON.stringify(bestaetigungen)}::jsonb, ${pngM ? Buffer.from(pngM[1], "base64") : null}, ${pdfZeile?.vertrag_pdf ?? null}, ${d.fassung}, 'de',
           ${new Date(z.angenommen_am)}, ${z.ip}, ${z.user_agent}, 'individualangebot', 'offen', ${z.text_hash}, ${f.name}, ${d.kunde.email},
           ${f.uid ? "reverse_charge" : "none"}, ${f.uid ? null : "Keine UID am Kapital-Angebot — Rechnung ohne Reverse Charge, bitte klären."},
           TRUE, ${d.parameter.jahresCents}, ${id})
        ON CONFLICT (ref) DO NOTHING`;
    }
    // Der gewählte Name steht in der Akte — die Zahlungsseite zeigt ihn als Urkunde (E-320), als „vorgemerkt“ (geprueft: false), bis
    // jemand ihn im Register geprüft hat — nie „geprüft“, bevor es stimmt.
    if (w?.llc.wunsch) {
      await sqlPool`UPDATE fiaon_global_auftraege SET gesellschaft = ${JSON.stringify({ name: w.llc.wunsch, bundesstaat: STAAT_KURZ[d.parameter.bundesstaat] ?? d.parameter.bundesstaat, geprueft: false })}::jsonb
                     WHERE ref = ${ref1} AND (gesellschaft IS NULL OR gesellschaft::text IN ('null', '{}'))`.catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Gesellschaft in der Akte:`, e));
    }
    const uid = d.kunde.firma.uid || null;
    await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = ${uid ? "reverse_charge" : "none"}, tax_id = ${uid} WHERE ref = ${ref1}`;
    const b = await globalBestellungLesen(ref1);
    if (!b?.payment_reference || !["pending_payment", "claimed_paid", "paid"].includes(String(b.payment_status))) {
      const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
      const erg = await bestellungFuerAntrag(ref1, { globalMailFolgt: true });
      if (erg.status !== 200) throw new Error(`Bestellung: ${erg.status} ${JSON.stringify(erg.body).slice(0, 160)}`);
    }
    await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = ${uid ? "reverse_charge" : "none"}, tax_id = ${uid} WHERE ref = ${ref1}`;
    await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = COALESCE(rechnung_am, NOW()) WHERE angebot_id = ${id} AND nr = 1`;
    let [person] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref1}`) as any[];
    if (!person?.person_id) {
      const { bindePersonAnAntrag } = await import("../fiaon-person-model");
      await bindePersonAnAntrag(ref1).catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Person an der Bestellzeile:`, e));
      [person] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref1}`) as any[];
    }
    if (person?.person_id) await sqlPool`UPDATE fiaon_global_angebote SET person_id = COALESCE(person_id, ${Number(person.person_id)}) WHERE id = ${id}`;
    await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = NULL, updated_at = NOW() WHERE id = ${id} AND nacharbeit_fehler IS NOT NULL`;
    return { ok: true };
  } catch (e) {
    const grund = e instanceof Error ? e.message : String(e);
    console.error(`[FIAON-KAPITAL] ${z.angebot_ref}: Fertigstellen:`, e);
    await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = ${grund.slice(0, 500)}, updated_at = NOW() WHERE id = ${id}`.catch(() => {});
    return { ok: false, grund };
  }
}

/** Nach der Annahme: Aufgabe an Justin (wiederholbar über den Schlüssel) und genau einmal eine Mail an js@. */
export async function kapitalNacharbeit(id: number): Promise<void> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen" || !istKapitalFassung(z.fassung)) return;
  if (!z.auftrag_ref || z.nacharbeit_fehler) await kapitalFertigstellen(id).catch(() => null);
  const z2 = (await angebotLesen({ id }))!;
  const d = kapitalDatenAus(z2); const w = kapitalWahlAus(z2); const par = d.parameter;
  const name = kapitalVertretungName(d.kunde);
  const b = z2.auftrag_ref ? await globalBestellungLesen(String(z2.auftrag_ref)).catch(() => null) : null;
  const namen = w ? [w.llc.wunsch, w.llc.alternative1, w.llc.alternative2].filter(Boolean) : [];
  const zeilen = [
    `GESELLSCHAFT: ${namen[0] ?? "—"}${namen.length > 1 ? ` · Ausweichnamen: ${namen.slice(1).join(" · ")}` : ""} — vor der Anmeldung auf Sunbiz prüfen (${par.bundesstaat}).`,
    `RECHNUNG: ${kapitalEur(par.preisCents)} netto${b?.payment_reference ? ` · Zweck ${b.payment_reference} · Zahlungsseite ${absoluteUrl(`/zahlung/${b.payment_reference}?bereich=business`)}` : " — Bestellung hängt, Stundenlauf holt nach"}. Keine automatische Kundenmail (Firmenangebot) — Rechnung/Zahlungsseite bitte persönlich schicken.`,
    "STEUERBERATER: Struktur CH–USA vor der Gründung prüfen lassen (Gesellschafterin Firma oder Inhaber persönlich).",
    `BÜRGSCHAFT: ${kapitalChf(par.buergschaftChf)}, ${par.buergschaftMonate} Monate, Bedingungen Ziffer 5 — u. a. Bürgin im Register AKTIV, Auflagen des Prüfberichts (Betreibungsauszug, Jahresrechnung).`,
    `JAHRESBETREUUNG: ${kapitalEur(par.jahresCents)} je Jahr ab dem zweiten Jahr (zum Jahrestag der Eintragung).`,
    `Vertrag (PDF mit Annahmevermerk) im Chefbüro: ${CHEF_LINK}.`,
  ];
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: z2.person_id != null ? Number(z2.person_id) : null, ref: null,
    titel: `Kapital-Angebot angenommen: ${d.kunde.firma.name} — LLC „${namen[0] ?? "?"}“`,
    text: [`${name} (${d.kunde.firma.name}) hat das Kapital-Angebot ${d.ref} angenommen (${new Date(z2.angenommen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}).`, ...zeilen].join("\n"),
    anBetreiber: true, dringend: true, schluessel: `global:${d.ref}:kapital-justin`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
    anlageText: `Kapital-Angebot ${d.ref} angenommen.`,
  }).catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Aufgabe an Justin:`, e));
  const [marke] = (await sqlPool`
    UPDATE fiaon_global_angebote SET bestaetigung_mail_am = NOW(), updated_at = NOW()
     WHERE id = ${id} AND bestaetigung_mail_am IS NULL RETURNING id`) as any[];
  if (!marke) return;
  await import("./fiaon-global-angebot-aufrufe")
    .then((A) => A.annahmeMelden({ ref: d.ref, name: `${name} (${d.kunde.firma.name})`, art: "Kapital-Angebot", betrag: `${kapitalEur(par.preisCents)} netto (Rechnung sofort), ab Jahr 2 ${kapitalEur(par.jahresCents)} je Jahr`, zeilen }))
    .then((s) => console.log(`[FIAON-KAPITAL] ${d.ref}: Annahme — ${s}`))
    .catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Annahme-Mail an Justin:`, e));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZWEI SPÄTEREN RECHNUNGEN (E-401) — Knöpfe „Bürgschaft zugesagt“ (Teil 2) und „Finanzierung ausgezahlt“ (Teil 3)
//
// Derselbe Weg wie der Meilenstein des Individualangebots: Teil anlegen → Bestellzeile global_individuell (Betrag aus dem
// Teil, angebotTeilZurBestellung) → binden → bestellungFuerAntrag mit Rechnungsnummer → Reverse Charge wie Teil 1.
// Keine Kundenmail (Akte trägt bestaetigungen.firmenangebot): Aufgabe + einmal Mail an Justin mit Zahlungslink.
// WIEDERHOLBAR: Hing ein Schritt, nimmt der nächste Klick den angelegten Teil und macht dort weiter; steht die Rechnung,
// legt ein weiterer Klick nichts Neues an. Die Garantie (Ziffer 4) berührt das nicht.
// ═══════════════════════════════════════════════════════════════════════════
const RECHNUNG_STEHT = ["pending_payment", "claimed_paid", "paid"];
export async function kapitalGebuehrBerechnen(id: number, artRoh: unknown, ein: any, wer: string): Promise<Ergebnis<{ ref: string; rechnungsnummer: string | null; betragCents: number; zahlungsseite: string | null; meldung: string; schon?: true }>> {
  if (!istKapitalGebuehrArt(artRoh)) return nein("Diese Rechnung gibt es nicht — „buergschaft“ oder „auszahlung“.", 404);
  const art: KapitalGebuehrArt = artRoh; const g = KAPITAL_GEBUEHREN[art];
  const z = await angebotLesen({ id });
  if (!z || !istKapitalFassung(z.fassung)) return nein("Dieses Kapital-Angebot gibt es nicht.", 404);
  const d = kapitalDatenAus(z);
  const teile = ((z as any).teile as any[] | undefined) ?? [];
  const t1 = teile.find((x) => Number(x.nr) === 1);
  const vorher = teile.find((x) => Number(x.nr) === g.nr);
  const b1 = t1?.bestell_ref ? await globalBestellungLesen(String(t1.bestell_ref)) : null;
  const bVorher = vorher?.bestell_ref ? await globalBestellungLesen(String(vorher.bestell_ref)) : null;
  const p = kapitalGebuehrPruefen({
    status: String(z.status), fassung: String(z.fassung), parameter: d.parameter, angenommenAm: isoTag(z.angenommen_am), heute: berlinToday(),
    teil1Bezahlt: String(b1?.payment_status) === "paid", vorhanden: vorher ? { rechnungSteht: !!bVorher && RECHNUNG_STEHT.includes(String(bVorher.payment_status)) } : null,
  }, art, ein);
  if (!p.ok) {
    if (p.schon && vorher) {
      return { ok: true, schon: true, ref: String(vorher.bestell_ref), rechnungsnummer: bVorher?.invoice_number ?? null, betragCents: Number(vorher.betrag_cents),
        zahlungsseite: bVorher?.payment_reference ? absoluteUrl(`/zahlung/${bVorher.payment_reference}?bereich=business`) : null,
        meldung: `${g.titel} ist schon berechnet (${bVorher?.invoice_number ?? vorher.bestell_ref}) — nichts Neues angelegt.` };
    }
    return nein(p.error, 409);
  }
  const ref1 = z.auftrag_ref ? String(z.auftrag_ref) : null;
  if (!ref1 || !(await globalAkteLesen(ref1))) return nein("Bestellung und Akte von Teil 1 fehlen noch — bitte erst „Nachholen“.", 409);
  // Teil 3 braucht die Prüfregel „nr bis 500“ (Migration 096; in der Produktion seit E-301 getauscht).
  if (g.nr > 2 && !(await firmaTeileCheckSichern())) return nein("Die Datenbank nimmt Teil 3 gerade nicht an (Prüfregel der Teile) — bitte gleich noch einmal.", 503);
  await sqlPool`
    INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage, meilenstein_am, meilenstein_art, meilenstein_beleg, meilenstein_von)
    VALUES (${id}, ${g.nr}, ${g.titel}, ${p.daten.betragCents}, 'meilenstein', ${d.parameter.zahlungszielTage}, ${p.daten.datum}::date, ${art}, ${p.daten.beleg || null}, ${wer})
    ON CONFLICT (angebot_id, nr) DO NOTHING`;
  // Ein früherer Versuch ohne Bestellzeile: Tag und Beleg dieses Klicks gelten.
  await sqlPool`UPDATE fiaon_global_angebot_teile SET meilenstein_am = ${p.daten.datum}::date, meilenstein_beleg = ${p.daten.beleg || null}, meilenstein_von = ${wer}
                 WHERE angebot_id = ${id} AND nr = ${g.nr} AND bestell_ref IS NULL`;
  const [teil] = (await sqlPool`SELECT * FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND nr = ${g.nr}`) as any[];
  if (!teil) return nein(`Teil ${g.nr} ließ sich nicht anlegen — bitte noch einmal.`, 502);
  if (teil.entfallen_am) return nein(`Teil ${g.nr} ist entfallen (${teil.entfallen_grund ?? "ohne Grund"}) — keine Rechnung.`, 409);
  let ref = teil.bestell_ref ? String(teil.bestell_ref) : null;
  if (!ref) {
    const neu = `FIAON-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").slice(0, 4).toUpperCase()}`;
    const ok = await firmaBestellzeileAnlegen(neu, { kunde: d.kunde } as any, g.titel, { ip: String(z.ip || ""), userAgent: String(z.user_agent || "") });
    if (!ok) return nein(`Die Bestellzeile für die ${g.titel} ließ sich nicht anlegen — bitte noch einmal.`, 502);
    const [gebunden] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET bestell_ref = ${neu} WHERE id = ${teil.id} AND bestell_ref IS NULL AND entfallen_am IS NULL RETURNING id`) as any[];
    if (!gebunden) {
      // Ein zweiter Klick war schneller — seine Zeile gilt, diese wird nie berechnet.
      await sqlPool`UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE ref = ${neu} AND payment_status IN ('pending', 'pending_payment')`.catch(() => {});
      const [jetzt] = (await sqlPool`SELECT bestell_ref FROM fiaon_global_angebot_teile WHERE id = ${teil.id}`) as any[];
      if (!jetzt?.bestell_ref) return nein(`Teil ${g.nr} ist inzwischen entfallen — keine Rechnung.`, 409);
      ref = String(jetzt.bestell_ref);
    } else ref = neu;
  }
  const uid = d.kunde.firma.uid || null;
  await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = ${uid ? "reverse_charge" : "none"}, tax_id = ${uid} WHERE ref = ${ref}`;
  const b0 = await globalBestellungLesen(ref);
  if (!b0?.payment_reference || !RECHNUNG_STEHT.includes(String(b0.payment_status))) {
    const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
    const erg = await bestellungFuerAntrag(ref, { globalMailFolgt: true });
    if (erg.status !== 200) return nein(`Die Rechnung über die ${g.titel} ließ sich nicht anlegen: ${String((erg.body as any)?.error || erg.status)} — ein weiterer Klick macht hier weiter.`, 502);
  }
  await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = ${uid ? "reverse_charge" : "none"}, tax_id = ${uid} WHERE ref = ${ref}`;
  const [person] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref}`) as any[];
  if (!person?.person_id) {
    const { bindePersonAnAntrag } = await import("../fiaon-person-model");
    await bindePersonAnAntrag(ref).catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Person an Teil ${g.nr}:`, e));
  }
  // Der erste Klick, nach dem die Rechnung steht, schreibt Verlauf und Mail — genau einmal.
  const [erst] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = NOW() WHERE id = ${teil.id} AND rechnung_am IS NULL RETURNING id`) as any[];
  const b = await globalBestellungLesen(ref);
  const betrag = kapitalEur(Number(teil.betrag_cents));
  const tag = kapitalTag(isoTag(teil.meilenstein_am) ?? p.daten.datum);
  const zahlungsseite = b?.payment_reference ? absoluteUrl(`/zahlung/${b.payment_reference}?bereich=business`) : null;
  const satz = `${g.ereignis} am ${tag} — Rechnung ${g.titel} ${betrag} netto (${b?.invoice_number ?? ref})`;
  const name = kapitalVertretungName(d.kunde);
  if (erst) {
    await verlaufAngebot(id, wer, satz, { teil: g.nr, bestellRef: ref, ...(teil.meilenstein_beleg ? { beleg: String(teil.meilenstein_beleg) } : {}) });
    await globalVerlauf(ref1, `FIAON Global: ${satz}, ${g.ziffer} des Kapital-Angebots ${d.ref}, zahlbar binnen ${zahlwort(Number(teil.zahlungsziel_tage))} Tagen (eingetragen von ${wer}).`)
      .catch((e: unknown) => console.error(`[FIAON-KAPITAL] ${d.ref}: Verlauf der Akte:`, e));
  }
  const zeilen = [
    `${name} (${d.kunde.firma.name}) · ${satz}.`,
    `Zahlbar binnen ${zahlwort(Number(teil.zahlungsziel_tage))} Tagen${b?.payment_reference ? ` · Verwendungszweck ${b.payment_reference}` : ""}${zahlungsseite ? ` · Zahlungsseite ${zahlungsseite}` : ""}.`,
    `Keine automatische Kundenmail (Firmenangebot) — Rechnung und Zahlungsseite bitte persönlich an ${d.kunde.email} schicken.`,
    ...(teil.meilenstein_beleg ? [`Beleg (intern): ${String(teil.meilenstein_beleg)}`] : []),
    `Chefbüro: ${absoluteUrl(CHEF_LINK)}`,
  ];
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: z.person_id != null ? Number(z.person_id) : null, ref: null,
    titel: `Kapital-Angebot ${d.ref}: ${g.titel} ${betrag} an ${d.kunde.firma.name} schicken`,
    text: zeilen.join("\n"), anBetreiber: true, dringend: true, schluessel: `global:${d.ref}:kapital-teil${g.nr}`, bereich: "konten", quelle: "global",
    autorName: "FIAON Global", link: CHEF_LINK, anlageText: `${g.knopf} im Chefbüro eingetragen (${wer}).`,
  }).catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Aufgabe ${g.titel}:`, e));
  let mailSatz = "";
  if (erst) {
    try {
      const { eigeneMailSenden } = await import("./fiaon-brevo");
      const v = await eigeneMailSenden({
        an: "js@fiaon.com", name: "Justin", betreff: `${g.titel} berechnet: ${d.kunde.firma.name} — ${betrag} (${d.ref})`, text: zeilen.join("\n\n"),
        knoepfe: [...(zahlungsseite ? [{ text: "Zahlungsseite öffnen", url: zahlungsseite }] : []), { text: "Im Chefbüro ansehen", url: absoluteUrl(CHEF_LINK), leise: true }],
      });
      mailSatz = v.ok ? " Mail an Justin ist raus." : ` Mail an Justin ging nicht raus (${String(v.grund || "unbekannt").slice(0, 120)}) — die Aufgabe steht.`;
    } catch (e) { mailSatz = ` Mail an Justin ging nicht raus (${e instanceof Error ? e.message : String(e)}) — die Aufgabe steht.`; }
  }
  return {
    ok: true, ref, rechnungsnummer: b?.invoice_number ?? null, betragCents: Number(teil.betrag_cents), zahlungsseite,
    meldung: `Rechnung ${b?.invoice_number ?? ref} über die ${g.titel} (${betrag} netto) steht, zahlbar binnen ${zahlwort(Number(teil.zahlungsziel_tage))} Tagen. Keine Kundenmail — Aufgabe mit Zahlungslink liegt bei Justin.${mailSatz}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNG (E-411, 19.10.2026) — aus angebotNachZahlung; alle Buchungswege gehen durch onCustomerPaid.
//
// VORHER lief ein bezahltes Kapital-Angebot durch den Weg des Individualangebots: Frist mit dessen Wochen und
// Widerrufslogik, Aufgabe „Individualangebot starten“ mit Kreditrahmen/Karten, Teil 2 mit Ruhezeit-Rechnung, Teil 3 als
// „Teil 1“. JETZT: Teil 1 bezahlt → Frist nach Ziffer 4 (kapitalGarantieFrist, dieselbe Rechnung wie „Mein Auftrag“),
// Aufgabe an Justin (Ziffer 2 + Ziffer 4), Akte „gestartet“, Etappe 1. Teil 2/3 bezahlt → nur Vermerk, keine neue Frist.
// Unternehmen: keine Widerrufsfrist. Keine Kundenmail (Firmenangebot). Wiederholbar: bezahlt_am/frist_beginn nur einmal,
// die Start-Aufgabe nur, solange die Akte nicht „gestartet“ ist.
// ═══════════════════════════════════════════════════════════════════════════
export async function kapitalNachZahlung(ref: string, t: any, z: AngebotZeile): Promise<{ gestartet: boolean; grund?: string }> {
  const d = kapitalDatenAus(z);
  const b = await globalBestellungLesen(ref);
  if (!b || String(b.payment_status) !== "paid") return { gestartet: false, grund: "nicht bezahlt" };
  const [erstmals] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET bezahlt_am = ${b.completed_at ?? new Date()} WHERE id = ${t.id} AND bezahlt_am IS NULL RETURNING id`) as any[];
  const ref1 = String(z.auftrag_ref || ref);
  const nr = Number(t.nr);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");

  // ── Teil 2 (Bürgschaftsgebühr) / Teil 3 (Vergütung bei Auszahlung): Vermerk, keine neue Frist ──
  if (nr !== 1) {
    if (!erstmals) return { gestartet: false, grund: `${String(t.titel)} schon als bezahlt vermerkt` };
    const nachGarantiefall = !!(z.erstattung_ausgeloest_am || t.entfallen_am);
    const satz = kapitalTeilBezahltVermerk({ angebotRef: d.ref, titel: String(t.titel), betragCents: Number(t.betrag_cents), zweck: b.payment_reference ?? null, fristEnde: isoTag(z.frist_ende), nachGarantiefall });
    await verlaufAngebot(Number(z.id), "System", satz, { teil: nr, bestellRef: ref });
    await globalVerlauf(ref1, `FIAON Global: ${satz}`).catch((e: unknown) => console.error(`[FIAON-KAPITAL] ${d.ref}: Verlauf der Akte:`, e));
    if (nachGarantiefall) {
      await auftragFuerKunden({
        personId: b.person_id != null ? Number(b.person_id) : null, ref: ref1,
        titel: `Kapital-Angebot ${d.ref}: ${String(t.titel)} nach dem Garantiefall bezahlt — ${kapitalEur(Number(t.betrag_cents))} erstatten`,
        text: `${satz} Das System hat KEIN Geld bewegt.`,
        dringend: true, anBetreiber: true, schluessel: `global:${d.ref}:kapital-teil${nr}-nach-garantiefall`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
      }).catch((e) => console.error(`[FIAON-KAPITAL] ${d.ref}: Aufgabe Teil ${nr} nach Garantiefall:`, e));
    }
    return { gestartet: false, grund: `${String(t.titel)} bezahlt — keine neue Frist` };
  }

  // ── Teil 1 (Gründungskosten): Frist nach Ziffer 4, Aufgabe an Justin, Auftrag gestartet ──
  await sqlPool`UPDATE fiaon_global_auftraege SET status = 'bezahlt', bezahlt_am = COALESCE(bezahlt_am, ${b.completed_at ?? new Date()}), updated_at = NOW() WHERE ref = ${ref1} AND status = 'offen'`;
  const akte = await globalAkteLesen(ref1);
  if (!akte) return { gestartet: false, grund: "Akte fehlt" };
  const bezahltAm = berlinToday(new Date(b.completed_at ?? new Date()));
  const frist = kapitalGarantieFrist({ angenommenAm: isoTag(z.angenommen_am), bezahltAm, wochen: kapitalGarantieWochen(z.fassung, d.parameter) });
  if (frist) await sqlPool`UPDATE fiaon_global_angebote SET frist_beginn = ${frist.beginn}::date, frist_ende = ${frist.ende}::date, updated_at = NOW() WHERE id = ${z.id} AND frist_beginn IS NULL`;
  if (String(akte.status) === "gestartet") return { gestartet: false, grund: "schon gestartet" };
  const z2 = (await angebotLesen({ id: Number(z.id) }))!;
  const fristJetzt = frist ? { beginn: isoTag(z2.frist_beginn) ?? frist.beginn, ende: isoTag(z2.frist_ende) ?? frist.ende } : null;
  const [pass] = (await sqlPool`SELECT created_at FROM fiaon_global_dokumente WHERE ref = ${ref1} AND art = 'reisepass' AND geloescht_am IS NULL ORDER BY created_at LIMIT 1`.catch(() => [])) as any[];
  const auf = kapitalStartAufgabe({
    angebotRef: d.ref, firma: d.kunde.firma.name, vertretung: kapitalVertretungName(d.kunde), fassung: String(z.fassung), parameter: d.parameter,
    bezahltAm, zweck: b.payment_reference ?? null, frist: fristJetzt, reisepassAm: pass?.created_at ? isoTag(new Date(pass.created_at)) : null,
  });
  let aufgabeId: number | null = null;
  try {
    const erg = await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref: ref1, titel: auf.titel, text: auf.text,
      dringend: true, anBetreiber: true, schluessel: `global:${ref1}:start`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: CHEF_LINK, anlageText: "Zahlungseingang Teil 1 — Kapital-Angebot startet.",
    });
    aufgabeId = erg.id;
  } catch (e) { console.error(`[FIAON-KAPITAL] ${d.ref}: Aufgabe „Gründungskosten bezahlt“:`, e); }
  if (!aufgabeId) return { gestartet: false, grund: "Aufgabe nicht angelegt" };
  await sqlPool`UPDATE fiaon_global_auftraege SET status = 'gestartet', gestartet_am = COALESCE(gestartet_am, NOW()), updated_at = NOW() WHERE ref = ${ref1} AND status IN ('offen', 'bezahlt')`;
  await import("./fiaon-global-bereich").then((m) => m.globalStartVermerken(ref1)).catch((e) => console.error(`[FIAON-KAPITAL] ${ref1}: Etappe 1:`, e));
  const fristSatz = fristJetzt ? `Garantie (Ziffer 4) bis ${kapitalTag(fristJetzt.ende)}` : "ohne Garantiefrist (Fassung A)";
  await verlaufAngebot(Number(z.id), "System", `Gründungskosten bezahlt (${b.payment_reference ?? ref}) — Auftrag gestartet, ${fristSatz}`);
  await globalVerlauf(ref1, `FIAON Global: Gründungskosten des Kapital-Angebots ${d.ref} bezahlt, Auftrag gestartet — ${fristSatz}.`).catch((e: unknown) => console.error(`[FIAON-KAPITAL] ${d.ref}: Verlauf der Akte:`, e));
  return { gestartet: true };
}

/** Knopf-Zustand und Zeilen der Teile für die Liste der Leitung — dieselbe Prüfung wie beim Klick. */
function kapitalTeileSicht(z: AngebotZeile, d: KapitalDaten, teile: any[], heute: string) {
  const t1 = teile.find((t) => Number(t.nr) === 1);
  const teil1Bezahlt = String(t1?.payment_status) === "paid";
  const knopf = (art: KapitalGebuehrArt): string | null => {
    const t = teile.find((x) => Number(x.nr) === KAPITAL_GEBUEHREN[art].nr);
    const p = kapitalGebuehrPruefen({
      status: String(z.status), fassung: String(z.fassung), parameter: d.parameter, angenommenAm: isoTag(z.angenommen_am), heute, teil1Bezahlt,
      vorhanden: t ? { rechnungSteht: RECHNUNG_STEHT.includes(String(t.payment_status ?? "")) } : null,
    }, art, { datum: heute });
    return p.ok ? null : p.error;
  };
  return {
    knoepfe: { buergschaft: knopf("buergschaft"), auszahlung: knopf("auszahlung") },
    teile: [...teile].sort((a, b) => Number(a.nr) - Number(b.nr)).map((t) => ({
      nr: Number(t.nr), titel: String(t.titel), betragCents: Number(t.betrag_cents), bestellRef: t.bestell_ref ?? null,
      verwendungszweck: t.payment_reference ?? null, rechnungsnummer: t.invoice_number ?? null, zahlungsstatus: t.payment_status ?? null,
      zahlbarBis: t.payment_due_date ? berlinToday(new Date(t.payment_due_date)) : null,
      bezahltAm: t.bezahlt_am ? new Date(t.bezahlt_am).toISOString() : (String(t.payment_status) === "paid" && t.completed_at ? new Date(t.completed_at).toISOString() : null),
      ereignisAm: isoTag(t.meilenstein_am), entfallenAm: t.entfallen_am ? new Date(t.entfallen_am).toISOString() : null,
      rechnungUrl: t.bestell_ref && RECHNUNG_STEHT.includes(String(t.payment_status ?? "")) ? `/api/fiaon/admin/global/auftraege/${encodeURIComponent(String(t.bestell_ref))}/rechnung.pdf` : null,
      zahlungsseite: t.payment_reference ? `/zahlung/${t.payment_reference}?bereich=business` : null,
    })),
  };
}

/**
 * „Mein Auftrag“ und das Office (E-407): Teile mit Stand und Rechnung, Garantie aus Ziffer 4 — dieselben Schlüssel wie beim
 * Individual-/Firmenangebot, dazu die Sätze, die die Seite statt der Individual-Texte zeigt. Nur lesen.
 */
export async function kapitalSichtZurAkte(z: AngebotZeile): Promise<Record<string, unknown>> {
  const d = kapitalDatenAus(z);
  const roh = await Promise.all((((z as any).teile as any[] | undefined) ?? []).map(async (x) => {
    const b = x.bestell_ref ? await globalBestellungLesen(String(x.bestell_ref)) : null;
    const ps = String(b?.payment_status ?? "");
    const stand = z.erstattung_ausgeloest_am && x.bezahlt_am ? "erstattet" : x.entfallen_am ? "entfallen"
      : b ? (ps === "paid" ? "bezahlt" : ["cancelled", "superseded", "refunded"].includes(ps) ? "storniert" : "offen") : "noch nicht fällig";
    return {
      nr: Number(x.nr), titel: String(x.titel), betragCents: Number(x.betrag_cents), stand, rechnungsnummer: b?.invoice_number ?? null,
      bestellRef: x.bestell_ref ?? null, ereignisAm: isoTag(x.meilenstein_am),
      bezahltAm: isoTag(x.bezahlt_am) ?? (ps === "paid" && b?.completed_at ? isoTag(new Date(b.completed_at)) : null),
    };
  }));
  const sicht = kapitalMeinAuftrag({
    fassung: String(z.fassung), parameter: d.parameter, angenommenAm: isoTag(z.angenommen_am), teile: roh,
    garantieErfuelltAm: isoTag(z.garantie_erfuellt_am), erstattungAusgeloest: !!z.erstattung_ausgeloest_am,
    // E-411: frist_* aus der Datenbank — gilt nur, wenn der Kapital-Zahlungsweg sie geschrieben hat (Prüfung in kapitalMeinAuftrag).
    gespeichert: { beginn: isoTag(z.frist_beginn), ende: isoTag(z.frist_ende) },
  });
  return {
    art: "kapital", ref: d.ref, buergin: d.buergin.name, erstattungAusgeloest: !!z.erstattung_ausgeloest_am,
    garantieErfuelltAm: isoTag(z.garantie_erfuellt_am), erstattungCents: z.erstattung_cents != null ? Number(z.erstattung_cents) : null,
    // Kein Startgespräch des Individualangebots (wie in der Liste der Leitung) — den Start macht der Ansprechpartner.
    startgespraech: null,
    ...sicht,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LISTE DER LEITUNG (Reiter „Individualangebote“)
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalListenEintrag(z: AngebotZeile, ext: { heute: string; aufrufe: unknown; teile?: any[] }): Record<string, unknown> {
  const d = kapitalDatenAus(z);
  const status = angebotStatusAus(z, ext.heute);
  const fehlt = kapitalPflichtFehlen(d);
  const w = kapitalWahlAus(z);
  const ts = kapitalTeileSicht(z, d, ext.teile ?? [], ext.heute);
  return {
    art: "kapital",
    id: Number(z.id), ref: d.ref, status, fassung: d.fassung, personId: z.person_id ?? null,
    kunde: d.kunde, kundeName: `${d.kunde.firma.name} (${kapitalVertretungName(d.kunde)})`, parameter: d.parameter, gesamtCents: d.parameter.preisCents,
    fehlt, annahmeBereit: fehlt.length === 0 && status === "offen", versandSperre: null,
    gueltigBis: d.gueltigBis, erstelltAm: new Date(z.created_at).toISOString(), erstelltVon: z.erstellt_von ?? null,
    link: status === "offen" || status === "angenommen" ? absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(d.ref, d.gueltigBis))) : null,
    vertragUrl: `/api/fiaon/admin/global/angebote/${z.id}/vertrag.pdf`,
    pruefberichtUrl: d.compliance ? `/api/fiaon/admin/global/angebote/${z.id}/pruefbericht.pdf` : null, anlage1Url: null,
    pruefbericht: d.compliance ? { ampel: d.compliance.gesamt.ampel } : null, buergin: d.buergin,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null, ip: z.ip ?? null, textHash: z.text_hash ?? null,
    schalter: null,
    kapital: { llc: w?.llc ?? null, zeile: `${kapitalEur(d.parameter.preisCents)} + ${kapitalEur(d.parameter.jahresCents)}/Jahr ab Jahr 2 · Plan ${kapitalChf(d.parameter.kapitalChf)} · Bürgschaft ${kapitalChf(d.parameter.buergschaftChf)}` },
    auftragRef: z.auftrag_ref ?? null, officeLink: z.auftrag_ref ? globalOfficeAuftragPfad(String(z.auftrag_ref)) : null,
    // E-401: Teil 1 (Festpreis), Teil 2 (Bürgschaftsgebühr), Teil 3 (Vergütung bei Auszahlung) — mit Rechnung und Stand.
    teile: ts.teile, nacharbeitFehler: z.nacharbeit_fehler ?? null,
    gebuehren: { buergschaftCents: d.parameter.buergschaftCents, auszahlungCents: d.parameter.auszahlungCents, vereinbart: kapitalMitGebuehren(z.fassung) || String(z.status) === "offen", garantieWochen: d.parameter.garantieWochen },
    knoepfe: {
      buergschaft: ts.knoepfe.buergschaft, auszahlung: ts.knoepfe.auszahlung,
      meilenstein: KAPITAL_SPERRGRUND, erstattung: KAPITAL_SPERRGRUND, garantie: KAPITAL_SPERRGRUND, hemmung: KAPITAL_SPERRGRUND,
      aendern: String(z.status) === "offen" ? "Ändern per Skript (scripts/angebot-kapital-anlegen.ts)" : "Nur solange das Angebot offen ist.",
    },
    verlauf: json<any[]>(z.verlauf, []).slice(-12),
    aufrufe: ext.aufrufe ?? null,
    startgespraech: null,
    zurueckgezogenAm: z.zurueckgezogen_am ? new Date(z.zurueckgezogen_am).toISOString() : null, zurueckgezogenGrund: z.zurueckgezogen_grund ?? null,
    bestaetigungMailAm: z.bestaetigung_mail_am ? new Date(z.bestaetigung_mail_am).toISOString() : null,
  };
}
