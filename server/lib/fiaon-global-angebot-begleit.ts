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
//   · Keine Kundenmail und kein automatisches Startgespräch: Justin führt den Kunden persönlich. Bei der Annahme bleibt
//     auftrag_ref leer (es gibt noch keine Akte). E-451 (28.10.2026): Mit der Global-Akte („Global-Akte anlegen“, Abgleich)
//     wird auftrag_ref gesetzt — Stundenlauf/Nachholen, Startgespräch und Bestätigungsmail schließen den Begleitvertrag
//     ausdrücklich über die Fassung aus (fiaon-global-akte-komplett.ts, begleitAngebotVerknuepfen).
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
  begleitHashEingabe, begleitEur, begleitUsd, begleitProzent, begleitTag, llcWahlPruefen, BEGLEIT_PORTAL,
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
const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
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

/**
 * Der Name der Gesellschaft aus dem Titel einer Gründungs- oder Fast-Track-Rechnung („Gründung MUSTER LLC (Florida)“,
 * E-316/E-318). Die Leitung stellt diese Rechnungen erst, wenn der Name im Register geprüft ist — der Titel trägt also den
 * GEPRÜFTEN Namen (beim vergebenen Wunschnamen den Ausweichnamen). Nur Großbuchstaben, Ziffern und Satzzeichen vor „LLC“.
 */
