// ═══════════════════════════════════════════════════════════════════════════
// FIAON — DER KOOPERATIONSVERTRAG „TERMINE FÜR IHRE BERATUNG“: ABLAUF (Register E-384, 16.10.2026)
//
// Texte, Vertrag und Regeln: shared/fiaon-global-angebot-koop.ts. Gebaut wie der Begleitvertrag (E-312,
// server/lib/fiaon-global-angebot-begleit.ts); der Weg des Individualangebots wird nur an den Verzweigungsstellen berührt:
//   if (istKoopFassung(z.fassung)) return (await import("./fiaon-global-angebot-koop")).koop…(…)
//
// ── DER WEG ───────────────────────────────────────────────────────────────
//   Anlegen NUR per Skript (scripts/angebot-koop-anlegen.ts, private JSON außerhalb des Repos) → signierter Link → Partner
//   liest /business/angebot/:token (KoopKundenSicht), wählt die Menge je Woche → Annahme mit „Unternehmer“, „gelesen“,
//   Unterschrift und Prüfsumme → Vertrags-PDF mit Annahmevermerk in der Zeile → Aufgabe an Justin + Mail an js@.
//
// ── WAS BEWUSST NICHT PASSIERT ────────────────────────────────────────────
//   · Keine Bestellzeile, keine Rechnung, kein Global-Auftrag: Heute wird nichts fällig; abgerechnet wird je übermitteltem
//     Kontakt zum Monatsende. auftrag_ref bleibt leer — Stundenlauf, Startgespräch und Nachholen fassen das Angebot nicht an.
//   · Keine Kundenmail: Justin schickt den Vertrag persönlich (wie beim Begleitvertrag).
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
  type AngebotZeile, type AnnahmeKontext,
} from "./fiaon-global-angebot";
import { firmaUnterschriftPruefen } from "./fiaon-global-angebot-firma";
import { dachNummer } from "@shared/fiaon-dach-telefon";
import { koopModellSeite } from "@shared/fiaon-global-angebot-koop-modelle";
import {
  KOOP_FASSUNG, KOOP_FASSUNGEN, KOOP_GUELTIG_TAGE, KOOP_KNOPF, KOOP_ANNAHME,
  koopParameterAus, koopParameterFehler, koopPflichtFehlen, koopSeite, koopBestellUebersicht, koopAnnahmeTexte,
  koopAnsprechpartner, koopPartnerAnrede, koopPartnerName, koopVertragTitel, koopVertragUnterzeile, koopRumpfHtml,
  koopHashEingabe, koopEur, koopWunschAus, istKoopFassung, koopFassungFuer, koopModellVon, KOOP_BEREICH,
  type KoopDaten, type KoopPartner, type KoopParameter, type KoopLand, type KoopAnnahmeVermerk, type KoopWahl,
  type KoopUnterschriftVermerk, type KoopKundenSicht,
} from "@shared/fiaon-global-angebot-koop";

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
const LAENDER: KoopLand[] = ["DE", "AT", "CH"];

