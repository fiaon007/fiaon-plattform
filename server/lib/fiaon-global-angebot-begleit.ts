// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER BEGLEITVERTRAG FÜR BESTANDSKUNDEN: ABLAUF (Register E-312, 08.10.2026)
//
// Texte, Vertrag und Rechenregeln: shared/fiaon-global-angebot-begleit.ts. Hier nur der Ablauf. Der Weg des
// Individualangebots (server/lib/fiaon-global-angebot.ts) wird nur an Verzweigungsstellen berührt:
//   if (istBegleitFassung(z.fassung)) return (await import("./fiaon-global-angebot-begleit")).begleit…(…)
// So bleiben das Individualangebot (E-268) und das Firmenangebot (E-301) Byte für Byte gleich.
//
// ── DER WEG ───────────────────────────────────────────────────────────────
//   Anlegen NUR per Skript (scripts/angebot-begleit-anlegen.ts, private JSON außerhalb des Repos) → signierter Link
//   (derselbe Token wie E-268) → Kunde liest /business/angebot/:token (BegleitKundenSicht), tippt den Namen seiner LLC →
//   Annahme mit „gelesen“, Unterschrift (gezeichnet oder getippt), zwei freiwilligen Haken (sofortiger Beginn,
//   Jahresbetreuung) und Prüfsumme → Vertrags-PDF mit Annahmevermerk (LLC-Namen, Wahl, Unterschrift) in der Zeile →
//   Aufgabe an Justin (Gründung starten mit dem Wunschnamen, Altabo stornieren, Gründungsrechnung nach Einreichung) +
//   Mail an js@ (annahmeMelden).
//
// ── WAS BEWUSST NICHT PASSIERT ────────────────────────────────────────────
//   · Keine Bestellzeile, keine Rechnung, keine Akte automatisch: Heute wird nichts fällig. Die Gründungskosten
//     (Selbstkosten mit Aufstellung) und jedes Erfolgshonorar stellt die Leitung von Hand über den einen Weg.
//   · Keine Kundenmail und kein automatisches Startgespräch: Justin führt den Kunden persönlich (auftrag_ref bleibt leer —
//     Stundenlauf, Startgespräch und Bestätigungsmail des Individualangebots fassen das Angebot deshalb nicht an).
//   · Das Altabo storniert dieser Code NICHT selbst (Geld nur über die vorhandenen Wege) — die Aufgabe nennt es als ersten Schritt.
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
import { geburtsdatumIso } from "@shared/fiaon-geburtsdatum";
import {
  BEGLEIT_FASSUNG, BEGLEIT_FASSUNGEN, BEGLEIT_GUELTIG_TAGE, BEGLEIT_KNOPF, BEGLEIT_ANNAHME,
  begleitParameterAus, begleitParameterFehler, begleitPflichtFehlen, begleitSeite, begleitBestellUebersicht, begleitAnnahmeTexte,
  begleitAnsprechpartner, begleitKundeAnrede, begleitKundeName, begleitVertragTitel, begleitVertragUnterzeile, begleitRumpfHtml,
  begleitHashEingabe, begleitEur, begleitUsd, begleitProzent, begleitTag, llcWahlPruefen,
  type BegleitDaten, type BegleitKunde, type BegleitParameter, type BegleitLand, type BegleitAnnahmeVermerk, type BegleitWahl,
  type BegleitUnterschriftVermerk, type BegleitKundenSicht,
} from "@shared/fiaon-global-angebot-begleit";

// ── Kleine Helfer ─────────────────────────────────────────────────────────────
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
const LAENDER: BegleitLand[] = ["DE", "AT", "CH"];

/** Die Texte aus den Parametern stehen auch in der Präambel (Vertragssprache): kein Ihr/Sie/wir/unser. */
export function begleitAnspracheFehler(par: BegleitParameter): string | null {
  const t = [par.bisherMitgliedschaft, ...par.bisher.map((x) => x.titel)].join(" | ");
  const m = t.match(/\b(Ihr\w*|Sie|wir|uns|unser\w*)\b/);
  return m ? `Parameter: „${m[0]}“ steht dann im Vertrag — bitte neutral formulieren (z. B. „für die LLC“).` : null;
}
export function istBegleitAngebot(z: { fassung?: unknown } | null | undefined): boolean {
  return String(z?.fassung ?? "").startsWith("IA-BEGLEIT-");
}