export function begleitLlcAusRechnung(titel: unknown): string | null {
  return String(titel ?? "").match(/([A-Z0-9][A-Z0-9 &,.'-]* LLC)\b/)?.[1]?.trim() ?? null;
}
/** Die Pakete, deren Rechnungstitel den geprüften Namen trägt (nicht `llc_paket` — „GLOBAL LLC Package“ ist kein Name). */
export const BEGLEIT_NAMENS_RECHNUNGEN = ["llc_gruendung", "llc_gruendung_halb", "llc_fasttrack"] as const;

/**
 * „Mein Auftrag“ im Portal (22.10.2026): Ein Begleitvertrag hat keine Teile, keine Frist, keine Garantie und keine Bürgin —
 * sonst zeigte das Portal die Sätze des Individualangebots. Statt dessen der Vertrag mit seinen Worten (BEGLEIT_PORTAL).
 * Die Rechnungen (Gründung, Fast-Track) stehen im Portal ohnehin unter „Alle Rechnungen“. Nur lesen.
 */
export async function begleitSichtZurAkte(z: AngebotZeile): Promise<Record<string, unknown>> {
  const d = begleitDatenAus(z);
  const w = begleitWahlAus(z);
  return {
    art: "begleit", ref: d.ref, titel: BEGLEIT_PORTAL.titel, teile: [], summeCents: 0,
    garantieSatz: BEGLEIT_PORTAL.satz(d.parameter),
    jahresZeile: w?.jahresbetreuung ? BEGLEIT_PORTAL.jahresGewaehlt : null,
    seiteHinweis: BEGLEIT_PORTAL.seiteHinweis,
    startgespraech: null,
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
  // 27.10.2026: Ist der Name im Register geprüft (Akte: geprueft true), zeigt die Seite DIESEN Namen — beim vergebenen
  // Wunschnamen also den Ausweichnamen, wie Portal und Rechnungen. Vorher stand hier immer der Wunsch aus der Annahme.
  const [akte] = (await sqlPool`SELECT gesellschaft FROM fiaon_global_auftraege WHERE angebot_id = ${Number(z.id)} LIMIT 1`.catch(() => [])) as any[];
  const ges = json<Record<string, any>>(akte?.gesellschaft, {});
  const geprueft = ges.geprueft === true && typeof ges.name === "string" && ges.name.trim() ? ges.name.trim() : null;
  const llc = geprueft || w?.llc.wunsch || "Ihre Gesellschaft";
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
    llc: w?.llc ? (geprueft ? { ...w.llc, wunsch: geprueft } : w.llc) : null,
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
export async function begleitZahlungsKontext(a: { ref?: unknown; person_id?: unknown; payment_reference?: unknown; pack_key?: unknown; pack_name?: unknown; invoice_number?: unknown; payment_status?: unknown; paid_at?: unknown }): Promise<import("@shared/fiaon-zahlung-auftrag").ZahlungAuftragKontext | null> {
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
  const gesellschaft = begleitLlcAusRechnung(paketName);
  const gruendung = ["llc_gruendung", "llc_gruendung_halb"].includes(String(a.pack_key ?? ""));
  // E-322: Gründung in zwei Hälften — die jeweils andere Hälfte derselben Person (Betrag, Fälligkeit, signierte Rechnung).
  const halb = String(a.pack_key ?? "") === "llc_gruendung_halb";
  const zweite = halb && /Hälfte 2/.test(paketName);
  const [andere] = halb ? ((await sqlPool`
    SELECT payment_reference, invoice_number, amount_due, payment_due_date, payment_status FROM fiaon_applications
     WHERE person_id = ${personId} AND pack_key = 'llc_gruendung_halb' AND payment_reference <> ${String(a.payment_reference ?? "")}
       AND (payment_status IN ('pending_payment', 'claimed_paid', 'paid')
            -- E-384: eine gestundete Hälfte, die die Dubletten-Stilllegung automatisch beendet hatte, bleibt geschuldet
            OR (payment_status = 'superseded' AND superseded_by IS NOT NULL))
     ORDER BY created_at LIMIT 1`.catch(() => [])) as any[]) : [];
  const anderBetrag = andere ? begleitEur(Math.round(Number(andere.amount_due) * 100)) : "";
  const anderBis = andere?.payment_due_date ? begleitTag(new Date(andere.payment_due_date).toISOString().slice(0, 10)) : "";
  const angenommen = zeile.angenommen_am ? begleitTag(new Date(zeile.angenommen_am).toISOString().slice(0, 10)) : "";
  // E-384 (16.10.2026): Nach dem Zahlungseingang zeigt die Seite den Stand — Zahlung da, und wann die Anmeldung beginnt
  // (schalter.gruendungAb am Begleitvertrag, JJJJ-MM-TT; fehlt es, „als Nächstes“ ohne Datum — nie ein erfundenes).
  const bezahlt = String(a.payment_status ?? "") === "paid";
  const [eingang] = bezahlt ? ((await sqlPool`
    SELECT booked_at FROM fiaon_bank_txns WHERE matched_ref = ${String(a.ref ?? "")} AND booked_at IS NOT NULL ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[]) : [];
  const eingangAm = eingang?.booked_at ? begleitTag(berlinToday(new Date(eingang.booked_at))) : (a.paid_at ? begleitTag(berlinToday(new Date(String(a.paid_at)))) : "");
  const sch = json<Record<string, unknown>>(zeile.schalter, {});
  const abIso = typeof sch.gruendungAb === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sch.gruendungAb) ? sch.gruendungAb : "";
  const heute = berlinToday();
  const wochentag = abIso ? new Date(`${abIso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", timeZone: "Europe/Berlin" }) : "";
  const abText = abIso ? `${abIso > heute ? "ab" : "seit"} ${wochentag}, ${begleitTag(abIso)}` : "";
  const name = gesellschaft ?? (begleitWahlAus(zeile)?.llc.wunsch || null);
  return {
    auge: "FIAON Global · Ihr Auftrag",
    gesellschaft,
    gesellschaftZeile: gesellschaft ? `Limited Liability Company · State of ${d.parameter.bundesstaat}` : "",
    ...(bezahlt && gruendung ? { urkundeStand: abText ? `Anmeldung ${abText}` : "Anmeldung in Vorbereitung" } : {}),
    satz: bezahlt
      ? `Ihre Zahlung ist eingegangen — vielen Dank. ${abText ? `${gross(abText)} kümmern wir uns um die Gründung${name ? ` von ${name}` : " Ihrer Gesellschaft"}.` : `Als Nächstes kümmern wir uns um die Gründung${name ? ` von ${name}` : " Ihrer Gesellschaft"}.`} (Begleitvertrag ${d.ref}${angenommen ? `, angenommen am ${angenommen}` : ""})`
      : `Diese Rechnung gehört zu Ihrem Begleitvertrag ${d.ref}${angenommen ? `, angenommen am ${angenommen}` : ""}.`,
    ...(bezahlt && gruendung ? {
      pruefTitel: "Stand Ihres Auftrags",
      pruefungen: [
        { titel: "Vertrag angenommen", text: angenommen ? `am ${angenommen} — mit Ihrer Unterschrift` : "mit Ihrer Unterschrift", stand: "ok" as const },
        ...(name ? [{ titel: "Name geprüft", text: `${name} ist im Register von ${d.parameter.bundesstaat} frei`, stand: "ok" as const }] : []),
        { titel: "Zahlung eingegangen", text: eingangAm ? `am ${eingangAm} — vielen Dank` : "vielen Dank", stand: "ok" as const },
        { titel: `Anmeldung in ${d.parameter.bundesstaat}`, text: abText ? `${abText} — wir reichen sie beim Bundesstaat ein` : "als Nächstes — wir reichen sie beim Bundesstaat ein", stand: abIso && abIso <= heute ? "ok" as const : "offen" as const },
      ],
    } : {}),
    dokumenteTitel: "Ihre Unterlagen",
    dokumente: [
      { titel: "Ihr Vertrag", unter: `${begleitVertragTitel()} · mit Annahmevermerk`, href: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/vertrag.pdf` },
      ...(zweck ? [{ titel: zweite ? "Ihre zweite Rechnung (gestundet)" : "Ihre Rechnung", unter: `${String(a.invoice_number ?? "Rechnung")} · ${paketName}`, href: signInvoiceUrl(zweck, 30 * 24 * 3600_000) }] : []),
      ...(andere && !zweite && String(andere.payment_status) !== "superseded" ? [{ titel: "Ihre zweite Rechnung (gestundet)", unter: `${String(andere.invoice_number ?? "Rechnung")} · ${anderBetrag} · fällig mit dem ersten Geldeingang, spätestens ${anderBis}`, href: signInvoiceUrl(String(andere.payment_reference), 60 * 24 * 3600_000) }] : []),
    ],
    hinweis: halb
      ? (zweite
        ? "Diese zweite Hälfte der Gründungskosten haben wir für Sie vorab übernommen. Sie wird mit dem ersten Geldeingang Ihrer Gesellschaft fällig, spätestens zum Zahlungsziel oben."
        : bezahlt
          ? `Die zweite Hälfte der Gründungskosten${anderBetrag ? ` (${anderBetrag})` : ""} haben wir für Sie vorab übernommen — sie wird mit dem ersten Geldeingang Ihrer Gesellschaft fällig${anderBis ? `, spätestens am ${anderBis}` : ""}. Alles zum Selbstkostenpreis, ohne Aufschlag (Ziffer 4 Ihres Vertrags).`
          : `Wir kommen Ihnen entgegen: Heute ist nur die erste Hälfte fällig. Die zweite Hälfte${anderBetrag ? ` (${anderBetrag})` : ""} übernehmen wir für Sie vorab — sie wird mit dem ersten Geldeingang Ihrer Gesellschaft fällig${anderBis ? `, spätestens am ${anderBis}` : ""}. Alles zum Selbstkostenpreis, ohne Aufschlag (Ziffer 4 Ihres Vertrags).`)
      : "Zum Selbstkostenpreis, ohne Aufschlag — so steht es in Ziffer 4 Ihres Vertrags.",
    hinweisBetont: halb,
    schritteTitel: "So geht es weiter",
    schritte: gruendung
      ? [
        bezahlt
          ? { titel: "Ihre Zahlung", text: eingangAm ? `Eingegangen am ${eingangAm} — es ist nichts weiter zu tun.` : "Eingegangen — es ist nichts weiter zu tun." }
          : { titel: "Ihre Zahlung", text: "Überweisen Sie die Rechnung mit Ihrem Verwendungszweck — am schnellsten als Echtzeitüberweisung." },
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
export async function angebotTeilZahlungsKontext(a: { ref?: unknown; payment_reference?: unknown; invoice_number?: unknown; payment_status?: unknown; payment_due_date?: unknown }): Promise<import("@shared/fiaon-zahlung-auftrag").ZahlungAuftragKontext | null> {
  const ref = String(a.ref ?? "");
  if (!ref) return null;
  const [t] = (await sqlPool`
    SELECT t.nr, t.titel, t.zahlungsziel_tage, t.meilenstein_am, g.id AS angebot_id, g.angebot_ref, g.angenommen_am, g.auftrag_ref, g.fassung, g.parameter
      FROM fiaon_global_angebot_teile t JOIN fiaon_global_angebote g ON g.id = t.angebot_id
     WHERE t.bestell_ref = ${ref} AND g.status = 'angenommen' LIMIT 1`.catch(() => [])) as any[];
  if (!t) return null;
  const akteRef = String(t.auftrag_ref || ref);
  const [akte] = (await sqlPool`SELECT gesellschaft FROM fiaon_global_auftraege WHERE ref = ${akteRef} LIMIT 1`.catch(() => [])) as any[];
  const ges = json<{ name?: string | null; bundesstaat?: string | null; geprueft?: boolean }>(akte?.gesellschaft, {});
  // E-443 (28.10.2026, Gutachten): ein als „bitte neu“ markierter Pass zählt nicht (wie im Portal) — die Spalte legt
  // ensureGlobalBereich an; scheitert das, bleibt der Pass wie bisher „nicht da“ (catch), nie „erhalten“.
  await import("./fiaon-global-bereich").then((m) => m.ensureGlobalBereich()).catch(() => {});
  const [pass] = (await sqlPool`SELECT created_at FROM fiaon_global_dokumente WHERE ref = ${akteRef} AND art = 'reisepass' AND geloescht_am IS NULL AND abgelehnt_am IS NULL ORDER BY created_at LIMIT 1`.catch(() => [])) as any[];
  const { signInvoiceUrl } = await import("../fiaon-invoice");
  const { ANGEBOT_ANSPRECHPARTNER } = await import("@shared/fiaon-global-angebot");
  const zweck = String(a.payment_reference ?? "");
  const staatName: Record<string, string> = { FL: "Florida", WY: "Wyoming", DE: "Delaware", NM: "New Mexico" };
  const staat = ges.bundesstaat ? (staatName[String(ges.bundesstaat)] ?? String(ges.bundesstaat)) : "Florida";
  const name = ges.name ? String(ges.name).toUpperCase().replace(/\s*,?\s*L\.?L\.?C\.?$/, "").trim() + " LLC" : null;
  const tag = (v: unknown) => (v ? begleitTag(new Date(String(v)).toISOString().slice(0, 10)) : "");
  const bezahlt = String(a.payment_status) === "paid";
  const kapital = String(t.fassung ?? "").startsWith("IA-KAPITAL-");
  // E-432 (28.10.2026, Justin: „Die Rechnung ist eigentlich umgehend, also sofort fällig“): Die Seite nennt das Datum aus der
  // Bestellung (payment_due_date) statt „binnen 7 Tagen“ — das zählte nicht herunter und stand als Ziffer da. Fällig ist der Betrag
  // mit dem Auftrag; das Datum ist der späteste Zahltag laut Vertrag. Liegt er heute oder davor: „bitte heute überweisen“.
  // Nie „überfällig“, „Mahnung“ oder „Verzug“ auf dieser Seite.
  const faelligIso = a.payment_due_date && !Number.isNaN(new Date(String(a.payment_due_date)).getTime()) ? berlinToday(new Date(String(a.payment_due_date))) : null;
  const spaeter = !!faelligIso && faelligIso > berlinToday();
  const zahlZeile = (nachher: string) => spaeter
    ? `fällig mit Ihrem Auftrag — bitte jetzt überweisen, spätestens bis zum ${begleitTag(faelligIso)}${nachher}`
    : `fällig mit Ihrem Auftrag — bitte heute überweisen${nachher}`;
  const spaetereZeile = spaeter ? `bitte überweisen — spätestens bis zum ${begleitTag(faelligIso)}` : "bitte überweisen";
  // E-432 (Runde 2, Technik): Fassung C (Privatperson) hat eigene Texte für Teil 2 (Erfolgshonorar mit der Eintragung — die Bürgin
  // ist dort nicht „zugesagt“) und nur die Ansprechpartner aus dem Angebot (nicht das ganze Team).
  const { istKapitalCFassung } = await import("@shared/fiaon-global-angebot-kapital");
  const KC = istKapitalCFassung(t.fassung) ? await import("@shared/fiaon-global-angebot-kapital-c") : null;
  const { portraitUrl } = await import("@shared/fiaon-portraits");
  const ansprechpartner = KC
    ? KC.kapitalCAnsprechpartner(KC.kapitalCParameterAus(json<any>(t.parameter, {}))).map((p) => ({ ...p, portrait: portraitUrl(p.kuerzel) }))
    : ANGEBOT_ANSPRECHPARTNER.map((p) => ({ ...p, portrait: `/portraits/${p.kuerzel}.jpg` }));
  const ansprechTitel = KC && ansprechpartner.length === 1 ? "Ihr Ansprechpartner" : "Ihre Ansprechpartner";
  if (KC && Number(t.nr) >= 2) {
    const c = KC.kapitalCZahlungsseiteTeil2({
      bezahlt, angebotRef: String(t.angebot_ref), titel: String(t.titel), eingetragenAm: t.meilenstein_am ? new Date(String(t.meilenstein_am)).toISOString().slice(0, 10) : null,
      zielWochen: KC.kapitalCParameterAus(json<any>(t.parameter, {})).zielWochen,
    });
    return {
      auge: "FIAON Global · Ihr Auftrag",
      gesellschaft: name,
      gesellschaftZeile: name ? `Limited Liability Company · State of ${staat}` : "",
      satz: c.satz,
      pruefTitel: "Stand Ihres Auftrags",
      pruefungen: [
        { titel: "Vertrag angenommen", text: t.angenommen_am ? `am ${tag(t.angenommen_am)} — mit Ihrer Unterschrift` : "mit Ihrer Unterschrift", stand: "ok" },
        { titel: c.pruefung.titel, text: c.pruefung.text, stand: "ok" as const },
        { titel: bezahlt ? "Zahlung eingegangen" : "Nur noch: Ihre Zahlung", text: bezahlt ? "vielen Dank" : spaetereZeile, stand: bezahlt ? "ok" : "offen" },
      ],
      dokumenteTitel: "Ihre Unterlagen",
      dokumente: zweck ? [{ titel: "Ihre Rechnung", unter: `${String(a.invoice_number ?? "Rechnung")} · ${String(t.titel)}`, href: signInvoiceUrl(zweck, 30 * 24 * 3600_000) }] : [],
      hinweis: "Ihren Vertrag und Ihren Auftragsbereich öffnen Sie über die persönlichen Links in unseren E-Mails.",
      schritteTitel: "So geht es weiter",
      schritte: c.schritte,
      ansprechTitel, ansprechpartner,
    };
  }
  // E-401: Die zwei späteren Rechnungen des Kapital-Angebots (Teil 2 Bürgschaftsgebühr, Teil 3 bei Auszahlung) — die Gesellschaft
  // steht längst; die Seite spricht vom Anlass der Rechnung statt von der Anmeldung.
  if (kapital && Number(t.nr) >= 2) {
    const buergschaft = Number(t.nr) === 2;
    const am = t.meilenstein_am ? ` am ${tag(t.meilenstein_am)}` : "";
    const ziel = spaetereZeile;
    return {
      auge: "FIAON Global · Ihr Auftrag",
      gesellschaft: name,
      gesellschaftZeile: name ? `Limited Liability Company · State of ${staat}` : "",
      satz: bezahlt
        ? `Ihre Zahlung ist eingegangen — vielen Dank. Angebot ${t.angebot_ref}, ${String(t.titel)}.`
        : buergschaft
          ? `Die Bürgschaft für Ihre Finanzierung steht — offen ist nur noch die Bürgschaftsgebühr (Angebot ${t.angebot_ref}).`
          : `Ihre Finanzierung ist ausgezahlt — offen ist nur noch die vereinbarte Vergütung (Angebot ${t.angebot_ref}).`,
      pruefTitel: "Stand Ihres Auftrags",
      pruefungen: [
        { titel: "Vertrag angenommen", text: t.angenommen_am ? `am ${tag(t.angenommen_am)} — mit Ihrer Unterschrift` : "mit Ihrer Unterschrift", stand: "ok" },
        buergschaft
          ? { titel: "Bürgschaft zugesagt", text: `gegenüber dem Institut${am} (Ziffer 5 und Ziffer 6 Absatz 2)`, stand: "ok" as const }
          : { titel: "Finanzierung ausgezahlt", text: `${am ? am.trim() : "ausgezahlt"} — Sie können die Rechnung aus den Mitteln zahlen (Ziffer 6 Absatz 3)`, stand: "ok" as const },
        { titel: bezahlt ? "Zahlung eingegangen" : "Nur noch: Ihre Zahlung", text: bezahlt ? "vielen Dank" : ziel, stand: bezahlt ? "ok" : "offen" },
      ],
      dokumenteTitel: "Ihre Unterlagen",
      dokumente: zweck ? [{ titel: "Ihre Rechnung", unter: `${String(a.invoice_number ?? "Rechnung")} · ${String(t.titel)}`, href: signInvoiceUrl(zweck, 30 * 24 * 3600_000) }] : [],
      hinweis: "Ihren Vertrag und Ihren Auftragsbereich öffnen Sie über die persönlichen Links in unseren E-Mails.",
      schritteTitel: "So geht es weiter",
      schritte: [
        { titel: "Ihre Zahlung", text: "Überweisen Sie die Rechnung mit Ihrem Verwendungszweck — am schnellsten als Echtzeitüberweisung." },
        buergschaft
          ? { titel: "Auszahlung", text: "Das Institut stimmt die Form der Bürgschaft ab und zahlt die Finanzierung an Sie aus — wir begleiten jeden Schritt." }
          : { titel: "Begleitung läuft weiter", text: "Wir begleiten Ihre Gesellschaft weiter — Pflichtenkalender, Meldungen und die nächsten Schritte mit Ihnen." },
      ],
      ansprechTitel: "Ihre Ansprechpartner",
      ansprechpartner: ANGEBOT_ANSPRECHPARTNER.map((p) => ({ ...p, portrait: `/portraits/${p.kuerzel}.jpg` })),
    };
  }
  return {
    auge: "FIAON Global · Ihr Auftrag",
    gesellschaft: name,
    gesellschaftZeile: name ? `Limited Liability Company · State of ${staat}` : "",
    // E-399: Das Kapital-Angebot beginnt laut Vertrag mit dem Zahlungseingang (Ziffer 6) — kein „bereits begonnen“, und das Zahlungsziel aus dem Teil.
    satz: bezahlt
      ? `Ihre Zahlung ist eingegangen — vielen Dank. ${kapital ? "Angebot" : "Individualangebot"} ${t.angebot_ref}, ${String(t.titel)}.`
      : kapital
        ? `Ihr Auftrag steht — mit Ihrer Zahlung legen wir los (Angebot ${t.angebot_ref}, ${String(t.titel)}).`
        : `Wir haben mit der Umsetzung Ihres Auftrags bereits begonnen — offen ist nur noch diese Rechnung (Individualangebot ${t.angebot_ref}, ${String(t.titel)}).`,
    pruefTitel: "Stand Ihres Auftrags",
    pruefungen: [
      { titel: "Vertrag angenommen", text: t.angenommen_am ? `am ${tag(t.angenommen_am)} — mit Ihrer Unterschrift` : "mit Ihrer Unterschrift", stand: "ok" },
      // E-399: Ein bei der Annahme gewählter Name ist erst „vorgemerkt“ (geprueft: false), bis ihn jemand im Register geprüft hat.
      ...(name ? [ges.geprueft === false
        ? { titel: "Wunschname vorgemerkt", text: `${name} — wir prüfen ihn vor der Anmeldung im Register von ${staat}`, stand: "offen" as const }
        : { titel: "Name geprüft", text: `${name} ist im Register von ${staat} frei`, stand: "ok" as const }] : []),
      ...(pass ? [{ titel: "Reisepass erhalten und geprüft", text: `am ${tag(pass.created_at)} — liegt sicher in Ihrem Auftragsbereich`, stand: "ok" as const }] : []),
      ...(name && pass && !bezahlt && ges.geprueft !== false ? [{ titel: "Anmeldung vorbereitet", text: "im Eilverfahren — wir reichen sie direkt nach Ihrer Zahlung ein", stand: "ok" as const }] : []),
      { titel: bezahlt ? "Zahlung eingegangen" : "Nur noch: Ihre Zahlung", text: bezahlt ? "vielen Dank" : kapital ? zahlZeile("; mit dem Eingang melden wir Ihre Gesellschaft an") : "heute überweisen — dann geht die Anmeldung raus", stand: bezahlt ? "ok" : "offen" },
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
    ansprechTitel, ansprechpartner,
  };
}