/** Themen und Geschäftsbezeichnung stehen im Vertrag (Vertragssprache): kein Ihr/Sie/wir/unser. */
export function koopAnspracheFehler(par: KoopParameter, partner?: Pick<KoopPartner, "firma">): string | null {
  const t = [...par.themen, partner?.firma ?? ""].join(" | ");
  const m = t.match(/\b(Ihr\w*|Sie|wir|uns|unser\w*)\b/);
  return m ? `„${m[0]}“ steht dann im Vertrag — bitte neutral formulieren.` : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LESEN
// ═══════════════════════════════════════════════════════════════════════════
export function koopDatenAus(z: AngebotZeile): KoopDaten {
  const parameter = koopParameterAus(json<Partial<KoopParameter>>(z.parameter, {}));
  return {
    ref: String(z.angebot_ref),
    // Ein offenes Angebot liest immer die aktuelle Fassung seines Bereichs (E-390: je Modell eine Fassung).
    fassung: String(z.status) === "offen" ? koopFassungFuer(parameter.bereich) : String(z.fassung),
    partner: json<KoopPartner>(z.kunde, {} as KoopPartner),
    parameter,
    gueltigBis: isoTag(z.gueltig_bis) ?? berlinToday(),
  };
}
export function koopWahlAus(z: AngebotZeile): (KoopWahl & { unterschrift: KoopUnterschriftVermerk | null }) | null {
  const s = json<Record<string, any>>(z.schalter, {});
  const w = koopWunschAus(s.wunschWoche);
  if (!w) return null;
  return { wunschWoche: w, unterschrift: s.unterschrift && typeof s.unterschrift === "object" ? (s.unterschrift as KoopUnterschriftVermerk) : null };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSUMME, HTML, PDF
// ═══════════════════════════════════════════════════════════════════════════
export function koopTextHash(d: KoopDaten): string { return docHash(koopHashEingabe(d, koopRumpfHtml(d, null))); }
const BILDSCHIRM_CSS = `${GLOBAL_VERTRAG_CSS}${ANGEBOT_VERTRAG_CSS}`;
function escape(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
export function koopVorschauHtml(d: KoopDaten): string {
  return `<style>${BILDSCHIRM_CSS}</style>
<div class="gv" lang="de"><h1 class="gv-titel">${escape(koopVertragTitel(d))}</h1><p class="gv-unterzeile">${escape(koopVertragUnterzeile(d))}</p></div>
${koopRumpfHtml(d, null)}`;
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
export async function koopVertragPdf(d: KoopDaten, annahme: KoopAnnahmeVermerk | null): Promise<Buffer> {
  const titel = koopVertragTitel(d);
  const html = wrapFiaonDocument({
    documentTitle: titel, subtitle: koopVertragUnterzeile(d), bodyHtml: koopRumpfHtml(d, annahme),
    watermark: annahme ? null : "Angebot — nicht angenommen", markenzeile: MARKENZEILE, zusatzCss: PDF_CSS,
  });
  return htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · Company No. 17318250 · Fassung ${d.fassung} · Angebot ${d.ref}${annahme ? "" : ` · Entwurf · Prüfsumme ${koopTextHash(d).slice(0, 12)}`}`, rand: RAND, keinNotbehelf: !!annahme });
}
export async function koopPdfErzeugen(z: AngebotZeile, art: "vertrag" | "pruefbericht" | "anlage1"): Promise<{ status: number; pdf?: Buffer; dateiname?: string; error?: string }> {
  if (art !== "vertrag") return { status: 404, error: "Dieses Dokument gibt es zu diesem Angebot nicht." };
  const d = koopDatenAus(z);
  if (String(z.status) === "angenommen") {
    const [r] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${z.id} LIMIT 1`) as any[];
    if (r?.vertrag_pdf) return { status: 200, pdf: Buffer.from(r.vertrag_pdf), dateiname: `FIAON_Kooperationsvertrag_${d.ref}.pdf` };
  }
  return { status: 200, pdf: await koopVertragPdf(d, null), dateiname: `FIAON_Kooperationsvertrag_${d.ref}_Entwurf.pdf` };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLEGEN UND ÄNDERN (nur Skript)
// ═══════════════════════════════════════════════════════════════════════════
export function koopPartnerPruefen(k: any): { ok: true; partner: KoopPartner } | { ok: false; error: string } {
  const land = String(k?.land ?? "").toUpperCase() as KoopLand;
  if (!LAENDER.includes(land)) return { ok: false, error: "Partner: Land Deutschland, Österreich oder Schweiz." };
  const partner: KoopPartner = {
    art: "unternehmer",
    anrede: ["Herr", "Frau"].includes(String(k?.anrede)) ? (String(k.anrede) as "Herr" | "Frau") : "",
    vorname: text(k?.vorname, 80), nachname: text(k?.nachname, 80), firma: text(k?.firma, 120),
    strasse: text(k?.strasse, 160), plz: text(k?.plz, 10), ort: text(k?.ort, 120), land,
    email: text(k?.email, 160).toLowerCase(), telefon: text(k?.telefon, 40),
  };
  if (!partner.vorname || !partner.nachname) return { ok: false, error: "Partner: Vor- und Nachname fehlen." };
  if (partner.strasse.length < 3 || !partner.ort) return { ok: false, error: "Partner: Anschrift unvollständig." };
  if (!(land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(partner.plz)) return { ok: false, error: "Partner: Postleitzahl passt nicht zum Land." };
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(partner.email)) return { ok: false, error: "Partner: E-Mail-Adresse ungültig." };
  if (partner.telefon) {
    const t = dachNummer(partner.telefon, land);
    if (!t) return { ok: false, error: "Partner: Telefonnummer aus Deutschland, Österreich oder der Schweiz." };
    partner.telefon = t;
  }
  return { ok: true, partner };
}
export async function koopAnlegen(ein: any, wer: string): Promise<Ergebnis<{ id: number; ref: string; link: string }>> {
  await ensureAngebotTabellen();
  const fassung = String(ein?.fassung || koopFassungFuer(ein?.parameter?.bereich));
  if (!(KOOP_FASSUNGEN as readonly string[]).includes(fassung)) return nein("Diese Fassung des Kooperationsvertrags gibt es nicht.");
  if (fassung !== koopFassungFuer(ein?.parameter?.bereich)) return nein("Fassung und Bereich passen nicht zusammen.");
  const k = koopPartnerPruefen(ein?.partner ?? ein?.kunde);
  if (!k.ok) return nein(k.error);
  const parameter = koopParameterAus(ein?.parameter);
  const pf = koopParameterFehler(parameter) ?? koopAnspracheFehler(parameter, k.partner);
  if (pf) return nein(pf);
  const heute = berlinToday();
  const gueltigBis = ISO.test(String(ein?.gueltigBis ?? "")) ? String(ein.gueltigBis) : new Date(Date.parse(`${heute}T12:00:00Z`) + KOOP_GUELTIG_TAGE * 864e5).toISOString().slice(0, 10);
  if (gueltigBis < heute) return nein("Das Datum „gültig bis“ liegt in der Vergangenheit.");
  const personId = Number(ein?.personId);
  const ref = `FIAON-IA-K${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, pruefbericht, status, gueltig_bis, erstellt_von, verlauf)
    VALUES (${ref}, ${Number.isInteger(personId) && personId > 0 ? personId : null}, ${fassung}, ${jsonb(k.partner)}, ${jsonb(parameter)}, ${jsonb({})},
            ${null}, 'offen', ${gueltigBis}::date, ${wer}, ${jsonb([{ am: new Date().toISOString(), wer, was: "Kooperationsvertrag angelegt" }])})
    RETURNING id`) as any[];
  return { ok: true, id: Number(neu.id), ref, link: absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(ref, gueltigBis))) };
}
export async function koopAendern(id: number, ein: any, wer: string): Promise<Ergebnis<{ fehlt: string[] }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (String(z.status) !== "offen") return nein(`Das Angebot ist ${String(z.status)} — ändern geht nur, solange es offen ist.`, 409);
  const alt = koopDatenAus(z); const altHash = koopTextHash(alt);
  const neu: KoopDaten = { ...alt }; const geaendert: string[] = [];
  if (ein?.parameter) { const par = koopParameterAus(ein.parameter, alt.parameter); const f = koopParameterFehler(par) ?? koopAnspracheFehler(par, alt.partner); if (f) return nein(f); neu.parameter = par; geaendert.push("Parameter"); }
  if (ein?.partner ?? ein?.kunde) { const k = koopPartnerPruefen(ein.partner ?? ein.kunde); if (!k.ok) return nein(k.error); neu.partner = k.partner; geaendert.push("Partner"); }
  if (ein?.gueltigBis !== undefined) { const g = String(ein.gueltigBis); if (!ISO.test(g) || g < berlinToday()) return nein("„Gültig bis“: ein Datum ab heute."); neu.gueltigBis = g; geaendert.push("Gültigkeit"); }
  if (!geaendert.length) return nein("Es wurde nichts geändert. Beim Kooperationsvertrag ändert das Skript Partner, Parameter und Gültigkeit.");
  await sqlPool`
    UPDATE fiaon_global_angebote SET kunde = ${jsonb(neu.partner)}, parameter = ${jsonb(neu.parameter)}, gueltig_bis = ${neu.gueltigBis}::date, updated_at = NOW()
     WHERE id = ${id} AND status = 'offen'`;
  await verlaufAngebot(id, wer, `geändert: ${geaendert.join(", ")}`, { alterHash: altHash });
  return { ok: true, fehlt: koopPflichtFehlen(neu) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE (offen) und die Antwort nach der Annahme
// ═══════════════════════════════════════════════════════════════════════════
export async function koopKundenSicht(token: string, z: AngebotZeile, opts: { leitung?: boolean } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const d = koopDatenAus(z);
  const fehlt = koopPflichtFehlen(d);
  const k = d.partner;
  const annahme = koopAnnahmeTexte(d);
  const body: KoopKundenSicht = {
    ok: true, status: "offen", art: "koop", ref: d.ref, fassung: d.fassung, gueltigBis: d.gueltigBis,
    modell: koopModellVon(d.parameter.bereich), bereich: d.parameter.bereich,
    partner: { anrede: k.anrede, vorname: k.vorname, nachname: k.nachname, email: k.email },
    partnerAnrede: koopPartnerAnrede(k),
    seite: koopSeite(d),
    ansprechpartner: koopAnsprechpartner(d.parameter).map((p) => ({ ...p, portrait: `/portraits/${p.kuerzel}.jpg` })),
    uebersicht: koopBestellUebersicht(d),
    annahme,
    annahmeBereit: fehlt.length === 0 && !opts.leitung,
    gesperrtGrund: fehlt.length ? annahme.gesperrt : null,
    ...(opts.leitung ? { vorschauLeitung: true, fehlt } : {}),
    html: koopVorschauHtml(d),
    textHash: koopTextHash(d),
    vertragPdf: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/vertrag.pdf`,
  };
  return { status: 200, body: body as unknown as Record<string, unknown> };
}
/** Dieselben Felder wie die Antwort des Individualangebots nach der Annahme — die Ansicht „fertig“ ist dieselbe. */
export async function koopAngenommenAntwort(z: AngebotZeile): Promise<Record<string, unknown>> {
  const d = koopDatenAus(z);
  const w = koopWahlAus(z);
  const token = angebotTokenErzeugen(d.ref, d.gueltigBis);
  return {
    art: "koop", startgespraech: null,
    ref: d.ref, auftragRef: null, email: d.partner.email, sofortBeginn: true,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null,
    betragCents: 0, zahlungsseite: null, meinAuftrag: null, rechnungUrl: null,
    vertragUrl: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/vertrag.pdf`,
    fertigTitel: KOOP_ANNAHME.fertigTitel,
    fertigText: koopModellVon(d.parameter.bereich) === "kontakt" ? KOOP_ANNAHME.fertigText(d.partner.email, w?.wunschWoche ?? 0)
      : (await import("@shared/fiaon-global-angebot-koop-modelle")).koopModellSeite(d as any).annahme.fertigText(d.partner.email, w?.wunschWoche ?? 0),
    teil1Bezahlt: true,
    fertigZahlung: koopModellVon(d.parameter.bereich) === "kontakt" ? KOOP_ANNAHME.fertigZahlung
      : (await import("@shared/fiaon-global-angebot-koop-modelle")).koopModellSeite(d as any).annahme.fertigZahlung,
    fertigFuss: KOOP_ANNAHME.fertigFuss,
    llc: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANNAHME (gerufen aus annehmen() im Individualangebot: Token, Status, Leitung und Honigtopf sind dort geprüft)
// ═══════════════════════════════════════════════════════════════════════════
export async function koopAnnehmen(z: AngebotZeile, body: any, kontext: AnnahmeKontext, helfer: { zuViel: (ip: string) => boolean }): Promise<{ status: number; body: Record<string, unknown> }> {
  const fehler = (status: number, error: string, extra: Record<string, unknown> = {}) => ({ status, body: { ok: false, error, ...extra } });
  const d = koopDatenAus(z);
  const texte = koopAnnahmeTexte(d);
  if (koopPflichtFehlen(d).length) return fehler(409, texte.gesperrt, { code: "PFLICHTFELDER" });
  if (helfer.zuViel(kontext.ip)) return fehler(429, "Von Ihrem Anschluss kamen gerade mehrere Versuche. Bitte versuchen Sie es in einigen Minuten noch einmal.");
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(kontext.ip, kontext.userAgent).roboter) {
    return fehler(403, "Diese Annahme können wir nicht entgegennehmen. Bitte öffnen Sie die Seite in Ihrem Browser und nehmen Sie dort an.");
  }
  const wunschWoche = koopWunschAus(body?.wunschWoche);
  if (!wunschWoche) return fehler(400, KOOP_ANNAHME.fehltWunsch, { code: "WUNSCH" });
  if (body?.unternehmer !== true) return fehler(400, KOOP_ANNAHME.fehltUnternehmer, { code: "HAEKCHEN", fehlt: ["unternehmer"] });
  if (body?.gelesen !== true) return fehler(400, KOOP_ANNAHME.fehltGelesen, { code: "HAEKCHEN", fehlt: ["gelesen"] });
  const u = firmaUnterschriftPruefen(body?.unterschrift, { vertretung: { nachname: d.partner.nachname } } as any);
  if (!u.ok) return fehler(400, u.error, { code: u.code });
  const hash = koopTextHash(d);
  if (String(body?.textHash ?? "") !== hash) return fehler(409, KOOP_ANNAHME.neuLaden, { code: "GEAENDERT" });

  const jetzt = new Date();
  const wahl: KoopWahl = { wunschWoche };
  const unterschrift: KoopUnterschriftVermerk = { ...u.vermerk, am: jetzt.toISOString(), ip: kontext.ip };
  let pdf: Buffer;
  try {
    pdf = await koopVertragPdf(d, { am: jetzt, ip: kontext.ip, userAgent: kontext.userAgent, hash, wahl, unterschrift });
    if (!pdf || pdf.length < 1000) throw new Error("PDF leer");
  } catch (e) {
    console.error(`[FIAON-KOOP] ${d.ref}: Vertrags-PDF:`, e);
    return fehler(500, "Ihr Vertrag konnte gerade nicht ausgefertigt werden — bitte versuchen Sie es in einer Minute noch einmal. Es wurde nichts gespeichert.");
  }
  const schalter = { ...wahl, unternehmer: true, gelesen: true, unterschrift };
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote
       SET status = 'angenommen', angenommen_am = ${jetzt}, ip = ${kontext.ip}, user_agent = ${String(kontext.userAgent || "").slice(0, 500)},
           text_hash = ${hash}, schalter = ${jsonb(schalter)}, vertrag_pdf = ${pdf}, fassung = ${d.fassung}, updated_at = NOW()
     WHERE id = ${z.id} AND status = 'offen' AND gueltig_bis >= ${berlinToday()}::date AND updated_at::text = ${String(z.updated_at_txt)}
     RETURNING id`) as any[];
  if (!frei) {
    const neu = await angebotLesen({ id: Number(z.id) });
    if (neu && String(neu.status) === "angenommen") return { status: 200, body: { ok: true, schon: true, ...(await koopAngenommenAntwort(neu)) } };
    if (neu && String(neu.status) === "offen") return fehler(409, KOOP_ANNAHME.neuLaden, { code: "GEAENDERT" });
    return fehler(409, "Das Angebot lässt sich gerade nicht annehmen. Bitte laden Sie die Seite neu.");
  }
  await verlaufAngebot(Number(z.id), koopPartnerName(d.partner), `angenommen (${KOOP_KNOPF}) — Prüfsumme ${hash.slice(0, 12)}…, ${wunschWoche} Kontakte je Woche, als Unternehmer, Unterschrift ${unterschrift.art}`);
  void import("./fiaon-global-angebot-aufrufe").then((m) => m.aufrufeAnnahmeVermerken(Number(z.id)))
    .catch((e) => console.error(`[FIAON-KOOP] ${d.ref}: Annahme in der Aufruf-Aufgabe:`, e));
  void koopNacharbeit(Number(z.id)).catch((e) => console.error(`[FIAON-KOOP] ${d.ref}: Nacharbeit abgebrochen:`, e));
  return { status: 200, body: { ok: true, ...(await koopAngenommenAntwort((await angebotLesen({ id: Number(z.id) }))!)) } };
}

/** Nach der Annahme: Aufgabe an Justin (wiederholbar über den Schlüssel) und genau einmal eine Mail an js@. */
export async function koopNacharbeit(id: number): Promise<void> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen" || !istKoopFassung(z.fassung)) return;
  const d = koopDatenAus(z); const w = koopWahlAus(z); const par = d.parameter;
  const name = koopPartnerName(d.partner);
  const modell = koopModellVon(par.bereich);
  const zeilen = [
    `BEREICH: ${KOOP_BEREICH[par.bereich].name} (Modell ${modell}).`,
    ...(modell === "kontakt" ? [
      `MENGE: ${w?.wunschWoche ?? "?"} Kontakte je Woche — bis zur ersten bezahlten Monatsrechnung höchstens ${par.startDeckel}.`,
      `VERGÜTUNG: ${koopEur(par.preisCents)} netto je qualifiziertem Kontakt (Reverse Charge), Rechnung zum Monatsende, Ziel ${par.zahlungszielTage} Tage; offen ${par.ruhenNachTagen} Tage nach Fälligkeit → Übermittlung ruht.`,
    ] : modell === "platz" ? [
      `PARTNERPLATZ: ${koopEur(par.preisCents)} netto im Monat ab dem Ersten des Folgemonats, Region ${par.region}, Mindestlaufzeit ${par.mindestMonate} Monate; Rechnung automatisch am Monatsersten.`,
    ] : [
      `VERGÜTUNG: ${koopEur(par.preisCents)} / ${koopEur(par.zweitCents)} netto je gemeldetem Abschluss; Partner meldet im Partnerbereich, Rechnung zum Monatsende.`,
    ]),
    "EINWILLIGUNG: nur Interessenten übermitteln, die ausdrücklich zugestimmt haben (Wortlaut, Datum, Uhrzeit festhalten) — ohne sie kein Kontakt.",
    `NÄCHSTER SCHRITT (läuft automatisch, E-386): Der Partner bekommt seinen Partnerbereich per Mail, trägt dort seine Zeiten ein; danach halten Mitarbeiter in der Akte unter „Partner-Termin“ Kontakte fest (Themen: ${par.themen.join(" · ")}).`,
    `Vertrag (PDF mit Annahmevermerk) im Chefbüro: ${CHEF_LINK} — bitte per Mail an ${d.partner.email} schicken (es geht keine automatische Mail raus).`,
  ];
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: z.person_id != null ? Number(z.person_id) : null, ref: null,
    titel: `Kooperation angenommen: ${name} — ${modell === "kontakt" ? `${w?.wunschWoche ?? "?"} Termine je Woche` : modell === "platz" ? `Partnerplatz ${KOOP_BEREICH[par.bereich].name}${par.region ? ` (${par.region})` : ""}` : `${KOOP_BEREICH[par.bereich].name} je Abschluss`}`,
    text: [`${name} hat den Kooperationsvertrag ${d.ref} angenommen (${new Date(z.angenommen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}). Heute nichts fällig.`, ...zeilen].join("\n"),
    anBetreiber: true, dringend: true, schluessel: `global:${d.ref}:koop-justin`, bereich: "konten", quelle: "global", autorName: "FIAON", link: CHEF_LINK,
    anlageText: `Kooperationsvertrag ${d.ref} angenommen.`,
  }).catch((e) => console.error(`[FIAON-KOOP] ${d.ref}: Aufgabe an Justin:`, e));
  const [marke] = (await sqlPool`
    UPDATE fiaon_global_angebote SET bestaetigung_mail_am = NOW(), updated_at = NOW()
     WHERE id = ${id} AND bestaetigung_mail_am IS NULL RETURNING id`) as any[];
  if (!marke) return;
  await import("./fiaon-global-angebot-aufrufe")
    .then((A) => A.annahmeMelden({ ref: d.ref, name, art: "Kooperationsvertrag", betrag: modell === "platz" ? `heute nichts (Partnerplatz ${koopEur(par.preisCents)} netto im Monat ab dem Ersten des Folgemonats)` : modell === "abschluss" ? `heute nichts (${koopEur(par.preisCents)} / ${koopEur(par.zweitCents)} netto je gemeldetem Abschluss)` : `heute nichts (${koopEur(par.preisCents)} netto je Kontakt, Abrechnung zum Monatsende)`, zeilen }))
    .then((s) => console.log(`[FIAON-KOOP] ${d.ref}: Annahme — ${s}`))
    .catch((e) => console.error(`[FIAON-KOOP] ${d.ref}: Annahme-Mail an Justin:`, e));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LISTE DER LEITUNG (Reiter „Individualangebote“)
// ═══════════════════════════════════════════════════════════════════════════
export function koopListenEintrag(z: AngebotZeile, ext: { heute: string; aufrufe: unknown }): Record<string, unknown> {
  const d = koopDatenAus(z);
  const status = angebotStatusAus(z, ext.heute);
  const fehlt = koopPflichtFehlen(d);
  const w = koopWahlAus(z);
  return {
    art: "koop",
    id: Number(z.id), ref: d.ref, status, fassung: d.fassung, personId: z.person_id ?? null,
    kunde: d.partner, kundeName: koopPartnerName(d.partner), parameter: d.parameter, gesamtCents: 0,
    fehlt, annahmeBereit: fehlt.length === 0 && status === "offen", versandSperre: null,
    gueltigBis: d.gueltigBis, erstelltAm: new Date(z.created_at).toISOString(), erstelltVon: z.erstellt_von ?? null,
    link: status === "offen" || status === "angenommen" ? absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(d.ref, d.gueltigBis))) : null,
    vertragUrl: `/api/fiaon/admin/global/angebote/${z.id}/vertrag.pdf`,
    pruefberichtUrl: null, anlage1Url: null, pruefbericht: null, buergin: null,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null, ip: z.ip ?? null, textHash: z.text_hash ?? null,
    schalter: null,
    koop: { wunschWoche: w?.wunschWoche ?? null, zeile: koopModellVon(d.parameter.bereich) === "kontakt" ? `${koopEur(d.parameter.preisCents)} netto je Kontakt · Start-Rahmen ${d.parameter.startDeckel} · Abrechnung zum Monatsende` : `${KOOP_BEREICH[d.parameter.bereich].name} · ${koopModellSeite(d as any).zeile}` },
    auftragRef: null, officeLink: null, teile: [],
    knoepfe: { meilenstein: "Kooperation: keine Teile", erstattung: "Kooperation: keine Erstattung", garantie: "Kooperation: keine Garantie", hemmung: "Kooperation: keine Frist", aendern: String(z.status) === "offen" ? "Kooperation: Ändern per Skript (scripts/angebot-koop-anlegen.ts)" : "Nur solange das Angebot offen ist." },
    verlauf: json<any[]>(z.verlauf, []).slice(-12),
    aufrufe: ext.aufrufe ?? null,
    startgespraech: null,
    zurueckgezogenAm: z.zurueckgezogen_am ? new Date(z.zurueckgezogen_am).toISOString() : null, zurueckgezogenGrund: z.zurueckgezogen_grund ?? null,
    bestaetigungMailAm: z.bestaetigung_mail_am ? new Date(z.bestaetigung_mail_am).toISOString() : null,
  };
}