// ═══════════════════════════════════════════════════════════════════════════
// LESEN
// ═══════════════════════════════════════════════════════════════════════════
export function begleitDatenAus(z: AngebotZeile): BegleitDaten {
  return {
    ref: String(z.angebot_ref),
    fassung: String(z.status) === "offen" ? BEGLEIT_FASSUNG : String(z.fassung),
    kunde: json<BegleitKunde>(z.kunde, {} as BegleitKunde),
    parameter: begleitParameterAus(json<Partial<BegleitParameter>>(z.parameter, {})),
    gueltigBis: isoTag(z.gueltig_bis) ?? berlinToday(),
  };
}
/** Die Wahl des Kunden aus dem Schalter des angenommenen Angebots. */
export function begleitWahlAus(z: AngebotZeile): (BegleitWahl & { unterschrift: BegleitUnterschriftVermerk | null }) | null {
  const s = json<Record<string, any>>(z.schalter, {});
  if (!s.llc || typeof s.llc !== "object") return null;
  return {
    llc: { wunsch: String(s.llc.wunsch ?? ""), alternative1: String(s.llc.alternative1 ?? ""), alternative2: String(s.llc.alternative2 ?? "") },
    sofortBeginn: s.sofortBeginn === true, jahresbetreuung: s.jahresbetreuung === true,
    unterschrift: s.unterschrift && typeof s.unterschrift === "object" ? (s.unterschrift as BegleitUnterschriftVermerk) : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSUMME, HTML, PDF
// ═══════════════════════════════════════════════════════════════════════════
export function begleitTextHash(d: BegleitDaten): string { return docHash(begleitHashEingabe(d, begleitRumpfHtml(d, null))); }
const BILDSCHIRM_CSS = `${GLOBAL_VERTRAG_CSS}${ANGEBOT_VERTRAG_CSS}`;
function escape(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
/** Für den Bildschirm: Titel, Unterzeile, Rumpf — exakt der Text, der ins PDF geht. */
export function begleitVorschauHtml(d: BegleitDaten): string {
  return `<style>${BILDSCHIRM_CSS}</style>
<div class="gv" lang="de"><h1 class="gv-titel">${escape(begleitVertragTitel())}</h1><p class="gv-unterzeile">${escape(begleitVertragUnterzeile(d))}</p></div>
${begleitRumpfHtml(d, null)}`;
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
export async function begleitVertragPdf(d: BegleitDaten, annahme: BegleitAnnahmeVermerk | null): Promise<Buffer> {
  const titel = begleitVertragTitel();
  const html = wrapFiaonDocument({
    documentTitle: titel, subtitle: begleitVertragUnterzeile(d), bodyHtml: begleitRumpfHtml(d, annahme),
    watermark: annahme ? null : "Angebot — nicht angenommen", markenzeile: MARKENZEILE, zusatzCss: PDF_CSS,
  });
  return htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · Company No. 17318250 · Fassung ${d.fassung} · Angebot ${d.ref}${annahme ? "" : ` · Entwurf · Prüfsumme ${begleitTextHash(d).slice(0, 12)}`}`, rand: RAND, keinNotbehelf: !!annahme });
}
export async function begleitPdfErzeugen(z: AngebotZeile, art: "vertrag" | "pruefbericht" | "anlage1"): Promise<{ status: number; pdf?: Buffer; dateiname?: string; error?: string }> {
  if (art !== "vertrag") return { status: 404, error: "Dieses Dokument gibt es zu diesem Angebot nicht." };
  const d = begleitDatenAus(z);
  if (String(z.status) === "angenommen") {
    const [r] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${z.id} LIMIT 1`) as any[];
    if (r?.vertrag_pdf) return { status: 200, pdf: Buffer.from(r.vertrag_pdf), dateiname: `FIAON_Global_Begleitvertrag_${d.ref}.pdf` };
  }
  return { status: 200, pdf: await begleitVertragPdf(d, null), dateiname: `FIAON_Global_Begleitvertrag_${d.ref}_Entwurf.pdf` };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLEGEN UND ÄNDERN (nur Skript / Leitung)
// ═══════════════════════════════════════════════════════════════════════════
export function begleitKundePruefen(k: any): { ok: true; kunde: BegleitKunde } | { ok: false; error: string } {
  const land = String(k?.land ?? "").toUpperCase() as BegleitLand;
  if (!LAENDER.includes(land)) return { ok: false, error: "Kunde: Land Deutschland, Österreich oder Schweiz." };
  const kunde: BegleitKunde = {
    art: "privat",
    anrede: ["Herr", "Frau"].includes(String(k?.anrede)) ? (String(k.anrede) as "Herr" | "Frau") : "",
    vorname: text(k?.vorname, 80), nachname: text(k?.nachname, 80),
    geburtsdatum: geburtsdatumIso(k?.geburtsdatum) ?? "",
    strasse: text(k?.strasse, 160), plz: text(k?.plz, 10), ort: text(k?.ort, 120), land,
    email: text(k?.email, 160).toLowerCase(), telefon: text(k?.telefon, 40),
  };
  if (!kunde.vorname || !kunde.nachname) return { ok: false, error: "Kunde: Vor- und Nachname fehlen." };
  if (kunde.strasse.length < 3 || !kunde.ort) return { ok: false, error: "Kunde: Anschrift unvollständig." };
  if (!(land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(kunde.plz)) return { ok: false, error: "Kunde: Postleitzahl passt nicht zum Land." };
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(kunde.email)) return { ok: false, error: "Kunde: E-Mail-Adresse ungültig." };
  if (kunde.telefon) {
    const t = dachNummer(kunde.telefon, land);
    if (!t) return { ok: false, error: "Kunde: Telefonnummer aus Deutschland, Österreich oder der Schweiz." };
    kunde.telefon = t;
  }
  return { ok: true, kunde };
}
export async function begleitAnlegen(ein: any, wer: string): Promise<Ergebnis<{ id: number; ref: string; link: string }>> {
  await ensureAngebotTabellen();
  const fassung = String(ein?.fassung || BEGLEIT_FASSUNG);
  if (!(BEGLEIT_FASSUNGEN as readonly string[]).includes(fassung)) return nein("Diese Fassung des Begleitvertrags gibt es nicht.");
  const k = begleitKundePruefen(ein?.kunde);
  if (!k.ok) return nein(k.error);
  const parameter = begleitParameterAus(ein?.parameter);
  const pf = begleitParameterFehler(parameter) ?? begleitAnspracheFehler(parameter);
  if (pf) return nein(pf);
  const heute = berlinToday();
  const gueltigBis = ISO.test(String(ein?.gueltigBis ?? "")) ? String(ein.gueltigBis) : new Date(Date.parse(`${heute}T12:00:00Z`) + BEGLEIT_GUELTIG_TAGE * 864e5).toISOString().slice(0, 10);
  if (gueltigBis < heute) return nein("Das Datum „gültig bis“ liegt in der Vergangenheit.");
  const personId = Number(ein?.personId);
  const ref = `FIAON-IA-B${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, pruefbericht, status, gueltig_bis, erstellt_von, verlauf)
    VALUES (${ref}, ${Number.isInteger(personId) && personId > 0 ? personId : null}, ${fassung}, ${jsonb(k.kunde)}, ${jsonb(parameter)}, ${jsonb({})},
            ${null}, 'offen', ${gueltigBis}::date, ${wer}, ${jsonb([{ am: new Date().toISOString(), wer, was: "Begleitvertrag angelegt" }])})
    RETURNING id`) as any[];
  return { ok: true, id: Number(neu.id), ref, link: absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(ref, gueltigBis))) };
}
/** Ändern, solange niemand angenommen hat: Kunde, Parameter, Gültigkeit (Skript mit --aendern). */
export async function begleitAendern(id: number, ein: any, wer: string): Promise<Ergebnis<{ fehlt: string[] }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (String(z.status) !== "offen") return nein(`Das Angebot ist ${String(z.status)} — ändern geht nur, solange es offen ist.`, 409);
  const alt = begleitDatenAus(z); const altHash = begleitTextHash(alt);
  const neu: BegleitDaten = { ...alt }; const geaendert: string[] = [];
  if (ein?.parameter) { const par = begleitParameterAus(ein.parameter, alt.parameter); const f = begleitParameterFehler(par) ?? begleitAnspracheFehler(par); if (f) return nein(f); neu.parameter = par; geaendert.push("Parameter"); }
  if (ein?.kunde) { const k = begleitKundePruefen(ein.kunde); if (!k.ok) return nein(k.error); neu.kunde = k.kunde; geaendert.push("Kunde"); }
  if (ein?.gueltigBis !== undefined) { const g = String(ein.gueltigBis); if (!ISO.test(g) || g < berlinToday()) return nein("„Gültig bis“: ein Datum ab heute."); neu.gueltigBis = g; geaendert.push("Gültigkeit"); }
  if (!geaendert.length) return nein("Es wurde nichts geändert. Beim Begleitvertrag ändert das Skript Kunde, Parameter und Gültigkeit.");
  await sqlPool`
    UPDATE fiaon_global_angebote SET kunde = ${jsonb(neu.kunde)}, parameter = ${jsonb(neu.parameter)}, gueltig_bis = ${neu.gueltigBis}::date, updated_at = NOW()
     WHERE id = ${id} AND status = 'offen'`;
  await verlaufAngebot(id, wer, `geändert: ${geaendert.join(", ")}`, { alterHash: altHash });
  return { ok: true, fehlt: begleitPflichtFehlen(neu) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENSEITE (offen) und die Antwort nach der Annahme
// ═══════════════════════════════════════════════════════════════════════════
export async function begleitKundenSicht(token: string, z: AngebotZeile, opts: { leitung?: boolean } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const d = begleitDatenAus(z);
  const fehlt = begleitPflichtFehlen(d);
  const k = d.kunde;
  const annahme = begleitAnnahmeTexte(d);
  const body: BegleitKundenSicht = {
    ok: true, status: "offen", art: "begleit", ref: d.ref, fassung: d.fassung, gueltigBis: d.gueltigBis,
    kunde: { anrede: k.anrede, vorname: k.vorname, nachname: k.nachname, email: k.email },
    kundeAnrede: begleitKundeAnrede(k),
    seite: begleitSeite(d),
    ansprechpartner: begleitAnsprechpartner(d.parameter).map((p) => ({ ...p, portrait: `/portraits/${p.kuerzel}.jpg` })),
    uebersicht: begleitBestellUebersicht(d),
    annahme,
    annahmeBereit: fehlt.length === 0 && !opts.leitung,
    gesperrtGrund: fehlt.length ? annahme.gesperrt : null,
    ...(opts.leitung ? { vorschauLeitung: true, fehlt } : {}),
    html: begleitVorschauHtml(d),
    textHash: begleitTextHash(d),
    vertragPdf: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/vertrag.pdf`,
  };
  return { status: 200, body: body as unknown as Record<string, unknown> };
}
/** Dieselben Felder wie die Antwort des Individualangebots nach der Annahme — die Seite „fertig“ ist dieselbe. */
export async function begleitAngenommenAntwort(z: AngebotZeile): Promise<Record<string, unknown>> {
  const d = begleitDatenAus(z);
  const w = begleitWahlAus(z);
  const llc = w?.llc.wunsch || "Ihre Gesellschaft";
  const token = angebotTokenErzeugen(d.ref, d.gueltigBis);
  return {
    art: "begleit", startgespraech: null,
    ref: d.ref, auftragRef: null, email: d.kunde.email, sofortBeginn: w?.sofortBeginn === true,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null,
    betragCents: 0, zahlungsseite: null, meinAuftrag: null, rechnungUrl: null,
    vertragUrl: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/vertrag.pdf`,
    fertigTitel: BEGLEIT_ANNAHME.fertigTitel,
    fertigText: w?.sofortBeginn ? BEGLEIT_ANNAHME.fertigText(d.kunde.email, llc) : BEGLEIT_ANNAHME.fertigTextWartet(d.kunde.email, llc),
    teil1Bezahlt: true,
    fertigZahlung: BEGLEIT_ANNAHME.fertigZahlung,
    fertigFuss: BEGLEIT_ANNAHME.fertigFuss,
    llc: w?.llc ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANNAHME (gerufen aus annehmen() im Individualangebot: Token, Status, Leitung und Honigtopf sind dort geprüft)
// ═══════════════════════════════════════════════════════════════════════════
export async function begleitAnnehmen(z: AngebotZeile, body: any, kontext: AnnahmeKontext, helfer: { zuViel: (ip: string) => boolean }): Promise<{ status: number; body: Record<string, unknown> }> {
  const fehler = (status: number, error: string, extra: Record<string, unknown> = {}) => ({ status, body: { ok: false, error, ...extra } });
  const d = begleitDatenAus(z);
  const texte = begleitAnnahmeTexte(d);
  if (begleitPflichtFehlen(d).length) return fehler(409, texte.gesperrt, { code: "PFLICHTFELDER" });
  if (helfer.zuViel(kontext.ip)) return fehler(429, "Von Ihrem Anschluss kamen gerade mehrere Versuche. Bitte versuchen Sie es in einigen Minuten noch einmal.");
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(kontext.ip, kontext.userAgent).roboter) {
    return fehler(403, "Diese Annahme können wir nicht entgegennehmen. Bitte öffnen Sie die Seite in Ihrem Browser und nehmen Sie dort an.");
  }
  // Der Name der Gesellschaft ist Pflicht — geprüft HIER, nicht nur in der Oberfläche.
  const llc = llcWahlPruefen(body?.llc);
  if (!llc.ok) return fehler(400, llc.error, { code: "LLC", feld: llc.feld });
  if (body?.gelesen !== true) return fehler(400, BEGLEIT_ANNAHME.fehltGelesen, { code: "HAEKCHEN", fehlt: ["gelesen"] });
  const u = firmaUnterschriftPruefen(body?.unterschrift, { vertretung: { nachname: d.kunde.nachname } } as any);
  if (!u.ok) return fehler(400, u.error, { code: u.code });
  const hash = begleitTextHash(d);
  if (String(body?.textHash ?? "") !== hash) return fehler(409, BEGLEIT_ANNAHME.neuLaden, { code: "GEAENDERT" });

  const jetzt = new Date();
  const wahl: BegleitWahl = { llc: llc.wahl, sofortBeginn: body?.sofortBeginn === true, jahresbetreuung: body?.jahresbetreuung === true };
  const unterschrift: BegleitUnterschriftVermerk = { ...u.vermerk, am: jetzt.toISOString(), ip: kontext.ip };
  let pdf: Buffer;
  try {
    pdf = await begleitVertragPdf(d, { am: jetzt, ip: kontext.ip, userAgent: kontext.userAgent, hash, wahl, unterschrift });
    if (!pdf || pdf.length < 1000) throw new Error("PDF leer");
  } catch (e) {
    console.error(`[FIAON-BEGLEIT] ${d.ref}: Vertrags-PDF:`, e);
    return fehler(500, "Ihr Vertrag konnte gerade nicht ausgefertigt werden — bitte versuchen Sie es in einer Minute noch einmal. Es wurde nichts gespeichert.");
  }
  const schalter = { ...wahl, gelesen: true, unterschrift };
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote
       SET status = 'angenommen', angenommen_am = ${jetzt}, ip = ${kontext.ip}, user_agent = ${String(kontext.userAgent || "").slice(0, 500)},
           text_hash = ${hash}, schalter = ${jsonb(schalter)}, vertrag_pdf = ${pdf}, fassung = ${d.fassung}, updated_at = NOW()
     WHERE id = ${z.id} AND status = 'offen' AND gueltig_bis >= ${berlinToday()}::date AND updated_at::text = ${String(z.updated_at_txt)}
     RETURNING id`) as any[];
  if (!frei) {
    const neu = await angebotLesen({ id: Number(z.id) });
    if (neu && String(neu.status) === "angenommen") return { status: 200, body: { ok: true, schon: true, ...(await begleitAngenommenAntwort(neu)) } };
    if (neu && String(neu.status) === "offen") return fehler(409, BEGLEIT_ANNAHME.neuLaden, { code: "GEAENDERT" });
    return fehler(409, "Das Angebot lässt sich gerade nicht annehmen. Bitte laden Sie die Seite neu.");
  }
  await verlaufAngebot(Number(z.id), begleitKundeName(d.kunde), `angenommen (${BEGLEIT_KNOPF}) — Prüfsumme ${hash.slice(0, 12)}…, LLC „${wahl.llc.wunsch}“${wahl.llc.alternative1 ? ` (Ausweich: ${[wahl.llc.alternative1, wahl.llc.alternative2].filter(Boolean).join(", ")})` : ""}, sofortiger Beginn ${wahl.sofortBeginn ? "ja" : "nein"}, Jahresbetreuung ${wahl.jahresbetreuung ? "ja" : "nein"}, Unterschrift ${unterschrift.art}`);
  void import("./fiaon-global-angebot-aufrufe").then((m) => m.aufrufeAnnahmeVermerken(Number(z.id)))
    .catch((e) => console.error(`[FIAON-BEGLEIT] ${d.ref}: Annahme in der Aufruf-Aufgabe:`, e));
  void begleitNacharbeit(Number(z.id)).catch((e) => console.error(`[FIAON-BEGLEIT] ${d.ref}: Nacharbeit abgebrochen:`, e));
  return { status: 200, body: { ok: true, ...(await begleitAngenommenAntwort((await angebotLesen({ id: Number(z.id) }))!)) } };
}

/** Nach der Annahme: Aufgabe an Justin (wiederholbar über den Schlüssel) und sofort eine Mail an js@. */
export async function begleitNacharbeit(id: number): Promise<void> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen" || !istBegleitAngebot(z)) return;
  const d = begleitDatenAus(z); const w = begleitWahlAus(z); const par = d.parameter;
  const name = begleitKundeName(d.kunde);
  const namen = w ? [w.llc.wunsch, w.llc.alternative1, w.llc.alternative2].filter(Boolean) : [];
  const zeilen = [
    `GESELLSCHAFT: ${namen[0] ?? "—"}${namen.length > 1 ? ` · Ausweichnamen: ${namen.slice(1).join(" · ")}` : ""} — vor der Anmeldung auf Sunbiz prüfen (${par.bundesstaat}).`,
    w?.sofortBeginn ? "BEGINN: sofort (ausdrücklich verlangt) — Reisepass anfordern, Anmeldung binnen fünf Werktagen nach Eingang einreichen." : `BEGINN: nach Ablauf der Widerrufsfrist (${begleitTag(new Date(Date.parse(String(z.angenommen_am)) + 14 * 864e5).toISOString().slice(0, 10))}) — bis dahin nur vorbereiten.`,
    `ALTABO: Mitgliedschaft „${par.bisherMitgliedschaft}“ endet (Ziffer 2)${par.entfaelltAb ? ` — Beitrag zum ${begleitTag(par.entfaelltAb)}${par.entfaelltBetrag ? ` (${par.entfaelltBetrag})` : ""} und alle folgenden STORNIEREN (Raten-Storno), bevor gemahnt wird` : " — offene Beiträge stornieren"}.`,
    `GRÜNDUNGSKOSTEN: Selbstkosten mit Aufstellung, ${begleitEur(par.gruendungVonCents)} bis ${begleitEur(par.gruendungBisCents)}, HÖCHSTENS ${begleitEur(par.gruendungBisCents)} (mehr nur mit Zustimmung in Textform) — Rechnung erst nach Einreichung, Zahlungsziel ${par.zahlungszielTage} Tage.`,
    `ERFOLGSHONORAR: ${begleitProzent(par.honorarProzent)} je eingeräumter Finanzierung (Plan ${begleitUsd(par.kapitalUsd)} → ${begleitUsd(Math.round(par.kapitalUsd * par.honorarProzent / 100))}), fällig ${par.honorarZielTage} Tage nach Einräumung, in Euro zum EZB-Kurs.`,
    `JAHRESBETREUUNG: ${w?.jahresbetreuung ? "GEWÄHLT — 699 € je Jahr ab dem zweiten Jahr (Rechnung zum ersten Jahrestag der Eintragung)" : "nicht gewählt"}.`,
    `Vertrag (PDF mit Annahmevermerk) im Chefbüro: ${CHEF_LINK} — bitte heute per Mail an ${d.kunde.email} schicken (es geht keine automatische Mail raus).`,
  ];
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: z.person_id != null ? Number(z.person_id) : null, ref: null,
    titel: `Begleitvertrag angenommen: ${name} — LLC „${namen[0] ?? "?"}“ gründen`,
    text: [`${name} hat den Begleitvertrag ${d.ref} angenommen (${new Date(z.angenommen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}). Heute nichts fällig.`, ...zeilen].join("\n"),
    anBetreiber: true, dringend: true, schluessel: `global:${d.ref}:begleit-justin`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
    anlageText: `Begleitvertrag ${d.ref} angenommen.`,
  }).catch((e) => console.error(`[FIAON-BEGLEIT] ${d.ref}: Aufgabe an Justin:`, e));
  // Die Mail an Justin genau einmal (Marke bestaetigung_mail_am — beim Begleitvertrag gibt es keine Kundenbestätigung).
  const [marke] = (await sqlPool`
    UPDATE fiaon_global_angebote SET bestaetigung_mail_am = NOW(), updated_at = NOW()
     WHERE id = ${id} AND bestaetigung_mail_am IS NULL RETURNING id`) as any[];
  if (!marke) return;
  await import("./fiaon-global-angebot-aufrufe")
    .then((A) => A.annahmeMelden({ ref: d.ref, name, art: "Begleitvertrag", betrag: "heute nichts (Gründung zum Selbstkostenpreis nach Einreichung, Erfolgshonorar bei Einräumung)", zeilen }))
    .then((s) => console.log(`[FIAON-BEGLEIT] ${d.ref}: Annahme — ${s}`))
    .catch((e) => console.error(`[FIAON-BEGLEIT] ${d.ref}: Annahme-Mail an Justin:`, e));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LISTE DER LEITUNG (Reiter „Individualangebote“)
// ═══════════════════════════════════════════════════════════════════════════
export function begleitListenEintrag(z: AngebotZeile, ext: { heute: string; aufrufe: unknown }): Record<string, unknown> {
  const d = begleitDatenAus(z);
  const status = angebotStatusAus(z, ext.heute);
  const fehlt = begleitPflichtFehlen(d);
  const w = begleitWahlAus(z);
  return {
    art: "begleit",
    id: Number(z.id), ref: d.ref, status, fassung: d.fassung, personId: z.person_id ?? null,
    kunde: d.kunde, kundeName: begleitKundeName(d.kunde), parameter: d.parameter, gesamtCents: 0,
    fehlt, annahmeBereit: fehlt.length === 0 && status === "offen", versandSperre: null,
    gueltigBis: d.gueltigBis, erstelltAm: new Date(z.created_at).toISOString(), erstelltVon: z.erstellt_von ?? null,
    link: status === "offen" || status === "angenommen" ? absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(d.ref, d.gueltigBis))) : null,
    vertragUrl: `/api/fiaon/admin/global/angebote/${z.id}/vertrag.pdf`,
    pruefberichtUrl: null, anlage1Url: null, pruefbericht: null, buergin: null,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null, ip: z.ip ?? null, textHash: z.text_hash ?? null,
    schalter: w ? { sofortBeginn: w.sofortBeginn, jahresbetreuung: w.jahresbetreuung } : null,
    begleit: {
      llc: w?.llc ?? null,
      zeile: `Gründung zum Selbstkostenpreis (${begleitEur(d.parameter.gruendungVonCents)}–${begleitEur(d.parameter.gruendungBisCents)}) · Erfolgshonorar ${begleitProzent(d.parameter.honorarProzent)} · Plan ${begleitUsd(d.parameter.kapitalUsd)} · keine Monatsbeiträge`,
    },
    auftragRef: null, officeLink: null, teile: [],
    knoepfe: { meilenstein: "Begleitvertrag: keine Teile", erstattung: "Begleitvertrag: keine Erstattung", garantie: "Begleitvertrag: keine Garantie", hemmung: "Begleitvertrag: keine Frist", aendern: String(z.status) === "offen" ? "Begleitvertrag: Ändern per Skript (scripts/angebot-begleit-anlegen.ts --aendern)" : "Nur solange das Angebot offen ist." },
    verlauf: json<any[]>(z.verlauf, []).slice(-12),
    aufrufe: ext.aufrufe ?? null,
    startgespraech: null,
    zurueckgezogenAm: z.zurueckgezogen_am ? new Date(z.zurueckgezogen_am).toISOString() : null, zurueckgezogenGrund: z.zurueckgezogen_grund ?? null,
    bestaetigungMailAm: z.bestaetigung_mail_am ? new Date(z.bestaetigung_mail_am).toISOString() : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZAHLUNGSSEITE (E-318, 09.10.2026): Gehört eine Rechnung (llc_paket, llc_gruendung) zu einem angenommenen Begleitvertrag
// derselben Person, zeigt /zahlung/<Zweck> den Auftrag dazu. Der Vertrag NUR über den signierten Angebotslink.
// ═══════════════════════════════════════════════════════════════════════════
export async function begleitZahlungsKontext(a: { person_id?: unknown; payment_reference?: unknown; pack_key?: unknown; pack_name?: unknown; invoice_number?: unknown }): Promise<import("@shared/fiaon-zahlung-auftrag").ZahlungAuftragKontext | null> {
  const personId = Number(a.person_id);
  if (!Number.isInteger(personId) || personId <= 0) return null;
  const [z] = (await sqlPool`
    SELECT id FROM fiaon_global_angebote
     WHERE person_id = ${personId} AND status = 'angenommen' AND fassung LIKE 'IA-BEGLEIT-%'
     ORDER BY angenommen_am DESC LIMIT 1`.catch(() => [])) as any[];
  if (!z) return null;
  const zeile = await angebotLesen({ id: Number(z.id) });
  if (!zeile) return null;
  const d = begleitDatenAus(zeile);
  const token = angebotTokenErzeugen(d.ref, d.gueltigBis);
  const { signInvoiceUrl } = await import("../fiaon-invoice");
  const zweck = String(a.payment_reference ?? "");
  const paketName = String(a.pack_name ?? "");
  const gesellschaft = paketName.match(/([A-Z0-9][A-Z0-9 &,.'-]* LLC)\b/)?.[1] ?? null;
  const gruendung = String(a.pack_key ?? "") === "llc_gruendung";
  const angenommen = zeile.angenommen_am ? begleitTag(new Date(zeile.angenommen_am).toISOString().slice(0, 10)) : "";
  return {
    auge: "FIAON Global · Ihr Auftrag",
    gesellschaft,
    gesellschaftZeile: gesellschaft ? `Limited Liability Company · State of ${d.parameter.bundesstaat}` : "",
    satz: `Diese Rechnung gehört zu Ihrem Begleitvertrag ${d.ref}${angenommen ? `, angenommen am ${angenommen}` : ""}.`,
    dokumenteTitel: "Ihre Unterlagen",
    dokumente: [
      { titel: "Ihr Vertrag", unter: `${begleitVertragTitel()} · mit Annahmevermerk`, href: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/vertrag.pdf` },
      ...(zweck ? [{ titel: "Ihre Rechnung", unter: `${String(a.invoice_number ?? "Rechnung")} · ${paketName}`, href: signInvoiceUrl(zweck, 30 * 24 * 3600_000) }] : []),
    ],
    hinweis: "Zum Selbstkostenpreis, ohne Aufschlag — so steht es in Ziffer 4 Ihres Vertrags.",
    schritteTitel: "So geht es weiter",
    schritte: gruendung
      ? [
        { titel: "Ihre Zahlung", text: "Überweisen Sie die Rechnung mit Ihrem Verwendungszweck — am schnellsten als Echtzeitüberweisung." },
        { titel: `Anmeldung in ${d.parameter.bundesstaat}`, text: "Wir reichen die Anmeldung beim Bundesstaat (Sunbiz) ein und leiten die Gebühren an Ihren Registered Agent weiter." },
        { titel: "Ihre Gesellschaft steht", text: "Sobald der Bundesstaat einträgt, erhalten Sie Ihre Gründungsunterlagen. Danach folgen US-Steuernummer (EIN) und Geschäftskonto." },
      ]
      : [],
    ansprechTitel: "Ihre Ansprechpartner",
    ansprechpartner: begleitAnsprechpartner(d.parameter).map((p) => ({ ...p, portrait: `/portraits/${p.kuerzel}.jpg` })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-320 (09.10.2026): DIE ZAHLUNGSSEITE FÜR TEILE EINES INDIVIDUALANGEBOTS (E-268)
// Gesellschaft aus der Akte (fiaon_global_auftraege.gesellschaft), Rechnung signiert, Prüfliste aus der Akte (Reisepass im Dokumentenraum = „erhalten und geprüft“ — das Dokument selbst NIE auf der Seite).
// ═══════════════════════════════════════════════════════════════════════════
export async function angebotTeilZahlungsKontext(a: { ref?: unknown; payment_reference?: unknown; invoice_number?: unknown; payment_status?: unknown }): Promise<import("@shared/fiaon-zahlung-auftrag").ZahlungAuftragKontext | null> {
  const ref = String(a.ref ?? "");
  if (!ref) return null;
  const [t] = (await sqlPool`
    SELECT t.nr, t.titel, g.id AS angebot_id, g.angebot_ref, g.angenommen_am, g.auftrag_ref
      FROM fiaon_global_angebot_teile t JOIN fiaon_global_angebote g ON g.id = t.angebot_id
     WHERE t.bestell_ref = ${ref} AND g.status = 'angenommen' LIMIT 1`.catch(() => [])) as any[];
  if (!t) return null;
  const akteRef = String(t.auftrag_ref || ref);
  const [akte] = (await sqlPool`SELECT gesellschaft FROM fiaon_global_auftraege WHERE ref = ${akteRef} LIMIT 1`.catch(() => [])) as any[];
  const ges = json<{ name?: string | null; bundesstaat?: string | null }>(akte?.gesellschaft, {});
  const [pass] = (await sqlPool`SELECT created_at FROM fiaon_global_dokumente WHERE ref = ${akteRef} AND art = 'reisepass' AND geloescht_am IS NULL ORDER BY created_at LIMIT 1`.catch(() => [])) as any[];
  const { signInvoiceUrl } = await import("../fiaon-invoice");
  const { ANGEBOT_ANSPRECHPARTNER } = await import("@shared/fiaon-global-angebot");
  const zweck = String(a.payment_reference ?? "");
  const staatName: Record<string, string> = { FL: "Florida", WY: "Wyoming", DE: "Delaware", NM: "New Mexico" };
  const staat = ges.bundesstaat ? (staatName[String(ges.bundesstaat)] ?? String(ges.bundesstaat)) : "Florida";
  const name = ges.name ? String(ges.name).toUpperCase().replace(/\s*,?\s*L\.?L\.?C\.?$/, "").trim() + " LLC" : null;
  const tag = (v: unknown) => (v ? begleitTag(new Date(String(v)).toISOString().slice(0, 10)) : "");
  const bezahlt = String(a.payment_status) === "paid";
  return {
    auge: "FIAON Global · Ihr Auftrag",
    gesellschaft: name,
    gesellschaftZeile: name ? `Limited Liability Company · State of ${staat}` : "",
    satz: `Diese Rechnung gehört zu Ihrem Individualangebot ${t.angebot_ref}${t.angenommen_am ? `, angenommen am ${tag(t.angenommen_am)}` : ""} — ${String(t.titel)}.`,
    pruefTitel: "Stand Ihres Auftrags",
    pruefungen: [
      { titel: "Vertrag angenommen", text: t.angenommen_am ? `am ${tag(t.angenommen_am)} — mit Ihrer Unterschrift` : "mit Ihrer Unterschrift", stand: "ok" },
      ...(name ? [{ titel: "Name geprüft", text: `${name} ist im Register von ${staat} frei`, stand: "ok" as const }] : []),
      ...(pass ? [{ titel: "Reisepass erhalten und geprüft", text: `am ${tag(pass.created_at)} — liegt sicher in Ihrem Auftragsbereich`, stand: "ok" as const }] : []),
      { titel: bezahlt ? "Zahlung eingegangen" : "Ihre Zahlung", text: bezahlt ? "vielen Dank" : "der letzte Schritt vor der Anmeldung", stand: bezahlt ? "ok" : "offen" },
    ],
    dokumenteTitel: "Ihre Unterlagen",
    // NUR die Rechnung: Vertrag (mit Prüfbericht) und Auftragsbereich (mit dem Reisepass im Dokumentenraum) sind über die öffentliche
    // Zahlungsseite nicht erreichbar — beide über die persönlichen Links in den Mails an den Kunden.
    dokumente: zweck ? [{ titel: "Ihre Rechnung", unter: `${String(a.invoice_number ?? "Rechnung")} · ${String(t.titel)}`, href: signInvoiceUrl(zweck, 30 * 24 * 3600_000) }] : [],
    hinweis: "Ihren Vertrag und Ihren Auftragsbereich öffnen Sie über die persönlichen Links in unseren E-Mails.",
    schritteTitel: "So geht es weiter",
    schritte: [
      { titel: "Ihre Zahlung", text: "Überweisen Sie die Rechnung mit Ihrem Verwendungszweck — am schnellsten als Echtzeitüberweisung." },
      { titel: `Anmeldung in ${staat}`, text: "Wir reichen die Anmeldung Ihrer Gesellschaft beim Bundesstaat ein — Registered Agent und Geschäftsadresse stehen bereit." },
      { titel: "Ihre Gesellschaft steht", text: "Danach folgen US-Steuernummer (EIN), Geschäftskonto und die Anträge für Ihre Karten — Schritt für Schritt mit Ihnen." },
    ],
    ansprechTitel: "Ihre Ansprechpartner",
    ansprechpartner: ANGEBOT_ANSPRECHPARTNER.map((p) => ({ ...p, portrait: `/portraits/${p.kuerzel}.jpg` })),
  };
}
