// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS KAPITAL-ANGEBOT, FASSUNG C (PRIVATPERSONEN): ABLAUF (Register E-432, 27.10.2026)
//
// Texte, Vertrag, Rechner und Regeln: shared/fiaon-global-angebot-kapital-c.ts. Eingehängt wie Fassung A/B: Jede Stelle in
// server/lib/fiaon-global-angebot-kapital.ts verzweigt VOR kapitalDatenAus hierher —
//   if (istKapitalCFassung(z.fassung)) return (await import("./fiaon-global-angebot-kapital-c")).kapitalC…(…)
// Grund: Fassung A/B lesen kunde.firma/vertretung — eine Privatperson hat keine Firma.
//
// ── DER WEG ───────────────────────────────────────────────────────────────
//   Anlegen NUR per Skript (scripts/angebot-kapital-anlegen.ts mit kunde.art „privat“) → Teil 1 (Gründung + Fast-Track) steht
//   sofort → signierter Link → Seite /business/angebot/:token (Rechner, Name, Unterschrift) → Annahme mit Laufzeit, LLC-Namen,
//   „gelesen“, ausdrücklichem Sofortbeginn (Pflicht für den Fast-Track), Unterschrift und Prüfsumme → Vertrags-PDF mit
//   Annahmevermerk und Widerrufsbelehrung → kapitalCFertigstellen: Bestellzeile global_individuell OHNE Firma (Privatperson,
//   Endpreis, keine Umsatzsteuer-Umkehr), Akte (firma.art „privat“ — „Mein Auftrag“ zeigt das Widerrufsrecht; kapitalangebot +
//   kapitalPrivat), Rechnung → Vertragsbestätigung an den Kunden (§ 312f BGB, automatisch: Vertrag + Rechnung als PDF, welcome@;
//   Marke fiaon_global_auftraege.auftrag_mail_am) → Aufgabe + Mail an Justin.
//   Die Vertragsbestätigung ist die bewusste Ausnahme zu E-301 („keine automatische Mail an Firmenkunden“): Fassung C schließt mit
//   einem Verbraucher, ohne Bestätigung auf einem dauerhaften Datenträger darf FIAON nicht beginnen. Ging sie nicht raus, sagt die
//   Start-Aufgabe nach der Zahlung „ERST Vertragsbestätigung senden“ (Nachprüfung 27.10.2026).
//   Teil 2 (Erfolgshonorar) per Chefbüro-Knopf „Gesellschaft eingetragen“ (Route …/kapital/buergschaft — dieselbe Route wie
//   Teil 2 der Fassung B, hier mit den Texten der Fassung C). Teil 3 gibt es nicht.
//
// ── RUNDE 2 (27.10.2026) ──────────────────────────────────────────────────
//   · ZUSTELLUNG: „raus“ heißt nur „Brevo hat angenommen“. kapitalCZustellungLauf (stündlich aus kapitalFristLauf) liest den
//     Zustellstand der Vertragsbestätigung (Mailprotokoll + Brevo-Ereignisse): gebounct/blockiert/spam → Marke zurück auf NULL,
//     Fehler „nicht zugestellt: …“ und eine dringende Aufgabe; nach zwei Stunden ohne Zustellung → Aufgabe „bitte prüfen“.
//     Beim Zahlungseingang beginnt FIAON nur mit ZUGESTELLTER Bestätigung — sonst sagt die Start-Aufgabe „ERST …“.
//   · Der Browser bekommt nur einen geheimen Fingerabdruck der Prüfsumme (HMAC) — die SHA-256 über den Vertrag mit den vollen
//     Ausweisnummern bleibt im Server und im PDF des angenommenen Vertrags. Das Entwurfs-PDF trägt nur die Kennung.
//   · Ändern nur bei Fassung C; „Finanzierung ausgezahlt“ erst, wenn die Frist läuft; Fertig-Ansicht mit Ansprechpartner des Angebots.
//
// ── E-487 (09.11.2026): DIE TEMPO-FASSUNG „VORRANG“ ───────────────────────
//   · kapitalCDatenAus setzt parameter.tempoFassung beim Lesen (kapitalCTempoFassungAus): Jedes nicht angenommene Angebot liest den
//     heutigen Wortlaut (Fast-Track = Vorrang in allen Schritten, keine „72 Stunden“) — ohne Schreiben in der Datenbank. Die Annahme
//     hält die Fassung in schalter.tempoFassung fest (kapitalCSchalterBeiAnnahme). Angenommene Verträge ohne diesen Vermerk (vor E-487)
//     lesen sich wortgleich wie bei der Annahme: Prüfsumme = gespeicherte Prüfsumme, Vertragsbestätigung („Auftragsmail nachholen“)
//     und Start-Aufgabe unverändert.
//   · Nachbesserung (Gutachten, 09.11.2026): Ein angenommener Vertrag liest seine Tempo-Fassung NUR aus dem Annahmevermerk (nie aus den
//     gespeicherten Parametern); die Vertragsbestätigung baut kapitalCBestaetigungAbsaetze (rein, Prüfstand); mit Angaben vom Kunden
//     zählt für die Frist der spätere Eingang (Zahlung oder Reisepass) — kommt der Pass erst nach der Zahlung, legt
//     kapitalCReisepassEingang die Aufgabe „Reisepass da“ mit dem Datum an (gerufen aus globalKundenDokument, also für Angebotsseite
//     und „Mein Auftrag“).
// ═══════════════════════════════════════════════════════════════════════════
import { randomBytes, timingSafeEqual } from "node:crypto";
import { kapitalRuhenLage } from "@shared/fiaon-global-angebot-kapital-ruhen";
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";
import { wrapFiaonDocument, htmlZuPdfMitFusszeile, docHash } from "./fiaon-html-pdf";
import { GLOBAL_VERTRAG_CSS } from "./fiaon-global-vertrag";
import { ANGEBOT_VERTRAG_CSS } from "./fiaon-global-angebot-vertrag";
import {
  ensureAngebotTabellen, angebotLesen, angebotTokenErzeugen, angebotKundenPfad, angebotStatusAus, verlaufAngebot, angebotGeheimFingerabdruck,
  angebotTokenPruefen, angebotLinkAbgelaufen,
  ANGEBOT_PAKET_KEY, type AngebotZeile, type AnnahmeKontext,
} from "./fiaon-global-angebot";
import { portraitUrl, portraitMitKi, portraitAlt, KI_PORTRAIT_HINWEIS } from "@shared/fiaon-portraits";
import { firmaUnterschriftPruefen } from "./fiaon-global-angebot-firma";
import { globalAkteLesen, globalBestellungLesen, globalMeinAuftragUrl, globalVerlauf, globalVertragPdfLesen, globalRechnungPdf } from "./fiaon-global-auftrag";
import { GLOBAL_ROLLEN } from "@shared/fiaon-global";
import { kapitalBuerginAus } from "./fiaon-global-angebot-kapital";
import { globalChefMandatPfad, globalOfficeAuftragPfad } from "@shared/fiaon-global-wege";
import { zahlwort } from "@shared/fiaon-global-angebot-firma";
import { llcWahlPruefen } from "@shared/fiaon-global-angebot-begleit";
import type { FirmaKunde } from "@shared/fiaon-global-angebot-firma-typen";
import { KAPITAL_KNOPF, KAPITAL_C_FASSUNGEN, istKapitalCFassung, kapitalEur, kapitalTag, type KapitalUnterschriftVermerk } from "@shared/fiaon-global-angebot-kapital";
import { staatRegisterIntern } from "@shared/fiaon-global-bundesstaaten";
import {
  KAPITAL_C_FASSUNG, KAPITAL_C_GUELTIG_TAGE, KAPITAL_C_TEIL1_TITEL, KAPITAL_C_TEIL2, KAPITAL_C_AUSZAHLUNG, KAPITAL_C_ANNAHME, KAPITAL_C_MARKE, KAPITAL_C_BESTAETIGUNG, kapitalCAuszahlungPruefen,
  kapitalCParameterAus, kapitalCParameterFehler, kapitalCKundePruefen, kapitalCBuerginFehler, kapitalCPflichtFehlen,
  kapitalCSeite, kapitalCBestellUebersicht, kapitalCAnnahmeTexte, kapitalCAnsprechpartner, kapitalCAnrede, kapitalCGruss, kapitalCName,
  kapitalCVertragTitel, kapitalCVertragUnterzeile, kapitalCRumpfHtml, kapitalCHashEingabe, kapitalCHeuteCents, kapitalCLaufzeitGueltig,
  kapitalCLaufzeitSatz, kapitalCPlan, kapitalCEurCent, kapitalCEur, kapitalCTeil2Pruefen, kapitalCMeinAuftrag, kapitalCStartAufgabe, kapitalCFristAufgabe,
  kapitalCVertragsstand, kapitalCZahlbar,
  kapitalCKundeStrenge, kapitalCAngabenPruefen, kapitalCAngabenFehlen, kapitalCMitFastTrack, kapitalCTeil1Titel, KAPITAL_C_ANGABEN, KAPITAL_C_REISEPASS,
  KAPITAL_C_TEMPO_FASSUNG, kapitalCTempoFassungAus, kapitalCRuhenErweitert, kapitalCNeuesAngebotParameter, kapitalCBestaetigungAbsaetze, kapitalCReisepassAufgabe,
  kapitalCRahmenGueltig, kapitalCRahmenAnwenden, kapitalCUsd,
  kapitalCTeil1TitelFuer, kapitalCTeil2Fuer, kapitalCBestandStamm,
  type KapitalCDaten, type KapitalCKunde, type KapitalCWahl, type KapitalCAnnahmeVermerk, type KapitalCKundenSicht, type KapitalCParameter, type KapitalCPlan,
} from "@shared/fiaon-global-angebot-kapital-c";

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
type Ergebnis<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const nein = (error: string, status = 400) => ({ ok: false as const, status, error });
const CHEF_LINK = "/chef/s/global-auftraege?reiter=angebote";
const STAAT_KURZ: Record<string, string> = { Florida: "FL", Wyoming: "WY", Delaware: "DE", "New Mexico": "NM" };
const RECHNUNG_STEHT = ["pending_payment", "claimed_paid", "paid"];

// ═══════════════════════════════════════════════════════════════════════════
// LESEN
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalCDatenAus(z: AngebotZeile): KapitalCDaten {
  const roh = json<any>(z.kunde, {});
  const parameter = kapitalCParameterAus(json<Partial<KapitalCParameter>>(z.parameter, {}));
  // E-487: die Tempo-Fassung beim Lesen — nicht angenommen → die aktuelle (kein Schreiben nötig); angenommen → die der Annahme
  // (schalter.tempoFassung), fehlt sie → leer = vor E-487 angenommen, Wortlaut wie damals. „Angenommen“ zählt auch, wenn ein
  // angenommener Vertrag später einen anderen Stand bekommt (angenommen_am bleibt). Nachbesserung (Gutachten): parameter.tempoFassung
  // aus der Datenbank zählt dabei nie — nur der Annahmevermerk sagt, welchen Wortlaut der Kunde angenommen hat.
  parameter.tempoFassung = kapitalCTempoFassungAus({
    angenommen: String(z.status) === "angenommen" || !!z.angenommen_am,
    schalter: json<Record<string, unknown>>(z.schalter, {}),
  });
  // E-474: mit datenVomKunden gehört kein Ausweis zum Vertrag (der Reisepass kommt nach der Annahme) — sonst streng wie bisher.
  const k = kapitalCKundePruefen(roh, kapitalCKundeStrenge(parameter));
  return {
    ref: String(z.angebot_ref),
    // Ein OFFENES Angebot zeigt immer den aktuellen Wortlaut der Fassung C; ein angenommenes behält seine.
    fassung: String(z.status) === "offen" ? KAPITAL_C_FASSUNG : String(z.fassung),
    kunde: k.ok ? k.kunde : ({ art: "privat", anrede: "", vorname: "", nachname: "", geburtsdatum: "", geburtsort: "", staatsangehoerigkeit: "", strasse: "", plz: "", ort: "", land: "DE", email: "", telefon: "", ausweise: [], ...roh } as KapitalCKunde),
    buergin: kapitalBuerginAus(json<any>(z.buergin, {})),
    parameter,
    gueltigBis: isoTag(z.gueltig_bis) ?? berlinToday(),
  };
}
export function kapitalCWahlAus(z: AngebotZeile): (KapitalCWahl & { unterschrift: KapitalUnterschriftVermerk | null }) | null {
  const s = json<Record<string, any>>(z.schalter, {});
  if (!s.llc || typeof s.llc !== "object") return null;
  return {
    llc: { wunsch: String(s.llc.wunsch ?? ""), alternative1: String(s.llc.alternative1 ?? ""), alternative2: String(s.llc.alternative2 ?? "") },
    laufzeitJahre: Number(s.laufzeitJahre) || 0,
    // E-474: Bestand trägt immer „sofort“; mit fastTrackWahl steht die Wahl in schalter.fastTrack (ohne Fast-Track kein Sofortbeginn).
    sofortBeginn: s.sofortBeginn !== false,
    ...(typeof s.fastTrack === "boolean" ? { fastTrack: s.fastTrack } : {}),
    unterschrift: s.unterschrift && typeof s.unterschrift === "object" ? (s.unterschrift as KapitalUnterschriftVermerk) : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSUMME, HTML, PDF
// ═══════════════════════════════════════════════════════════════════════════
/** Die Prüfsumme läuft über den VOLLSTÄNDIGEN Rumpf (so steht er im angenommenen Vertrag) — die gekürzte Darstellung ändert sie nicht. */
export function kapitalCTextHash(d: KapitalCDaten): string { return docHash(kapitalCHashEingabe(d, kapitalCRumpfHtml(d, null))); }
/**
 * Was der Browser als „textHash“ bekommt und bei der Annahme zurückschickt: ein GEHEIMER Fingerabdruck der Prüfsumme (HMAC, Runde 2).
 * Die echte SHA-256 läuft über den Vertrag mit den VOLLSTÄNDIGEN Ausweisnummern — aus ihr ließen sich die gekürzten Nummern der
 * Seite durch Probieren zurückrechnen. Im angenommenen Vertrag (PDF, Annahmevermerk, Datenbank) steht weiter die echte SHA-256.
 */
export function kapitalCSichtHash(d: KapitalCDaten): string { return angebotGeheimFingerabdruck("kapital-c-text", kapitalCTextHash(d)); }
function gleich(a: string, b: string): boolean {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
/** Was über den Link erreichbar ist, solange das Angebot offen ist (Seite, Entwurfs-PDF): Ausweisnummern gekürzt (§ 20 PAuswG). */
const UEBER_DEN_LINK = { ausweiseGekuerzt: true } as const;
const BILDSCHIRM_CSS = `${GLOBAL_VERTRAG_CSS}${ANGEBOT_VERTRAG_CSS}`;
function escape(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
export function kapitalCVorschauHtml(d: KapitalCDaten): string {
  return `<style>${BILDSCHIRM_CSS}</style>
<div class="gv" lang="de"><h1 class="gv-titel">${escape(kapitalCVertragTitel())}</h1><p class="gv-unterzeile">${escape(kapitalCVertragUnterzeile(d))}</p></div>
${kapitalCRumpfHtml(d, null, UEBER_DEN_LINK)}`;
}
const PDF_CSS = `
  body { font-weight: 400; color: #0f2044; }
  .wordmark { font-weight: 300; letter-spacing: .18em; color: #0f2044; font-size: 17pt; }
  header.doc { border-bottom: 1px solid #0f2044; }
  h1.doc-title { font-weight: 300; font-size: 15pt; line-height: 1.25; color: #0f2044; letter-spacing: -.01em; }
  .doc-subtitle { color: #64748b; text-align: left; }
  footer.doc { display: none; }
  ${BILDSCHIRM_CSS}
  .gv-anlage { break-before: page; page-break-before: always; }
`;
const MARKENZEILE = "FIAON LTD · Company No. 17318250 · 128 City Road, London, EC1V 2NX, United Kingdom";
const RAND = { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" };
export async function kapitalCVertragPdf(d: KapitalCDaten, annahme: KapitalCAnnahmeVermerk | null): Promise<Buffer> {
  const titel = kapitalCVertragTitel();
  const html = wrapFiaonDocument({
    // Angenommen: der vollständige Vertrag (Kunde und Akte). Entwurf: über den Link erreichbar — Ausweisnummern gekürzt.
    documentTitle: titel, subtitle: kapitalCVertragUnterzeile(d), bodyHtml: kapitalCRumpfHtml(d, annahme, annahme ? {} : UEBER_DEN_LINK),
    watermark: annahme ? null : "Angebot — nicht angenommen", markenzeile: MARKENZEILE, zusatzCss: PDF_CSS,
  });
  // Runde 2: „Vertragsstand“ statt der internen Kennung; der Entwurf trägt nur die geheime Kennung (keine Teile der echten SHA-256).
  // E-487 (Gutachten): mit der Tempo-Fassung — die Vorrang-Fassung trägt ihren Stand (leer: wie bisher).
  const stand = kapitalCVertragsstand(d.fassung, d.parameter.tempoFassung);
  return htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · Company No. 17318250${stand ? ` · Vertragsstand ${stand}` : ""} · Angebot ${d.ref}${annahme ? "" : ` · Entwurf · Kennung ${kapitalCSichtHash(d).slice(0, 12)}`}`, rand: RAND, keinNotbehelf: !!annahme });
}
export async function kapitalCPdfErzeugen(z: AngebotZeile, art: "vertrag" | "pruefbericht" | "anlage1"): Promise<{ status: number; pdf?: Buffer; dateiname?: string; error?: string }> {
  const d = kapitalCDatenAus(z);
  if (art !== "vertrag") return { status: 404, error: "Dieses Dokument gibt es zu diesem Angebot nicht." };
  if (String(z.status) === "angenommen") {
    const [r] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${z.id} LIMIT 1`) as any[];
    if (r?.vertrag_pdf) return { status: 200, pdf: Buffer.from(r.vertrag_pdf), dateiname: `FIAON_Global_Vertrag_${d.ref}.pdf` };
  }
  return { status: 200, pdf: await kapitalCVertragPdf(d, null), dateiname: `FIAON_Global_Angebot_${d.ref}_Entwurf.pdf` };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLEGEN UND ÄNDERN (nur Skript)
// ═══════════════════════════════════════════════════════════════════════════
/** Die Kundenzeile in der Datenbank — Anrede/Name/E-Mail oben (Aufruf-Meldungen, Konto-Suche und Startgespräch lesen dort). */
function kundeFuerDb(k: KapitalCKunde): Record<string, unknown> { return { ...k }; }
export async function kapitalCAnlegen(ein: any, wer: string): Promise<Ergebnis<{ id: number; ref: string; link: string }>> {
  await ensureAngebotTabellen();
  // E-465: neue Angebote mit Staaten-Wahl (ohne Angabe Delaware) und den ehrlichen Zeiten; Bestand läuft nie hier durch.
  // E-487: dazu die aktuelle Tempo-Fassung (Fast-Track = Vorrang, keine „72 Stunden“) — dieselbe Quelle wie die Vorschau im Skript.
  const parameter = kapitalCNeuesAngebotParameter(ein?.parameter);
  // E-474: mit datenVomKunden genügen Anrede, Name und E-Mail — Geburtsdatum und Anschrift trägt der Kunde auf seiner Seite ein.
  const k = kapitalCKundePruefen(ein?.kunde, parameter.datenVomKunden ? { nurKontakt: true } : {});
  if (!k.ok) return nein(`Auftraggeber: ${k.error}`);
  const pf = kapitalCParameterFehler(parameter);
  if (pf) return nein(pf);
  const buergin = kapitalBuerginAus(ein?.buergin);
  const bf = kapitalCBuerginFehler(buergin);
  if (bf) return nein(`Fehlt: ${bf}`);
  const heute = berlinToday();
  const gueltigBis = ISO.test(String(ein?.gueltigBis ?? "")) ? String(ein.gueltigBis) : new Date(Date.parse(`${heute}T12:00:00Z`) + KAPITAL_C_GUELTIG_TAGE * 864e5).toISOString().slice(0, 10);
  if (gueltigBis < heute) return nein("Das Datum „gültig bis“ liegt in der Vergangenheit.");
  const personId = Number(ein?.personId);
  const ref = `FIAON-IA-C${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, pruefbericht, status, gueltig_bis, erstellt_von, verlauf)
    VALUES (${ref}, ${Number.isInteger(personId) && personId > 0 ? personId : null}, ${KAPITAL_C_FASSUNG}, ${jsonb(kundeFuerDb(k.kunde))}, ${jsonb(parameter)}, ${jsonb(buergin)},
            ${null}, 'offen', ${gueltigBis}::date, ${wer}, ${jsonb([{ am: new Date().toISOString(), wer, was: "Kapital-Angebot (Fassung C, Privatperson) angelegt" }])})
    RETURNING id`) as any[];
  const id = Number(neu.id);
  await sqlPool`
    INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage)
    VALUES (${id}, 1, ${kapitalCTeil1TitelFuer(parameter, true)}, ${kapitalCHeuteCents(parameter)}, 'sofort', ${parameter.zahlungszielTage})
    ON CONFLICT (angebot_id, nr) DO NOTHING`;
  return { ok: true, id, ref, link: absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(ref, gueltigBis))) };
}
export async function kapitalCAendern(id: number, ein: any, wer: string): Promise<Ergebnis<{ fehlt: string[] }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  // Runde 2 (Technik): Ein offenes Firmen-Kapital-Angebot (Fassung A/B) derselben Adresse darf hier nie überschrieben werden.
  if (!istKapitalCFassung(z.fassung)) return nein("Kein Kapital-Angebot der Fassung C — ändern hier nur für Privatpersonen.", 409);
  if (String(z.status) !== "offen") return nein(`Das Angebot ist ${String(z.status)} — ändern geht nur, solange es offen ist.`, 409);
  const alt = kapitalCDatenAus(z); const altHash = kapitalCTextHash(alt);
  const neu: KapitalCDaten = { ...alt }; const geaendert: string[] = [];
  // E-465: Staaten-Fassung nur beim Anlegen, nie nachträglich. E-487: ein offenes Angebot trägt immer die aktuelle Tempo-Fassung.
  if (ein?.parameter) { const par = { ...kapitalCParameterAus(ein.parameter, alt.parameter), staatenFassung: alt.parameter.staatenFassung, tempoFassung: KAPITAL_C_TEMPO_FASSUNG }; const f = kapitalCParameterFehler(par); if (f) return nein(f); neu.parameter = par; geaendert.push("Parameter"); }
  if (ein?.kunde) {
    // E-474: Bei datenVomKunden kommt aus der privaten Datei nur der Kontakt — was der Kunde schon selbst eingetragen hat (Geburtsdatum,
    // Anschrift, …), überschreibt ein zweiter Skriptlauf nie. Trägt die Datei die Angaben vollständig, gelten sie (wie bisher).
    const k = neu.parameter.datenVomKunden ? kapitalCKundePruefen(ein.kunde, { nurKontakt: true }) : kapitalCKundePruefen(ein.kunde);
    if (!k.ok) return nein(`Auftraggeber: ${k.error}`);
    const voll = neu.parameter.datenVomKunden && kapitalCKundePruefen(k.kunde, { ohneAusweis: true }).ok;
    neu.kunde = !neu.parameter.datenVomKunden || voll ? k.kunde
      : { ...alt.kunde, anrede: k.kunde.anrede, vorname: alt.kunde.geburtsdatum ? alt.kunde.vorname : k.kunde.vorname, nachname: alt.kunde.geburtsdatum ? alt.kunde.nachname : k.kunde.nachname, email: k.kunde.email, telefon: k.kunde.telefon || alt.kunde.telefon };
    geaendert.push("Kunde");
  }
  if (ein?.buergin) { const b = kapitalBuerginAus(ein.buergin); const f = kapitalCBuerginFehler(b); if (f) return nein(`Fehlt: ${f}`); neu.buergin = b; geaendert.push("Bürgin"); }
  if (ein?.gueltigBis !== undefined) { const g = String(ein.gueltigBis); if (!ISO.test(g) || g < berlinToday()) return nein("„Gültig bis“: ein Datum ab heute."); neu.gueltigBis = g; geaendert.push("Gültigkeit"); }
  if (!geaendert.length) return nein("Es wurde nichts geändert.");
  await sqlPool`
    UPDATE fiaon_global_angebote SET kunde = ${jsonb(kundeFuerDb(neu.kunde))}, parameter = ${jsonb(neu.parameter)}, buergin = ${jsonb(neu.buergin)},
           gueltig_bis = ${neu.gueltigBis}::date, fassung = ${KAPITAL_C_FASSUNG}, updated_at = NOW()
     WHERE id = ${id} AND status = 'offen'`;
  await sqlPool`UPDATE fiaon_global_angebot_teile SET betrag_cents = ${kapitalCHeuteCents(neu.parameter)}, zahlungsziel_tage = ${neu.parameter.zahlungszielTage}, titel = ${kapitalCTeil1TitelFuer(neu.parameter, true)}
                 WHERE angebot_id = ${id} AND nr = 1 AND bestell_ref IS NULL`;
  await verlaufAngebot(id, wer, `geändert: ${geaendert.join(", ")}`, { alterHash: altHash });
  return { ok: true, fehlt: kapitalCPflichtFehlen(neu) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE (offen) und die Antwort nach der Annahme
// ═══════════════════════════════════════════════════════════════════════════
export async function kapitalCKundenSicht(token: string, z: AngebotZeile, opts: { leitung?: boolean } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const d = kapitalCDatenAus(z);
  const fehlt = kapitalCPflichtFehlen(d);
  const k = d.kunde; const par = d.parameter;
  const annahme = kapitalCAnnahmeTexte(d);
  const t = encodeURIComponent(token);
  // E-474: Fehlen NUR die Angaben, die der Kunde selbst einträgt, sagt die Seite genau das (nicht „wird gerade vervollständigt“).
  const angabenFehlen = kapitalCAngabenFehlen(d);
  const nurAngaben = angabenFehlen && fehlt.length === 1 && fehlt[0].startsWith("Auftraggeber:");
  const body: KapitalCKundenSicht = {
    ok: true, status: "offen", art: "kapital", variante: "privat", ref: d.ref, fassung: d.fassung, gueltigBis: d.gueltigBis,
    kunde: { anrede: k.anrede, vorname: k.vorname, nachname: k.nachname, email: k.email },
    kundeAnrede: kapitalCAnrede(k),
    // Mit dem Link: Teamfotos am Angebot gehen nur hinter ihm raus (wie Fassung A/B). Die Prüfsumme liest das Team nie.
    seite: kapitalCSeite(d, token),
    konditionen: {
      betragCents: par.betragCents, ratenfreiMonate: par.ratenfreiMonate, zinsfreiMonate: par.zinsfreiMonate, zinsStartBp: par.zinsStartBp,
      zinsSchrittBp: par.zinsSchrittBp, laufzeitMinJahre: par.laufzeitMinJahre, laufzeitMaxJahre: par.laufzeitMaxJahre, kursUsdJeEur: par.kursUsdJeEur,
      laufzeitVorschlagJahre: par.laufzeitVorschlagJahre,
    },
    ansprechpartner: kapitalCAnsprechpartnerSicht(par),
    uebersicht: kapitalCBestellUebersicht(d, par.laufzeitVorschlagJahre),
    annahme,
    annahmeBereit: fehlt.length === 0 && !opts.leitung,
    gesperrtGrund: fehlt.length ? (nurAngaben ? KAPITAL_C_ANNAHME.angabenFehlen : annahme.gesperrt) : null,
    uebersichtJe: par.fastTrackWahl ? { mit: kapitalCBestellUebersicht(d, par.laufzeitVorschlagJahre, true), ohne: kapitalCBestellUebersicht(d, par.laufzeitVorschlagJahre, false) } : null,
    // Nie ein Ausweis in dieser Antwort: Vor der Unterschrift gibt es keinen (E-474), und der Link kann weitergeleitet werden.
    angaben: par.datenVomKunden ? {
      fehlen: angabenFehlen, texte: KAPITAL_C_ANGABEN,
      werte: { vorname: k.vorname, nachname: k.nachname, geburtsdatum: k.geburtsdatum, geburtsort: k.geburtsort, staatsangehoerigkeit: k.staatsangehoerigkeit, strasse: k.strasse, plz: k.plz, ort: k.ort, land: k.land },
      speichern: `/api/fiaon/global/angebot/${t}/kapital-angaben`,
    } : null,
    ...(opts.leitung ? { vorschauLeitung: true, fehlt } : {}),
    // E-491: der Namensvorschlag aus dem Gespräch füllt die Namensfelder vor (nur wenn gesetzt — Bestand ohne Schlüssel).
    ...(par.bestand ? { llcVorschlag: { wunsch: kapitalCBestandStamm(par.bestand), alternative1: "", alternative2: "" } } : par.llcVorschlag ? { llcVorschlag: par.llcVorschlag } : {}),
    // E-505: der Regler „Ihr Kapitalrahmen“ (nur mit rahmenWahl — Bestand ohne Schlüssel). Die Preise dazu, damit die Seite beim
    // Schieben mit denselben Funktionen rechnet wie der Server.
    ...(par.rahmenWahl ? { rahmen: { ...par.rahmenWahl, speichern: `/api/fiaon/global/angebot/${t}/kapital-rahmen`, gruendungCents: par.gruendungCents, fastTrackCents: par.fastTrackCents } } : {}),
    html: kapitalCVorschauHtml(d),
    textHash: kapitalCSichtHash(d),
    vertragPdf: `/api/fiaon/global/angebot/${t}/vertrag.pdf`,
  };
  return { status: 200, body: body as unknown as Record<string, unknown> };
}
/** Die Ansprechpartner des Angebots für Seite und Fertig-Ansicht — Porträt mit Stand (?v=), Alt-Text und KI-Hinweis (E-288). */
function kapitalCAnsprechpartnerSicht(par: KapitalCParameter) {
  return kapitalCAnsprechpartner(par).map((p) => ({
    ...p, portrait: portraitUrl(p.kuerzel), alt: portraitAlt(p.kuerzel, p.name), kiHinweis: portraitMitKi(p.kuerzel) ? KI_PORTRAIT_HINWEIS.de : null,
  }));
}
// ═══════════════════════════════════════════════════════════════════════════
// E-474 (Justin 02.11.2026): DER KUNDE TRÄGT SEINE ANGABEN SELBST EIN — und lädt den Reisepass NACH der Unterschrift hoch
//   POST /global/angebot/:token/kapital-angaben — Name (korrigierbar), Geburtsdatum, Anschrift, Geburtsort/Staatsangehörigkeit
//     freiwillig. Nur mit gültigem Link, nur Fassung C mit datenVomKunden, nur solange offen, gebremst (je Anschluss und je Angebot),
//     Honigtopf wie die Annahme, nie aus der Vorschau der Leitung. Geprüft mit kapitalCAngabenPruefen (darin kapitalCKundePruefen);
//     gespeichert im Kunden des Angebots — Prüfsumme und Fingerabdruck folgen dem neuen Vertragstext, die Antwort ist die neue
//     Kundensicht (die Seite tauscht sie ohne Neuladen). Vermerk im Verlauf (ohne die Werte), beim ersten Mal eine Aufgabe an Justin.
//   POST /global/angebot/:token/reisepass — nach der Annahme, eine Datei (PDF/JPG/PNG, 15 MB), über den bestehenden Weg des
//     Global-Bereichs (globalKundenDokument, Art „reisepass“) in die Akte; dort meldet der Eingang sich wie jeder Kunden-Upload.
// ═══════════════════════════════════════════════════════════════════════════
const bremsen = new Map<string, number[]>();
/** Gleitendes Fenster je Schlüssel (Arbeitsspeicher der Instanz, wie jede Drossel im Haus). */
function gebremst(schluessel: string, max: number, fensterMs: number): boolean {
  const jetzt = Date.now();
  const liste = (bremsen.get(schluessel) ?? []).filter((t) => jetzt - t < fensterMs);
  if (liste.length >= max) { bremsen.set(schluessel, liste); return true; }
  liste.push(jetzt); bremsen.set(schluessel, liste);
  if (bremsen.size > 5000) { const erster = bremsen.keys().next().value; if (erster) bremsen.delete(erster); }
  return false;
}
const ZU_VIEL = "Von Ihrem Anschluss kamen gerade mehrere Versuche. Bitte versuchen Sie es in einigen Minuten noch einmal.";
type Antwort = { status: number; body: Record<string, unknown> };
const antwortFehler = (status: number, error: string, extra: Record<string, unknown> = {}): Antwort => ({ status, body: { ok: false, error, ...extra } });
/** Link und Angebot wie bei Seite und Annahme: Signatur, Ablauf, Fassung C. */
async function kapitalCZeileFuerToken(token: string): Promise<{ z: AngebotZeile } | { fehler: Antwort }> {
  const t = angebotTokenPruefen(token);
  if (!t) return { fehler: antwortFehler(403, "Dieser Link ist ungültig. Bitte öffnen Sie den Link aus unserer Nachricht.") };
  if (t.urteil === "abgelaufen") return { fehler: antwortFehler(410, "Dieser Link ist abgelaufen. Schreiben Sie uns bitte an support@fiaon.com.") };
  const z = await angebotLesen({ ref: t.ref });
  if (!z || !istKapitalCFassung(z.fassung)) return { fehler: antwortFehler(404, "Zu diesem Link finden wir kein Angebot.") };
  if (angebotLinkAbgelaufen(z)) return { fehler: antwortFehler(410, "Dieser Link ist abgelaufen. Schreiben Sie uns bitte an support@fiaon.com.") };
  return { z };
}

export async function kapitalCAngabenSpeichern(token: string, body: any, kontext: AnnahmeKontext): Promise<Antwort> {
  const t = angebotTokenPruefen(token);
  if (t && (gebremst(`angaben-ip:${kontext.ip}`, 12, 15 * 60_000) || gebremst(`angaben-ref:${t.ref}`, 20, 60 * 60_000))) return antwortFehler(429, ZU_VIEL);
  const l = await kapitalCZeileFuerToken(token);
  if ("fehler" in l) return l.fehler;
  const z = l.z;
  const status = angebotStatusAus(z);
  if (status !== "offen") {
    return antwortFehler(409, status === "angenommen"
      ? "Ihr Vertrag ist schon angenommen — Ihre Angaben lassen sich hier nicht mehr ändern. Hat sich etwas geändert, schreiben Sie uns bitte kurz."
      : "Dieses Angebot gilt nicht mehr. Bei Fragen erreichen Sie uns unter support@fiaon.com.", { code: "NICHT_OFFEN" });
  }
  if (kontext.leitung) return antwortFehler(403, "Vorschau der Leitung — die Angaben trägt nur der Kunde ein.", { code: "VORSCHAU" });
  if (String(body?.falle ?? "").trim()) return antwortFehler(400, "Ihre Angaben konnten nicht verarbeitet werden. Bitte laden Sie die Seite neu.");
  const d = kapitalCDatenAus(z);
  if (!d.parameter.datenVomKunden) return antwortFehler(409, "Ihre Angaben stehen schon in Ihrem Vertrag.", { code: "NICHT_VORGESEHEN" });
  const heute = berlinToday();
  const p = kapitalCAngabenPruefen(d.kunde, body, heute);
  if (!p.ok) return antwortFehler(400, p.error, { code: "ANGABEN", feld: p.feld });
  const erstmals = kapitalCAngabenFehlen(d);
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote SET kunde = ${jsonb(kundeFuerDb(p.kunde))}, updated_at = NOW()
     WHERE id = ${z.id} AND status = 'offen' AND gueltig_bis >= ${heute}::date
     RETURNING id`) as any[];
  if (!frei) return antwortFehler(409, "Das Angebot lässt sich gerade nicht ändern. Bitte laden Sie die Seite neu.", { code: "GEAENDERT" });
  const name = kapitalCName(p.kunde);
  const korrigiert = name !== kapitalCName(d.kunde);
  // Im Verlauf nur, WAS eingetragen wurde — die Werte stehen im Kunden des Angebots (und nach der Annahme im Vertrag).
  await verlaufAngebot(Number(z.id), "Kunde (Angebotsseite)", `${erstmals ? "Angaben für den Vertrag eingetragen" : "Angaben für den Vertrag geändert"}: Geburtsdatum, Anschrift${p.kunde.geburtsort ? ", Geburtsort" : ""}${p.kunde.staatsangehoerigkeit ? ", Staatsangehörigkeit" : ""}${korrigiert ? "; Name korrigiert" : ""}`, { ip: kontext.ip });
  if (erstmals) {
    const frei2 = kapitalCPflichtFehlen({ ...d, kunde: p.kunde }).length === 0;
    void import("../routes/fiaon-betreiber-todo").then(({ auftragFuerKunden }) => auftragFuerKunden({
      personId: z.person_id != null ? Number(z.person_id) : null, ref: null,
      titel: `Kapital-Angebot ${d.ref}: ${name} hat seine Angaben eingetragen`,
      text: [
        `${name} hat auf der Angebotsseite Geburtsdatum und Anschrift für den Vertrag eingetragen${korrigiert ? " (und den Namen korrigiert)" : ""}.`,
        frei2 ? "Die Unterschrift ist damit frei." : "Die Unterschrift wartet noch auf die Freigabe (Parameter unterschriftFrei).",
        "Den Reisepass lädt der Kunde nach der Annahme hoch — dann die Angaben mit dem Pass abgleichen.",
      ].join("\n"),
      anBetreiber: true, schluessel: `global:${d.ref}:kapital-angaben`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
    })).catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Aufgabe „Angaben eingetragen“:`, e));
  }
  const neu = await angebotLesen({ id: Number(z.id) });
  if (!neu) return antwortFehler(500, KAPITAL_C_ANGABEN.fehler);
  const sicht = await kapitalCKundenSicht(token, neu);
  return { status: 200, body: { ...sicht.body, gespeichert: true } };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-505 (Justin 12.11.2026): DER KUNDE WÄHLT SEINEN KAPITALRAHMEN SELBST — Regler auf der Angebotsseite
//   POST /global/angebot/:token/kapital-rahmen { usd } — nur mit gültigem Link, nur Fassung C mit rahmenWahl, nur solange offen,
//     gebremst, Honigtopf, nie aus der Vorschau der Leitung. Der Wert muss auf dem Regler liegen (kapitalCRahmenGueltig). Gespeichert
//     in den Parametern des Angebots: Betrag in Euro und Erfolgshonorar nach Staffel folgen der Wahl (kapitalCRahmenAnwenden) —
//     Vertrag, Prüfsumme und Fingerabdruck folgen dem neuen Text; die Antwort ist die neue Kundensicht (die Seite tauscht sie ohne
//     Neuladen). Nimmt der Kunde mit einem älteren Fingerabdruck an, antwortet die Annahme wie immer „geändert“. Teil 1 (Gründung,
//     Fast-Track) hängt nicht am Rahmen. Vermerk im Verlauf.
// ═══════════════════════════════════════════════════════════════════════════
export async function kapitalCRahmenSpeichern(token: string, body: any, kontext: AnnahmeKontext): Promise<Antwort> {
  const t = angebotTokenPruefen(token);
  if (t && (gebremst(`rahmen-ip:${kontext.ip}`, 60, 15 * 60_000) || gebremst(`rahmen-ref:${t.ref}`, 120, 60 * 60_000))) return antwortFehler(429, ZU_VIEL);
  const l = await kapitalCZeileFuerToken(token);
  if ("fehler" in l) return l.fehler;
  const z = l.z;
  const status = angebotStatusAus(z);
  if (status !== "offen") {
    return antwortFehler(409, status === "angenommen"
      ? "Ihr Vertrag ist schon angenommen — der Rahmen lässt sich hier nicht mehr ändern. Schreiben Sie uns bitte kurz, wenn Sie ihn anpassen möchten."
      : "Dieses Angebot gilt nicht mehr. Bei Fragen erreichen Sie uns unter support@fiaon.com.", { code: "NICHT_OFFEN" });
  }
  if (kontext.leitung) return antwortFehler(403, "Vorschau der Leitung — den Rahmen wählt nur der Kunde.", { code: "VORSCHAU" });
  if (String(body?.falle ?? "").trim()) return antwortFehler(400, "Ihre Wahl konnte nicht verarbeitet werden. Bitte laden Sie die Seite neu.");
  const d = kapitalCDatenAus(z);
  const w = d.parameter.rahmenWahl;
  if (!w) return antwortFehler(409, "Der Rahmen steht in Ihrem Angebot schon fest.", { code: "NICHT_VORGESEHEN" });
  const usd = typeof body?.usd === "number" ? body.usd : Number.NaN;
  if (!kapitalCRahmenGueltig(w, usd)) return antwortFehler(400, `Bitte wählen Sie einen Rahmen zwischen ${kapitalCUsd(w.minUsd)} und ${kapitalCUsd(w.maxUsd)}.`, { code: "RAHMEN" });
  if (usd !== w.gewaehltUsd) {
    const neuPar = kapitalCRahmenAnwenden(d.parameter, usd);
    const heute = berlinToday();
    // Gespeichert wird, was in der Zeile steht (roh, nicht die beim Lesen abgeleiteten Werte wie die Tempo-Fassung), mit genau den
    // drei Werten der Wahl. Über `json` gelesen: verträgt auch eine Zeile, deren Parameter als Text im jsonb-Feld liegen (E-238).
    const gespeichert = { ...json<Record<string, unknown>>(z.parameter, {}), betragCents: neuPar.betragCents, erfolgCents: neuPar.erfolgCents, rahmenWahl: neuPar.rahmenWahl };
    const [frei] = (await sqlPool`
      UPDATE fiaon_global_angebote SET parameter = ${jsonb(gespeichert)}, updated_at = NOW()
       WHERE id = ${z.id} AND status = 'offen' AND gueltig_bis >= ${heute}::date
       RETURNING id`) as any[];
    if (!frei) return antwortFehler(409, "Das Angebot lässt sich gerade nicht ändern. Bitte laden Sie die Seite neu.", { code: "GEAENDERT" });
    await verlaufAngebot(Number(z.id), "Kunde (Angebotsseite)", `Kapitalrahmen gewählt: ${kapitalCUsd(usd)} (vorher ${kapitalCUsd(w.gewaehltUsd)}) — Erfolgshonorar nach Staffel ${kapitalCEur(neuPar.erfolgCents)}`, { ip: kontext.ip });
  }
  const neu = await angebotLesen({ id: Number(z.id) });
  if (!neu) return antwortFehler(500, "Ihre Wahl konnte gerade nicht übernommen werden. Bitte versuchen Sie es noch einmal.");
  const sicht = await kapitalCKundenSicht(token, neu);
  return { status: 200, body: { ...sicht.body, gespeichert: true } };
}

/** E-474: Liegt in der Akte schon ein Reisepass vom Kunden? */
export async function kapitalCReisepassDa(ref: string): Promise<boolean> {
  const [r] = (await sqlPool`SELECT 1 AS da FROM fiaon_global_dokumente WHERE ref = ${ref} AND art = 'reisepass' AND geloescht_am IS NULL LIMIT 1`.catch(() => [])) as any[];
  return !!r;
}
/**
 * E-487 (09.11.2026, Gutachten): Seit welchem Berliner Tag liegt der Reisepass in der Akte (ohne gelöschte und abgelehnte, wie
 * Fassung A/B)? null = keiner. Für die Frist der Anmeldung zählt der spätere Eingang — Zahlung oder Reisepass (kapitalCStartAufgabe).
 */
export async function kapitalCReisepassAm(ref: string): Promise<string | null> {
  const [r] = (await sqlPool`SELECT created_at FROM fiaon_global_dokumente WHERE ref = ${ref} AND art = 'reisepass' AND geloescht_am IS NULL AND abgelehnt_am IS NULL ORDER BY created_at LIMIT 1`.catch(() => [])) as any[];
  return r?.created_at ? berlinToday(new Date(r.created_at)) : null;
}
/**
 * E-487 (09.11.2026, Gutachten): Der Kunde hat seinen Reisepass hochgeladen — gerufen aus globalKundenDokument (fiaon-global-bereich.ts),
 * also für die Angebotsseite UND „Mein Auftrag“. Nur Kapital-Angebote der Fassung C mit Angaben vom Kunden, angenommen, Teil 1 bezahlt:
 * Dann beginnt erst jetzt die Frist für die Anmeldung (Ziffer 2 Absatz 3) — die Start-Aufgabe nannte noch kein Datum, die Aufgabe
 * „Reisepass da“ nennt es und ist an dem Tag fällig (kapitalCReisepassAufgabe). Vor der Zahlung: nichts — die Start-Aufgabe rechnet
 * dann schon mit dem Pass. Eigener Schlüssel je Auftrag: Ein zweiter Upload am selben Tag legt nichts doppelt an; ein neuer Pass an
 * einem späteren Tag hängt das neue Datum an dieselbe Aufgabe (und öffnet sie wieder, falls sie erledigt war). Kein Kundenkontakt.
 */
export async function kapitalCReisepassEingang(ref1: string, angebotId: number): Promise<{ angelegt: boolean; grund?: string }> {
  const z = await angebotLesen({ id: angebotId });
  if (!z || !istKapitalCFassung(z.fassung) || String(z.auftrag_ref ?? "") !== ref1) return { angelegt: false, grund: "kein Kapital-Angebot der Fassung C zu diesem Auftrag" };
  const d = kapitalCDatenAus(z);
  if (!d.parameter.datenVomKunden || angebotStatusAus(z) !== "angenommen") return { angelegt: false, grund: "ohne Angaben vom Kunden oder nicht angenommen" };
  const teil1 = (((z as any).teile as any[] | undefined) ?? []).find((t) => Number(t.nr) === 1);
  const bezahltAm = teil1?.bezahlt_am ? berlinToday(new Date(teil1.bezahlt_am)) : null;
  if (!bezahltAm) return { angelegt: false, grund: "Teil 1 noch nicht bezahlt — die Start-Aufgabe rechnet mit dem Reisepass" };
  const w = kapitalCWahlAus(z);
  const auf = kapitalCReisepassAufgabe({
    angebotRef: d.ref, name: kapitalCName(d.kunde) || d.ref, parameter: d.parameter, bezahltAm, reisepassAm: berlinToday(), llc: w?.llc.wunsch || null,
    ...(d.parameter.fastTrackWahl ? { fastTrack: kapitalCMitFastTrack(d.parameter, w) } : {}),
  });
  const b = await globalBestellungLesen(ref1).catch(() => null);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: b?.person_id != null ? Number(b.person_id) : null, ref: ref1, titel: auf.titel, text: auf.text, faelligAm: auf.faelligAm,
    dringend: true, anBetreiber: true, schluessel: `global:${ref1}:kapital-reisepass-da`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
    link: CHEF_LINK, anlageText: "Reisepass nach der Zahlung eingegangen — Kapital-Angebot (Fassung C): die Frist für die Anmeldung beginnt.",
  });
  await verlaufAngebot(angebotId, "System", `Reisepass nach der Zahlung eingegangen — Anmeldung bis ${kapitalTag(auf.faelligAm)} (Aufgabe „Reisepass da“).`).catch(() => {});
  return { angelegt: true };
}
/** Die Art am Dateikopf (die Endung kann lügen) — hier NUR PDF, PNG, JPEG (die Akte nimmt sonst auch HEIC). */
function passArt(daten: Buffer): boolean {
  if (daten.length >= 5 && daten.subarray(0, 5).toString("latin1") === "%PDF-") return true;
  if (daten.length >= 8 && daten.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  return daten.length >= 3 && daten[0] === 0xff && daten[1] === 0xd8 && daten[2] === 0xff;
}
export const KAPITAL_C_PASS_MAX_BYTES = 15 * 1024 * 1024;
/** Vor dem Lesen des Körpers: Link, Angebot, Zustand, Bremse — die Route ruft das, BEVOR multer die Datei annimmt. */
export async function kapitalCReisepassZutritt(token: string, kontext: AnnahmeKontext): Promise<{ ok: true; ref: string; angebotId: number } | { ok: false; antwort: Antwort }> {
  const t = angebotTokenPruefen(token);
  if (t && (gebremst(`pass-ip:${kontext.ip}`, 10, 10 * 60_000) || gebremst(`pass-ref:${t.ref}`, 10, 10 * 60_000))) return { ok: false, antwort: antwortFehler(429, ZU_VIEL) };
  const l = await kapitalCZeileFuerToken(token);
  if ("fehler" in l) return { ok: false, antwort: l.fehler };
  let z = l.z;
  if (kontext.leitung) return { ok: false, antwort: antwortFehler(403, "Vorschau der Leitung — hochladen kann hier nur der Kunde.", { code: "VORSCHAU" }) };
  if (angebotStatusAus(z) !== "angenommen") return { ok: false, antwort: antwortFehler(409, "Ihren Reisepass laden Sie nach der Unterschrift hoch.", { code: "NICHT_ANGENOMMEN" }) };
  if (!kapitalCDatenAus(z).parameter.datenVomKunden) return { ok: false, antwort: antwortFehler(404, "Bitte laden Sie Unterlagen in „Mein Auftrag“ hoch.") };
  if (!z.auftrag_ref) {
    await kapitalCFertigstellen(Number(z.id)).catch(() => null);
    z = (await angebotLesen({ id: Number(z.id) })) ?? z;
  }
  if (!z.auftrag_ref) return { ok: false, antwort: antwortFehler(409, "Ihr Auftrag wird gerade angelegt — bitte versuchen Sie es in einer Minute noch einmal.") };
  return { ok: true, ref: String(z.auftrag_ref), angebotId: Number(z.id) };
}
export async function kapitalCReisepassHochladen(zutritt: { ref: string; angebotId: number }, datei: { buffer: Buffer; originalname: string } | null): Promise<Antwort> {
  if (!datei?.buffer?.length) return antwortFehler(400, "Es ist keine Datei angekommen. Bitte versuchen Sie es noch einmal.");
  if (datei.buffer.length > KAPITAL_C_PASS_MAX_BYTES) return antwortFehler(400, KAPITAL_C_REISEPASS.zuGross);
  if (!passArt(datei.buffer)) return antwortFehler(400, KAPITAL_C_REISEPASS.falscherTyp);
  // Der bestehende Weg des Global-Bereichs: Typ am Inhalt, Name bereinigt, Doppel erkannt, Verlauf und Eingangsmeldung an das Team.
  const { globalKundenDokument } = await import("./fiaon-global-bereich");
  const erg = await globalKundenDokument(zutritt.ref, { art: "reisepass", datei });
  if (!erg.ok) return antwortFehler(erg.status, erg.error);
  await verlaufAngebot(zutritt.angebotId, "Kunde (Angebotsseite)", "Reisepass hochgeladen — liegt in der Akte (Tresor).");
  const dok = erg.dokument as { name?: string; am?: string };
  return { status: 200, body: { ok: true, da: true, dokument: { name: dok.name ?? null, am: dok.am ?? null } } };
}

export async function kapitalCAngenommenAntwort(z: AngebotZeile): Promise<Record<string, unknown>> {
  const d = kapitalCDatenAus(z);
  const w = kapitalCWahlAus(z);
  const llc = w?.llc.wunsch || "Ihre Gesellschaft";
  const laufzeit = w && kapitalCLaufzeitGueltig(w.laufzeitJahre, d.parameter) ? `${zahlwort(w.laufzeitJahre)} Jahre` : "wie gewählt";
  const token = angebotTokenErzeugen(d.ref, d.gueltigBis);
  const ref1 = z.auftrag_ref ? String(z.auftrag_ref) : null;
  const b = ref1 ? await globalBestellungLesen(ref1).catch(() => null) : null;
  const zweck = b?.payment_reference ? String(b.payment_reference) : null;
  const bezahlt = String(b?.payment_status ?? "") === "paid";
  const ansprech = kapitalCAnsprechpartnerSicht(d.parameter);
  // E-474: der Betrag nach der Wahl des Kunden (ohne fastTrackWahl immer mit Fast-Track, wie bisher).
  const ft = kapitalCMitFastTrack(d.parameter, w);
  const heute = kapitalCEur(kapitalCHeuteCents(d.parameter, ft));
  const { signInvoiceUrl } = await import("../fiaon-invoice");
  // E-474: datenVomKunden — direkt nach der Annahme der Reisepass, über die Angebotsseite in die Akte (kapitalCReisepassHochladen).
  const reisepass = d.parameter.datenVomKunden && ref1
    ? { texte: KAPITAL_C_REISEPASS, hochladen: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/reisepass`, da: await kapitalCReisepassDa(ref1) }
    : null;
  return {
    art: "kapital", variante: "privat", startgespraech: null,
    // Runde 2 (Gestaltung + Kundensicht): die ruhige Fertig-Ansicht der Fassung C — ohne Website-Menü, nur der Ansprechpartner
    // des Angebots, „Zu „Mein Auftrag““, Verwendungszweck, Dateien mit klaren Namen.
    privat: {
      auge: KAPITAL_C_ANNAHME.fertigAuge, zweck: zweck ? KAPITAL_C_ANNAHME.fertigZweck(zweck) : null,
      knopf: KAPITAL_C_ANNAHME.fertigKnopf, meinAuftragKnopf: KAPITAL_C_ANNAHME.fertigMeinAuftrag,
      dateien: { vertrag: KAPITAL_C_ANNAHME.fertigDateien.vertrag, rechnung: KAPITAL_C_ANNAHME.fertigDateien.rechnung(heute) },
      ansprechTitel: KAPITAL_C_ANNAHME.fertigAnsprech, ansprechpartner: ansprech,
      marke: KAPITAL_C_MARKE,
      reisepass,
    },
    ref: d.ref, auftragRef: ref1, email: d.kunde.email, sofortBeginn: true,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null,
    betragCents: kapitalCHeuteCents(d.parameter, ft),
    zahlungsseite: zweck ? `/zahlung/${encodeURIComponent(zweck)}?bereich=business` : null,
    meinAuftrag: ref1 && (await globalAkteLesen(ref1).catch(() => null)) ? globalMeinAuftragUrl(ref1) : null,
    // Die Rechnung über den signierten Link (wie die Zahlungsseite), 30 Tage gültig.
    rechnungUrl: zweck ? signInvoiceUrl(zweck, 30 * 24 * 3600_000) : null,
    vertragUrl: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/vertrag.pdf`,
    fertigTitel: KAPITAL_C_ANNAHME.fertigTitel(kapitalCGruss(d.kunde)),
    fertigText: KAPITAL_C_ANNAHME.fertigText(d.kunde.email, llc, laufzeit),
    teil1Bezahlt: bezahlt,
    fertigZahlung: KAPITAL_C_ANNAHME.fertigZahlung(heute, ft, !!d.parameter.bestand),
    fertigFuss: ansprech[0] ? KAPITAL_C_ANNAHME.fertigFussMit(ansprech[0]) : KAPITAL_C_ANNAHME.fertigFuss,
    llc: w?.llc ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANNAHME (gerufen aus kapitalAnnehmen: Token, Status, Leitung und Honigtopf sind im Individualangebot geprüft)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Was die Annahme in fiaon_global_angebote.schalter festhält — rein (Prüfstand). E-487 (09.11.2026): mit der Tempo-Fassung des Vertrags,
 * den der Kunde gerade angenommen hat (tempoFassung) — so liest sich der angenommene Vertrag auch nach jeder künftigen Änderung am
 * Wortlaut genau so wie bei der Annahme (kapitalCTempoFassungAus).
 */
export function kapitalCSchalterBeiAnnahme(d: Pick<KapitalCDaten, "parameter">, wahl: KapitalCWahl, plan: Pick<KapitalCPlan, "monatsrateCents" | "zinsenCents" | "rueckzahlungCents" | "usd">, unterschrift: KapitalUnterschriftVermerk) {
  return {
    ...wahl, rate: { monatsrateCents: plan.monatsrateCents, zinsenCents: plan.zinsenCents, rueckzahlungCents: plan.rueckzahlungCents, usdMonatsrate: plan.usd.monatsrate },
    gelesen: true, verbraucher: true, unterschrift, tempoFassung: d.parameter.tempoFassung,
  };
}
export async function kapitalCAnnehmen(z: AngebotZeile, body: any, kontext: AnnahmeKontext, helfer: { zuViel: (ip: string) => boolean }): Promise<{ status: number; body: Record<string, unknown> }> {
  const fehler = (status: number, error: string, extra: Record<string, unknown> = {}) => ({ status, body: { ok: false, error, ...extra } });
  const d = kapitalCDatenAus(z);
  const texte = kapitalCAnnahmeTexte(d);
  if (kapitalCPflichtFehlen(d).length) return fehler(409, texte.gesperrt, { code: "PFLICHTFELDER" });
  if (helfer.zuViel(kontext.ip)) return fehler(429, "Von Ihrem Anschluss kamen gerade mehrere Versuche. Bitte versuchen Sie es in einigen Minuten noch einmal.");
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(kontext.ip, kontext.userAgent).roboter) {
    return fehler(403, "Diese Annahme können wir nicht entgegennehmen. Bitte öffnen Sie die Seite in Ihrem Browser und nehmen Sie dort an.");
  }
  const jahre = Number(body?.laufzeitJahre);
  if (!kapitalCLaufzeitGueltig(jahre, d.parameter)) return fehler(400, KAPITAL_C_ANNAHME.fehltLaufzeit, { code: "LAUFZEIT" });
  // E-506: Bei einer bestehenden Gesellschaft wählt der Kunde keinen Namen — er steht im Angebot (und so im Annahmevermerk),
  // gleich was der Browser schickt. Ohne die Namensregeln der Neugründung: Der Name ist beim Bundesstaat längst eingetragen.
  const llc: ReturnType<typeof llcWahlPruefen> = d.parameter.bestand
    ? { ok: true, wahl: { wunsch: d.parameter.bestand.name, alternative1: "", alternative2: "" } }
    : llcWahlPruefen(body?.llc);
  if (!llc.ok) return fehler(400, llc.error, { code: "LLC", feld: llc.feld });
  if (body?.gelesen !== true) return fehler(400, KAPITAL_C_ANNAHME.fehltGelesen, { code: "HAEKCHEN", fehlt: ["gelesen"] });
  // E-474: Mit fastTrackWahl wählt der Kunde (true/false, nie vorbelegt — ein Aufpreis braucht seine ausdrückliche Wahl).
  // E-475 (Justin 02.11.2026): FIAON beginnt in BEIDEN Fällen sofort — der Haken „sofort beginnen“ ist immer Pflicht.
  const ft: unknown = d.parameter.fastTrackWahl ? body?.fastTrack : true;
  if (ft !== true && ft !== false) return fehler(400, KAPITAL_C_ANNAHME.fehltFastTrack, { code: "FASTTRACK" });
  if (body?.sofortBeginn !== true) return fehler(400, d.parameter.fastTrackWahl || d.parameter.bestand ? KAPITAL_C_ANNAHME.fehltSofortWahl : KAPITAL_C_ANNAHME.fehltSofort, { code: "HAEKCHEN", fehlt: ["sofort"] });
  const u = firmaUnterschriftPruefen(body?.unterschrift, { vertretung: { nachname: d.kunde.nachname } } as unknown as FirmaKunde);
  if (!u.ok) return fehler(400, u.error, { code: u.code });
  const hash = kapitalCTextHash(d);
  if (!gleich(String(body?.textHash ?? ""), kapitalCSichtHash(d))) return fehler(409, KAPITAL_C_ANNAHME.neuLaden, { code: "GEAENDERT" });

  const jetzt = new Date();
  const wahl: KapitalCWahl = { llc: llc.wahl, laufzeitJahre: jahre, sofortBeginn: true, ...(d.parameter.fastTrackWahl ? { fastTrack: ft } : {}) };
  const unterschrift: KapitalUnterschriftVermerk = { ...u.vermerk, am: jetzt.toISOString(), ip: kontext.ip };
  let pdf: Buffer;
  try {
    pdf = await kapitalCVertragPdf(d, { am: jetzt, ip: kontext.ip, userAgent: kontext.userAgent, hash, wahl, unterschrift });
    if (!pdf || pdf.length < 1000) throw new Error("PDF leer");
  } catch (e) {
    console.error(`[FIAON-KAPITAL-C] ${d.ref}: Vertrags-PDF:`, e);
    return fehler(500, "Ihr Vertrag konnte gerade nicht ausgefertigt werden — bitte versuchen Sie es in einer Minute noch einmal. Es wurde nichts gespeichert.");
  }
  const plan = kapitalCPlan(d.parameter, jahre);
  const schalter = kapitalCSchalterBeiAnnahme(d, wahl, plan, unterschrift);
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote
       SET status = 'angenommen', angenommen_am = ${jetzt}, ip = ${kontext.ip}, user_agent = ${String(kontext.userAgent || "").slice(0, 500)},
           text_hash = ${hash}, schalter = ${jsonb(schalter)}, vertrag_pdf = ${pdf}, fassung = ${d.fassung}, updated_at = NOW()
     WHERE id = ${z.id} AND status = 'offen' AND gueltig_bis >= ${berlinToday()}::date AND updated_at::text = ${String(z.updated_at_txt)}
     RETURNING id`) as any[];
  if (!frei) {
    const neu = await angebotLesen({ id: Number(z.id) });
    if (neu && String(neu.status) === "angenommen") return { status: 200, body: { ok: true, schon: true, ...(await kapitalCAngenommenAntwort(neu)) } };
    if (neu && String(neu.status) === "offen") return fehler(409, KAPITAL_C_ANNAHME.neuLaden, { code: "GEAENDERT" });
    return fehler(409, "Das Angebot lässt sich gerade nicht annehmen. Bitte laden Sie die Seite neu.");
  }
  await verlaufAngebot(Number(z.id), kapitalCName(d.kunde), `angenommen (${KAPITAL_KNOPF}) — Prüfsumme ${hash.slice(0, 12)}…, Laufzeit ${jahre} Jahre (Rate ${kapitalCEurCent(plan.monatsrateCents)}), LLC „${wahl.llc.wunsch}“${wahl.llc.alternative1 ? ` (Ausweich: ${[wahl.llc.alternative1, wahl.llc.alternative2].filter(Boolean).join(", ")})` : ""}, ${!d.parameter.fastTrackWahl ? "Sofortbeginn ausdrücklich verlangt" : ft ? `Fast-Track gewählt (${kapitalCEur(kapitalCHeuteCents(d.parameter, true))}), Sofortbeginn ausdrücklich verlangt` : `OHNE Fast-Track (${kapitalCEur(kapitalCHeuteCents(d.parameter, false))}), Sofortbeginn ausdrücklich verlangt`}, Unterschrift ${unterschrift.art}`);
  void import("./fiaon-global-angebot-aufrufe").then((m) => m.aufrufeAnnahmeVermerken(Number(z.id)))
    .catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Annahme in der Aufruf-Aufgabe:`, e));
  await kapitalCFertigstellen(Number(z.id)).catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Fertigstellen:`, e));
  void kapitalCNacharbeit(Number(z.id)).catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Nacharbeit abgebrochen:`, e));
  return { status: 200, body: { ok: true, ...(await kapitalCAngenommenAntwort((await angebotLesen({ id: Number(z.id) }))!)) } };
}

/** Bestellzeile für eine Privatperson — derselbe Weg wie das Individualangebot (Loopback auf POST /api/fiaon/application), ohne Firma. */
async function bestellzeilePrivat(ref: string, k: KapitalCKunde, packName: string, kontext: { ip: string; userAgent: string }): Promise<boolean> {
  const port = process.env.PORT || 5000;
  const [jahr, monat, tag] = String(k.geburtsdatum || "").split("-");
  const antwort = await fetch(`http://127.0.0.1:${port}/api/fiaon/application`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": kontext.ip || "", "user-agent": kontext.userAgent || "fiaon-global-kapital-c" },
    body: JSON.stringify({
      ref, type: "business", status: "submitted", currentStep: 6,
      packKey: ANGEBOT_PAKET_KEY, packName,
      // Privatperson: KEIN Firmenname — die Rechnung nennt die Person (wie das Individualangebot E-268).
      companyName: null, legalForm: null, taxId: null,
      firstName: k.vorname, lastName: k.nachname, birthDay: tag, birthMonth: monat, birthYear: jahr,
      contactFirstName: k.vorname, contactLastName: k.nachname,
      contactEmail: k.email, email: k.email, billingEmail: k.email, contactPhone: k.telefon || null,
      street: k.strasse, zip: k.plz, city: k.ort, country: k.land,
      // Der Vertrag selbst ist die Vereinbarung (Ziffer 14: weitere AGB gelten nicht) — keine AGB-Zustimmung, keine Bonitätsabfrage.
      ag1: false, ag2: false, ag3: true,
      webMessungAus: true, messungAus: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!antwort.ok) {
    console.error(`[FIAON-KAPITAL-C] ${ref}: application ${antwort.status}:`, (await antwort.text().catch(() => "")).slice(0, 200));
    return false;
  }
  await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = 'none', tax_id = NULL WHERE ref = ${ref}`;
  return true;
}

/** Nach der Annahme: Bestellzeile (Teil 1), Akte, Rechnung — wiederholbar, jede Stufe prüft, ob es sie schon gibt. */
export async function kapitalCFertigstellen(id: number): Promise<{ ok: boolean; grund?: string }> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen") return { ok: false, grund: "nicht angenommen" };
  const d = kapitalCDatenAus(z); const k = d.kunde;
  const w = kapitalCWahlAus(z);
  const sch = json<Record<string, any>>(z.schalter, {});
  const teil1 = ((z as any).teile as any[] | undefined)?.find((x) => Number(x.nr) === 1);
  if (!teil1) return { ok: false, grund: "Teil 1 fehlt" };
  // E-474: Teil 1 nach der Wahl des Kunden (ohne Fast-Track nur die Gründung) — BEVOR Bestellzeile und Rechnung entstehen
  // (angebotTeilZurBestellung liest Betrag und Titel aus dieser Zeile). Nur solange noch keine Bestellung daran hängt.
  const ft = kapitalCMitFastTrack(d.parameter, w);
  if (d.parameter.fastTrackWahl) {
    await sqlPool`UPDATE fiaon_global_angebot_teile SET betrag_cents = ${kapitalCHeuteCents(d.parameter, ft)}, titel = ${kapitalCTeil1TitelFuer(d.parameter, ft)}
                   WHERE angebot_id = ${id} AND nr = 1 AND bestell_ref IS NULL AND (betrag_cents <> ${kapitalCHeuteCents(d.parameter, ft)} OR titel <> ${kapitalCTeil1TitelFuer(d.parameter, ft)})`;
  }
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
      const ok = await bestellzeilePrivat(ref1, k, `${KAPITAL_C_MARKE} — ${kapitalCTeil1TitelFuer(d.parameter, ft)}`, { ip: String(z.ip || ""), userAgent: String(z.user_agent || "") });
      if (!ok) throw new Error("Bestellzeile ließ sich nicht anlegen");
    }
    await sqlPool`UPDATE fiaon_global_angebot_teile SET bestell_ref = ${ref1} WHERE angebot_id = ${id} AND nr = 1 AND bestell_ref IS NULL`;
    // ── Die Akte — Privatperson (firma.art „privat“: „Mein Auftrag“ zeigt das Widerrufsrecht), Kapital-Angebot der Fassung C ──
    if (!(await globalAkteLesen(ref1))) {
      const [pdfZeile] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
      const firma = { art: "privat", land: k.land, name: kapitalCName(k), rechtsform: "Privatperson", registergericht: null, registernummer: null, strasse: k.strasse, plz: k.plz, ort: k.ort, ustId: null, website: null, quelleRegister: null };
      const ansprechpartner = { anrede: k.anrede, vorname: k.vorname, nachname: k.nachname, funktion: "Privatperson", email: k.email, telefon: k.telefon };
      const bestaetigungen = { annahme: KAPITAL_KNOPF, sofortBeginn: w?.sofortBeginn ?? true, ...(d.parameter.fastTrackWahl ? { fastTrack: ft } : {}), gelesen: true, am: new Date(z.angenommen_am).toISOString(), kapitalangebot: true, kapitalPrivat: true,
        // E-506: bestehende Gesellschaft — „Mein Auftrag“ nennt Etappe 1 dann „Ihre Gesellschaft in Ordnung“ (etappeTextFuerAkte).
        ...(d.parameter.bestand ? { kapitalBestand: true } : {}),
        laufzeitJahre: w?.laufzeitJahre ?? null,
        ...(sch.unterschrift ? { unterschrift: { art: sch.unterschrift.art, name: sch.unterschrift.name ?? null, am: sch.unterschrift.am ?? null } } : {}) };
      const pngM = String(sch.unterschrift?.png ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
      await sqlPool`
        INSERT INTO fiaon_global_auftraege
          (ref, paket_key, land, firma, ansprechpartner, ust_id, bestaetigungen, unterschrift_png, vertrag_pdf, vertrag_version, vertrag_sprache,
           unterschrieben_am, ip, user_agent, quelle, status, doc_hash, firma_name, email, rechnung_ust_modus, ust_hinweis,
           jahresbetreuung, jahresbetreuung_preis_cents, angebot_id)
        VALUES
          (${ref1}, ${ANGEBOT_PAKET_KEY}, ${k.land}, ${jsonb(firma)}, ${jsonb(ansprechpartner)}, ${null},
           ${jsonb(bestaetigungen)}, ${pngM ? Buffer.from(pngM[1], "base64") : null}, ${pdfZeile?.vertrag_pdf ?? null}, ${d.fassung}, 'de',
           ${new Date(z.angenommen_am)}, ${z.ip}, ${z.user_agent}, 'individualangebot', 'offen', ${z.text_hash}, ${firma.name}, ${k.email},
           'none', ${null}, TRUE, ${d.parameter.jahresCents}, ${id})
        ON CONFLICT (ref) DO NOTHING`;
    }
    // Der gewählte Name steht in der Akte — „vorgemerkt“ (geprueft: false), bis jemand ihn im Register geprüft hat.
    if (w?.llc.wunsch) {
      await sqlPool`UPDATE fiaon_global_auftraege SET gesellschaft = ${jsonb({ name: w.llc.wunsch, bundesstaat: STAAT_KURZ[d.parameter.bundesstaat] ?? d.parameter.bundesstaat, geprueft: false })}
                     WHERE ref = ${ref1} AND (gesellschaft IS NULL OR gesellschaft::text IN ('null', '{}'))`.catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Gesellschaft in der Akte:`, e));
    }
    const b = await globalBestellungLesen(ref1);
    if (!b?.payment_reference || !RECHNUNG_STEHT.includes(String(b.payment_status))) {
      const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
      const erg = await bestellungFuerAntrag(ref1, { globalMailFolgt: true });
      if (erg.status !== 200) throw new Error(`Bestellung: ${erg.status} ${JSON.stringify(erg.body).slice(0, 160)}`);
    }
    await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = 'none', tax_id = NULL WHERE ref = ${ref1}`;
    await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = COALESCE(rechnung_am, NOW()) WHERE angebot_id = ${id} AND nr = 1`;
    let [person] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref1}`) as any[];
    if (!person?.person_id) {
      const { bindePersonAnAntrag } = await import("../fiaon-person-model");
      await bindePersonAnAntrag(ref1).catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Person an der Bestellzeile:`, e));
      [person] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref1}`) as any[];
    }
    if (person?.person_id) await sqlPool`UPDATE fiaon_global_angebote SET person_id = COALESCE(person_id, ${Number(person.person_id)}) WHERE id = ${id}`;
    // E-432 (28.10.2026): die Person auch an die Akte — sonst stand person_id dort bis zum nächsten Neustart leer (der Nachtrag in
    // ensureGlobalMandat läuft nur einmal je Prozess), und Chefbüro und Abgleiche sahen keine Person.
    if (person?.person_id) await sqlPool`UPDATE fiaon_global_auftraege SET person_id = ${Number(person.person_id)}, updated_at = NOW() WHERE ref = ${ref1} AND person_id IS NULL`;
    await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = NULL, updated_at = NOW() WHERE id = ${id} AND nacharbeit_fehler IS NOT NULL`;
    return { ok: true };
  } catch (e) {
    const grund = e instanceof Error ? e.message : String(e);
    console.error(`[FIAON-KAPITAL-C] ${z.angebot_ref}: Fertigstellen:`, e);
    await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = ${grund.slice(0, 500)}, updated_at = NOW() WHERE id = ${id}`.catch(() => {});
    return { ok: false, grund };
  }
}

/** Nach der Annahme: Aufgabe an Justin (wiederholbar über den Schlüssel) und genau einmal eine Mail an js@. */
export async function kapitalCNacharbeit(id: number): Promise<void> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen") return;
  if (!z.auftrag_ref || z.nacharbeit_fehler) await kapitalCFertigstellen(id).catch(() => null);
  // Die Vertragsbestätigung an den Kunden (§ 312f BGB) — vor allem anderen; höchstens einmal, nachholbar.
  const best = await kapitalCVertragsbestaetigung(id).catch((e) => ({ ok: false, grund: e instanceof Error ? e.message : String(e) } as { ok: boolean; grund: string | null }));
  const z2 = (await angebotLesen({ id }))!;
  const d = kapitalCDatenAus(z2); const w = kapitalCWahlAus(z2); const par = d.parameter;
  const name = kapitalCName(d.kunde);
  const ft = kapitalCMitFastTrack(par, w);
  const b = z2.auftrag_ref ? await globalBestellungLesen(String(z2.auftrag_ref)).catch(() => null) : null;
  const namen = w ? [w.llc.wunsch, w.llc.alternative1, w.llc.alternative2].filter(Boolean) : [];
  const zeilen = [
    `GESELLSCHAFT: ${namen[0] ?? "—"}${namen.length > 1 ? ` · Ausweichnamen: ${namen.slice(1).join(" · ")}` : ""} — vor der Anmeldung ${staatRegisterIntern(par.bundesstaat)} prüfen.`,
    `LAUFZEIT: ${w && kapitalCLaufzeitGueltig(w.laufzeitJahre, par) ? kapitalCLaufzeitSatz(par, w.laufzeitJahre) : "—"}.`,
    `RECHNUNG: ${kapitalEur(kapitalCHeuteCents(par, ft))} Endpreis (${ft ? `Gründung ${kapitalEur(par.gruendungCents)} + Fast-Track ${kapitalEur(par.fastTrackCents)}` : `Gründung ${kapitalEur(par.gruendungCents)}, OHNE Fast-Track — Sofortbeginn verlangt, Gesellschaft, EIN und ITIN in drei bis fünf Wochen`})${b?.payment_reference ? ` · Zweck ${b.payment_reference} · Zahlungsseite ${absoluteUrl(`/zahlung/${b.payment_reference}?bereich=business`)}` : " — Bestellung hängt, Stundenlauf holt nach"}.`,
    best.ok
      ? `VERTRAGSBESTÄTIGUNG (§ 312f BGB): an ${d.kunde.email} abgeschickt (welcome@, Vertrag mit Annahmevermerk, Widerrufsbelehrung und Formular plus Rechnung als PDF) — Zustellung noch offen: Das System prüft stündlich bei Brevo und meldet sich, wenn sie nicht ankommt.`
      : `VERTRAGSBESTÄTIGUNG (§ 312f BGB) ging NICHT raus (${best.grund ?? "unbekannt"}): Bitte Adresse prüfen und im Office „Auftragsmail nachholen“ drücken — das schickt Vertrag und Rechnung genau einmal. Nicht zusätzlich von Hand schicken (beim Zahlungseingang versucht das System es sonst noch einmal, und der Kunde bekäme sie doppelt). Erst wenn auch das Nachholen scheitert, von Hand — vor Beginn der Ausführung (Sofortbeginn ist verlangt).`,
    `BÜRGSCHAFT: Bedingungen Ziffer 5 — u. a. Bürgin im Register AKTIV${par.buerginAktiv ? "" : " (im Angebot als inaktiv offengelegt — erst nach dem Reinstatement)"}. ERFOLGSHONORAR ${kapitalEur(par.erfolgCents)} per Knopf „${KAPITAL_C_TEIL2.knopf}“, sobald die LLC eingetragen ist.`,
    // E-432 (28.10.2026): Vor dem Zahlungseingang nimmt nur der Tresor im Chefbüro Dokumente an (das Office antwortet 409) —
    // oder in einem Zug mit Metadaten-Bereinigung: scripts/global-auftrag-pflegen.ts --tresor <ordner>.
    ...(par.datenVomKunden ? ["REISEPASS: lädt der Kunde nach der Annahme hoch (Angebotsseite oder „Mein Auftrag“) — vorher nicht anmelden (Ziffer 7). Geburtsdatum und Anschrift hat er selbst eingetragen: bitte mit dem Pass abgleichen."] : []),
    `UNTERLAGEN: ${par.unterlagen.map((u) => u.titel).join(", ") || "—"} — liegen vor; bitte in den Tresor legen: Chefbüro › Global-Mandat › Tresor${z2.auftrag_ref ? ` (${absoluteUrl(globalChefMandatPfad(String(z2.auftrag_ref)))})` : ""}, falls noch nicht geschehen.`,
    `JAHRESBETREUUNG: ${kapitalEur(par.jahresCents)} je Jahr ab dem zweiten Jahr (verlängert sich nicht von selbst).`,
    `Vertrag (PDF mit Annahmevermerk) im Chefbüro: ${CHEF_LINK}.`,
  ];
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: z2.person_id != null ? Number(z2.person_id) : null, ref: null,
    titel: `Kapital-Angebot angenommen: ${name} (privat) — LLC „${namen[0] ?? "?"}“`,
    text: [`${name} hat das Kapital-Angebot ${d.ref} angenommen (${new Date(z2.angenommen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}).`, ...zeilen].join("\n"),
    anBetreiber: true, dringend: true, schluessel: `global:${d.ref}:kapital-justin`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
    anlageText: `Kapital-Angebot ${d.ref} angenommen.`,
  }).catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Aufgabe an Justin:`, e));
  const [marke] = (await sqlPool`
    UPDATE fiaon_global_angebote SET bestaetigung_mail_am = NOW(), updated_at = NOW()
     WHERE id = ${id} AND bestaetigung_mail_am IS NULL RETURNING id`) as any[];
  if (!marke) return;
  await import("./fiaon-global-angebot-aufrufe")
    .then((A) => A.annahmeMelden({ ref: d.ref, name: `${name} (privat)`, art: "Kapital-Angebot", betrag: `${kapitalEur(kapitalCHeuteCents(par, ft))} Endpreis${par.fastTrackWahl ? (ft ? " mit Fast-Track" : " ohne Fast-Track") : ""} (Rechnung mit der Annahme, zahlbar ${kapitalCZahlbar(par.zahlungszielTage)}${par.zahlungszielTage > 0 && b?.payment_due_date ? ` bis ${kapitalTag(berlinToday(new Date(b.payment_due_date)))}` : ""}), ${kapitalEur(par.erfolgCents)} bei Eintragung, ab Jahr 2 ${kapitalEur(par.jahresCents)} je Jahr`, zeilen }))
    .then((s) => console.log(`[FIAON-KAPITAL-C] ${d.ref}: Annahme — ${s}`))
    .catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Annahme-Mail an Justin:`, e));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE VERTRAGSBESTÄTIGUNG (§ 312f Abs. 2, § 312i Abs. 1 Nr. 3 BGB) — automatisch nach der Annahme, höchstens einmal, nachholbar
// Vertrag (angenommenes PDF aus der Akte) + Rechnung als Anhang, Texte aus KAPITAL_C_BESTAETIGUNG, Absender welcome@.
// Marke: fiaon_global_auftraege.auftrag_mail_am (wie die Auftragsmail von /business/start) — bei einem Fehler wieder leer, der Grund
// steht in auftrag_mail_fehler und in der Aufgabe an Justin. Ohne BREVO_API_KEY (Prüfstand) geht nichts raus.
// ═══════════════════════════════════════════════════════════════════════════
export async function kapitalCVertragsbestaetigung(id: number, ausgeloestVon = "System (FIAON Global, Fassung C)"): Promise<{ ok: boolean; grund: string | null; schon?: true }> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen") return { ok: false, grund: "Das Angebot ist nicht angenommen." };
  const ref1 = z.auftrag_ref ? String(z.auftrag_ref) : null;
  if (!ref1) return { ok: false, grund: "Bestellung und Akte fehlen noch (Nachholen)." };
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_auftraege SET auftrag_mail_am = NOW(), auftrag_mail_fehler = NULL, updated_at = NOW()
     WHERE ref = ${ref1} AND auftrag_mail_am IS NULL RETURNING ref`) as any[];
  if (!frei) {
    const [a] = (await sqlPool`SELECT auftrag_mail_am FROM fiaon_global_auftraege WHERE ref = ${ref1} LIMIT 1`) as any[];
    return a?.auftrag_mail_am ? { ok: true, grund: null, schon: true } : { ok: false, grund: "Die Akte fehlt noch (Nachholen)." };
  }
  const d = kapitalCDatenAus(z); const w = kapitalCWahlAus(z); const k = d.kunde; const par = d.parameter;
  const T = KAPITAL_C_BESTAETIGUNG;
  const b = await globalBestellungLesen(ref1).catch(() => null);
  let erg: { ok: boolean; grund: string | null; messageId: string | null };
  try {
    const vertrag = await globalVertragPdfLesen(ref1);
    if (!vertrag) throw new Error("der angenommene Vertrag liegt nicht als PDF in der Akte");
    const rechnung = await globalRechnungPdf(ref1);
    if (!rechnung) throw new Error("die Rechnung ließ sich nicht erzeugen");
    const am = new Date(z.angenommen_am);
    const angenommen = `${am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" })} um ${am.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} Uhr`;
    const llc = w?.llc.wunsch || "Ihre Gesellschaft";
    const plan = w && kapitalCLaufzeitGueltig(w.laufzeitJahre, par) ? kapitalCPlan(par, w.laufzeitJahre) : null;
    const laufzeit = plan ? `${zahlwort(plan.jahre)} Jahre · Monatsrate ${kapitalCEurCent(plan.monatsrateCents)} (Rechenbeispiel)` : "wie gewählt";
    const zweck = b?.payment_reference ? String(b.payment_reference) : null;
    const zahlungsseite = zweck ? absoluteUrl(`/zahlung/${encodeURIComponent(zweck)}?bereich=business`) : null;
    const meinAuftrag = globalMeinAuftragUrl(ref1);
    const ft = kapitalCMitFastTrack(par, w);
    // E-487: tempoFassung des angenommenen Vertrags — leer (vor E-487 angenommen) → die Bestätigung bleibt wortgleich wie damals.
    // Nachbesserung (Gutachten): EINE reine Funktion baut die Absätze (Prüfstand 12d mit einer nach E-487 angenommenen Zeile).
    const absaetze = kapitalCBestaetigungAbsaetze(d, { wahl: w, angenommen, llc, reisepassFehlt: par.datenVomKunden ? !(await kapitalCReisepassDa(ref1)) : false });
    // E-432 (28.10.2026): Zahlungsziel null Tage → „Zahlbar: sofort“; sonst der Tag aus der Bestellung (bei sieben Tagen wie bisher).
    const daten = T.daten({ ref: d.ref, llc, laufzeit, heute: kapitalCEur(kapitalCHeuteCents(par, ft)), zweck, sofort: par.zahlungszielTage <= 0, faellig: b?.payment_due_date ? kapitalTag(berlinToday(new Date(b.payment_due_date))) : null });
    // Runde 2: Brevo verwirft Mails an gesperrte Adressen still (auch Abmelder, auch Service-Mails). Die Vertragsbestätigung ist
    // Pflicht (§ 312f BGB) und vom Kunden eben ausgelöst — die Sperre wird vorher aufgehoben (204 = war gesperrt, 404 = war frei).
    if (process.env.BREVO_API_KEY) {
      const { brevoSperreAufhebenBefund } = await import("./fiaon-brevo");
      const sperre = await brevoSperreAufhebenBefund(k.email).catch(() => null);
      if (sperre?.ergebnis === "aufgehoben" && sperre.status !== 404) {
        await verlaufAngebot(id, ausgeloestVon, "Brevo-Sperre der Kundenadresse vor der Vertragsbestätigung aufgehoben (§ 312f BGB).").catch(() => {});
      }
    }
    // Ohne Signaturkarte: Das Gerüst setzt sie direkt hinter die Absätze — mitten in eine Bestätigung gehört sie nicht.
    const { freitextSenden } = await import("../mail/motor");
    const r = await freitextSenden({
      an: k.email, betreff: T.betreff(d.ref), absender: "welcome",
      text: [...absaetze, daten.map((x) => `${x.label}: ${x.wert}`).join("\n"), T.fussnote].join("\n\n"),
      anhaenge: [{ name: `FIAON_Global_Vertrag_${d.ref}.pdf`, inhalt: vertrag }, { name: rechnung.dateiname, inhalt: rechnung.pdf }],
      baustein: {
        betreff: T.betreff(d.ref), preheader: T.preheader, titel: T.titel, persoenlich: true,
        bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
        absaetze: absaetze.map(escape), daten: daten.map((x) => ({ label: escape(x.label), wert: escape(x.wert) })),
        ...(zahlungsseite ? { knopf: { text: T.knopf, url: zahlungsseite } } : {}),
        knopf2: { text: T.knopf2, url: meinAuftrag },
        fussnote: escape(T.fussnote),
      },
    });
    erg = { ok: r.ok, grund: r.ok ? null : (r.grund ?? "unbekannt"), messageId: r.messageId ?? null };
  } catch (e) { erg = { ok: false, grund: e instanceof Error ? e.message : String(e), messageId: null }; }
  if (erg.ok) {
    await sqlPool`UPDATE fiaon_applications SET welcome_sent_at = COALESCE(welcome_sent_at, NOW()) WHERE ref = ${ref1}`.catch(() => {});
    await globalVerlauf(ref1, `FIAON Global: Vertragsbestätigung (§ 312f BGB) an ${k.email} — Vertrag mit Annahmevermerk und Widerrufsbelehrung plus Rechnung als PDF.`).catch(() => {});
    await verlaufAngebot(id, ausgeloestVon, `Vertragsbestätigung an ${k.email} (Vertrag + Rechnung als PDF)`).catch(() => {});
  } else {
    await sqlPool`UPDATE fiaon_global_auftraege SET auftrag_mail_am = NULL, auftrag_mail_fehler = ${String(erg.grund).slice(0, 500)}, updated_at = NOW() WHERE ref = ${ref1}`.catch(() => {});
    await globalVerlauf(ref1, `FIAON Global: Die Vertragsbestätigung ging NICHT raus (${erg.grund}). Bitte Vertrag und Rechnung von Hand schicken, bevor wir beginnen.`).catch(() => {});
  }
  try {
    const { mailProtokoll } = await import("./fiaon-mail-log");
    await mailProtokoll({
      event: "global_kapital_c_vertrag", personId: z.person_id != null ? Number(z.person_id) : null, empfaenger: k.email || null,
      status: erg.ok ? "versandt" : "fehlgeschlagen", grund: erg.grund, payload: { angebot: d.ref, auftrag: ref1, anhaenge: ["Vertrag (PDF)", "Rechnung (PDF)"] },
      ausgeloestVon, brevoMessageId: erg.messageId,
    });
  } catch (e) { console.error(`[FIAON-KAPITAL-C] ${d.ref}: Mailprotokoll Vertragsbestätigung:`, e); }
  return { ok: erg.ok, grund: erg.grund };
}

// ═══════════════════════════════════════════════════════════════════════════
// ZUSTELLUNG DER VERTRAGSBESTÄTIGUNG (Runde 2, § 312f BGB) — „raus“ heißt nur „Brevo hat angenommen“ (HTTP 201)
// ═══════════════════════════════════════════════════════════════════════════
/** Präfix in fiaon_global_auftraege.auftrag_mail_fehler: Die Bestätigung kam nachweislich NICHT an — kein automatischer neuer Versuch. */
const NICHT_ZUGESTELLT = "nicht zugestellt:";
const ANGEKOMMEN = ["zugestellt", "geoeffnet", "geklickt"];
const GESCHEITERT = ["gebounct", "blockiert", "spam", "fehler"];
/**
 * Der Zustellstand der Vertragsbestätigung eines Angebots seit `seit`. Mit Brevo-Schlüssel fragt er Brevo direkt und zählt NUR die
 * Ereignisse DIESER Mail (gleiche messageId oder Betreff mit der Angebotsnummer — die Zugangs-Einladung geht zur selben Zeit an
 * dieselbe Adresse und darf nicht als Zustellung zählen); das Ergebnis trägt er ins Mailprotokoll ein. Ohne Schlüssel oder wenn
 * Brevo nicht antwortet: der Stand im Mailprotokoll. Angekommen schlägt Fehler (ein „soft bounce“ mit späterer Zustellung ist da).
 * Schickt NIE eine Mail.
 */
export async function kapitalCZustellStand(angebotRef: string, seit: Date): Promise<{ stand: "zugestellt" | "gescheitert" | "offen"; satz: string; zustellung: string | null; grund: string | null }> {
  const [m] = (await sqlPool`
    SELECT id, created_at, empfaenger, brevo_message_id, zustellung, zustellung_grund FROM fiaon_mail_log
     -- E-460 (29.10.2026): Das Protokoll speichert payload als JSON-TEXT in der jsonb-Spalte (doppelt verpackt) — payload->>'angebot'
     -- war immer NULL, jede Vertragsbestätigung galt als „nicht im Mailprotokoll“ (Aufgaben „Zustellung nicht bestätigt“ und
     -- „ERST Vertragsbestätigung senden“, obwohl sie zugestellt war). Die Suche im Text trifft beide Formen.
     WHERE event = 'global_kapital_c_vertrag' AND status = 'versandt' AND strpos(payload::text, ${angebotRef}) > 0
       AND created_at >= ${new Date(seit.getTime() - 10 * 60_000)}
     ORDER BY created_at DESC LIMIT 1`) as any[];
  if (!m) return { stand: "offen", satz: "kein Versand im Mailprotokoll — Zustellung nicht bestätigt", zustellung: null, grund: null };
  let namen: string[] = m.zustellung ? [String(m.zustellung)] : [];
  let grund: string | null = m.zustellung_grund ? String(m.zustellung_grund) : null;
  if (process.env.BREVO_API_KEY && m.empfaenger) {
    const { ereignisseFuer } = await import("./fiaon-brevo");
    const gesendet = new Date(m.created_at).getTime();
    const r = await ereignisseFuer(String(m.empfaenger), new Date(gesendet - 3600_000)).catch(() => null);
    if (r?.ok) {
      const id = m.brevo_message_id ? String(m.brevo_message_id) : "";
      const passend = r.ereignisse.filter((e) => (id && e.messageId === id) || (!!e.betreff && e.betreff.includes(angebotRef) && /Vertrag/.test(e.betreff)));
      namen = passend.map((e) => e.ereignis);
      grund = passend.find((e) => GESCHEITERT.includes(e.ereignis))?.grund ?? null;
      const zustand = namen.find((n) => ANGEKOMMEN.includes(n)) ?? namen.find((n) => GESCHEITERT.includes(n)) ?? null;
      const am = passend.find((e) => e.ereignis === zustand)?.am ?? null;
      if (zustand) await sqlPool`UPDATE fiaon_mail_log SET zustellung = ${zustand}, zustellung_am = ${am ? new Date(am) : null}, zustellung_grund = ${grund}, abgeglichen_am = NOW() WHERE id = ${m.id}`.catch(() => {});
    }
  }
  const angekommen = namen.find((n) => ANGEKOMMEN.includes(n));
  if (angekommen) return { stand: "zugestellt", satz: `zugestellt (${angekommen})`, zustellung: angekommen, grund: null };
  const fehler = namen.find((n) => GESCHEITERT.includes(n));
  if (fehler) return { stand: "gescheitert", satz: `${NICHT_ZUGESTELLT} ${fehler}${grund ? ` — ${grund}` : ""}`, zustellung: fehler, grund };
  return { stand: "offen", satz: "Zustellung bei Brevo nicht bestätigt", zustellung: namen[0] ?? null, grund: null };
}
/**
 * Stündlich (aus kapitalFristLauf): Kam die Vertragsbestätigung an? Nur Fassung C, zwei Stunden bis sieben Tage nach dem Versand,
 * nur mit Brevo-Schlüssel. Nachweislich NICHT angekommen → Marke zurück (auftrag_mail_am NULL, Fehler „nicht zugestellt: …“, damit
 * „Auftragsmail nachholen“ neu schickt und der Start wartet) und EINE dringende Aufgabe. Ohne jede Zustellung → EINE Aufgabe „bitte
 * prüfen“; die Marke bleibt (kein doppelter Versand, falls Brevo nur spät meldet). Je Versand genau eine Aufgabe (Schlüssel mit Zeit).
 * Schickt NIE selbst eine Mail.
 */
export async function kapitalCZustellungLauf(jetzt: Date = new Date()): Promise<{ geprueft: number; gescheitert: number; offen: number }> {
  if (!process.env.BREVO_API_KEY) return { geprueft: 0, gescheitert: 0, offen: 0 };
  const zeilen = (await sqlPool`
    SELECT a.id, a.angebot_ref, a.fassung, a.person_id, a.kunde, g.ref AS akte_ref, g.auftrag_mail_am
      FROM fiaon_global_angebote a JOIN fiaon_global_auftraege g ON g.ref = a.auftrag_ref
     WHERE a.status = 'angenommen' AND a.fassung LIKE 'IA-KAPITAL-%-C' AND g.auftrag_mail_am IS NOT NULL
       AND g.auftrag_mail_am < ${new Date(jetzt.getTime() - 2 * 3600_000)} AND g.auftrag_mail_am > ${new Date(jetzt.getTime() - 7 * 864e5)}
       AND COALESCE(g.status, '') <> 'storniert'
     LIMIT 50`) as any[];
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  let geprueft = 0; let gescheitert = 0; let offen = 0;
  for (const z of zeilen) {
    if (!istKapitalCFassung(z.fassung)) continue;
    const st = await kapitalCZustellStand(String(z.angebot_ref), new Date(z.auftrag_mail_am)).catch((e) => { console.error(`[FIAON-KAPITAL-C] ${z.angebot_ref}: Zustellstand:`, e); return null; });
    geprueft++;
    if (!st || st.stand === "zugestellt") continue;
    const kunde = json<any>(z.kunde, {}); const name = kapitalCName(kunde) || String(z.angebot_ref); const email = String(kunde.email ?? "");
    const ref1 = String(z.akte_ref); const mal = new Date(z.auftrag_mail_am).getTime();
    if (st.stand === "gescheitert") {
      const [zurueck] = (await sqlPool`UPDATE fiaon_global_auftraege SET auftrag_mail_am = NULL, auftrag_mail_fehler = ${st.satz.slice(0, 500)}, updated_at = NOW()
                                       WHERE ref = ${ref1} AND auftrag_mail_am = ${z.auftrag_mail_am} RETURNING ref`) as any[];
      if (!zurueck) continue;
      gescheitert++;
      await verlaufAngebot(Number(z.id), "System", `Vertragsbestätigung NICHT zugestellt (${st.satz}) — Marke zurückgenommen, Aufgabe an Justin.`).catch(() => {});
      await globalVerlauf(ref1, `FIAON Global: Die Vertragsbestätigung kam laut Brevo nicht an (${st.satz}). Vor dem Beginn neu schicken („Auftragsmail nachholen“).`).catch(() => {});
      await auftragFuerKunden({
        personId: z.person_id != null ? Number(z.person_id) : null, ref: ref1,
        titel: `Vertragsbestätigung NICHT zugestellt — ${name} (Kapital-Angebot ${z.angebot_ref})`,
        text: [
          `Die Vertragsbestätigung (§ 312f BGB) an ${email} ist laut Brevo nicht angekommen: ${st.satz}.`,
          "Ohne Bestätigung auf einem dauerhaften Datenträger beginnen wir nicht (Sofortbeginn ist verlangt).",
          "1. Adresse mit dem Kunden klären (Tippfehler, volles Postfach?). 2. Im Office „Auftragsmail nachholen“ drücken — das schickt Vertrag und Rechnung genau einmal neu und hebt vorher eine Brevo-Sperre der Adresse auf.",
          "Das System hat KEINE Mail neu geschickt.",
        ].join("\n"),
        dringend: true, anBetreiber: true, schluessel: `global:${ref1}:vertrag-zustellung:${mal}`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
      }).catch((e) => console.error(`[FIAON-KAPITAL-C] ${z.angebot_ref}: Aufgabe Zustellung:`, e));
    } else {
      offen++;
      await auftragFuerKunden({
        personId: z.person_id != null ? Number(z.person_id) : null, ref: ref1,
        titel: `Vertragsbestätigung: Zustellung nicht bestätigt — ${name} (Kapital-Angebot ${z.angebot_ref})`,
        text: [
          `Die Vertragsbestätigung (§ 312f BGB) an ${email} ging vor über zwei Stunden raus, Brevo meldet aber keine Zustellung (${st.satz}).`,
          "Bitte im Brevo-Protokoll oder beim Kunden nachsehen. Kam sie an, ist nichts zu tun.",
          "Kam sie nicht an: Adresse prüfen, dann Vertrag (PDF aus dem Chefbüro) und Rechnung von Hand schicken — vor dem Beginn (Sofortbeginn ist verlangt).",
          "Das System hat KEINE Mail neu geschickt.",
        ].join("\n"),
        dringend: true, anBetreiber: true, schluessel: `global:${ref1}:vertrag-zustellung-offen:${mal}`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
      }).catch((e) => console.error(`[FIAON-KAPITAL-C] ${z.angebot_ref}: Aufgabe Zustellung offen:`, e));
    }
  }
  return { geprueft, gescheitert, offen };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL 2 — ERFOLGSHONORAR (Knopf „Gesellschaft eingetragen“; die Route ist …/kapital/buergschaft wie Teil 2 der Fassung B)
// ═══════════════════════════════════════════════════════════════════════════
export async function kapitalCGebuehrBerechnen(id: number, artRoh: unknown, ein: any, wer: string): Promise<Ergebnis<{ ref: string; rechnungsnummer: string | null; betragCents: number; zahlungsseite: string | null; meldung: string; schon?: true }>> {
  if (artRoh === "auszahlung") return kapitalCAuszahlungEintragen(id, ein, wer);
  if (artRoh !== "buergschaft" && artRoh !== "eintragung") return nein("Diese Rechnung gibt es nicht.", 404);
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Kapital-Angebot gibt es nicht.", 404);
  const d = kapitalCDatenAus(z);
  // E-506: bei einer bestehenden Gesellschaft hängt Teil 2 an „übernommen und bankfertig“ (Titel, Ereignis, Knopf).
  const g = kapitalCTeil2Fuer(d.parameter);
  const teile = ((z as any).teile as any[] | undefined) ?? [];
  const t1 = teile.find((x) => Number(x.nr) === 1);
  const vorher = teile.find((x) => Number(x.nr) === g.nr);
  const b1 = t1?.bestell_ref ? await globalBestellungLesen(String(t1.bestell_ref)) : null;
  const bVorher = vorher?.bestell_ref ? await globalBestellungLesen(String(vorher.bestell_ref)) : null;
  const p = kapitalCTeil2Pruefen({
    status: String(z.status), parameter: d.parameter, angenommenAm: isoTag(z.angenommen_am), heute: berlinToday(),
    teil1Bezahlt: String(b1?.payment_status) === "paid", vorhanden: vorher ? { rechnungSteht: !!bVorher && RECHNUNG_STEHT.includes(String(bVorher.payment_status)) } : null,
  }, ein);
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
  await sqlPool`
    INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage, meilenstein_am, meilenstein_art, meilenstein_beleg, meilenstein_von, eingetragen_am)
    VALUES (${id}, ${g.nr}, ${g.titel}, ${p.daten.betragCents}, 'meilenstein', ${d.parameter.zahlungszielTage}, ${p.daten.datum}::date, 'eintragung', ${p.daten.beleg || null}, ${wer}, ${p.daten.datum}::date)
    ON CONFLICT (angebot_id, nr) DO NOTHING`;
  await sqlPool`UPDATE fiaon_global_angebot_teile SET meilenstein_am = ${p.daten.datum}::date, eingetragen_am = ${p.daten.datum}::date, meilenstein_beleg = ${p.daten.beleg || null}, meilenstein_von = ${wer}
                 WHERE angebot_id = ${id} AND nr = ${g.nr} AND bestell_ref IS NULL`;
  const [teil] = (await sqlPool`SELECT * FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND nr = ${g.nr}`) as any[];
  if (!teil) return nein("Teil 2 ließ sich nicht anlegen — bitte noch einmal.", 502);
  if (teil.entfallen_am) return nein(`Teil 2 ist entfallen (${teil.entfallen_grund ?? "ohne Grund"}) — keine Rechnung.`, 409);
  let ref = teil.bestell_ref ? String(teil.bestell_ref) : null;
  if (!ref) {
    const neu = `FIAON-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").slice(0, 4).toUpperCase()}`;
    const ok = await bestellzeilePrivat(neu, d.kunde, `${KAPITAL_C_MARKE} — ${g.titel}`, { ip: String(z.ip || ""), userAgent: String(z.user_agent || "") });
    if (!ok) return nein(`Die Bestellzeile für das ${g.titel} ließ sich nicht anlegen — bitte noch einmal.`, 502);
    const [gebunden] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET bestell_ref = ${neu} WHERE id = ${teil.id} AND bestell_ref IS NULL AND entfallen_am IS NULL RETURNING id`) as any[];
    if (!gebunden) {
      await sqlPool`UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE ref = ${neu} AND payment_status IN ('pending', 'pending_payment')`.catch(() => {});
      const [jetzt] = (await sqlPool`SELECT bestell_ref FROM fiaon_global_angebot_teile WHERE id = ${teil.id}`) as any[];
      if (!jetzt?.bestell_ref) return nein("Teil 2 ist inzwischen entfallen — keine Rechnung.", 409);
      ref = String(jetzt.bestell_ref);
    } else ref = neu;
  }
  const b0 = await globalBestellungLesen(ref);
  if (!b0?.payment_reference || !RECHNUNG_STEHT.includes(String(b0.payment_status))) {
    const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
    const erg = await bestellungFuerAntrag(ref, { globalMailFolgt: true });
    if (erg.status !== 200) return nein(`Die Rechnung über das ${g.titel} ließ sich nicht anlegen: ${String((erg.body as any)?.error || erg.status)} — ein weiterer Klick macht hier weiter.`, 502);
  }
  await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = 'none', tax_id = NULL WHERE ref = ${ref}`;
  const [person] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref}`) as any[];
  if (!person?.person_id) {
    const { bindePersonAnAntrag } = await import("../fiaon-person-model");
    await bindePersonAnAntrag(ref).catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Person an Teil 2:`, e));
  }
  const [erst] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = NOW() WHERE id = ${teil.id} AND rechnung_am IS NULL RETURNING id`) as any[];
  const b = await globalBestellungLesen(ref);
  const betrag = kapitalEur(Number(teil.betrag_cents));
  const tag = kapitalTag(isoTag(teil.meilenstein_am) ?? p.daten.datum);
  const zahlungsseite = b?.payment_reference ? absoluteUrl(`/zahlung/${b.payment_reference}?bereich=business`) : null;
  const satz = `${g.ereignis} am ${tag} — Rechnung ${g.titel} ${betrag} Endpreis (${b?.invoice_number ?? ref})`;
  const name = kapitalCName(d.kunde);
  if (erst) {
    await verlaufAngebot(id, wer, satz, { teil: g.nr, bestellRef: ref, ...(teil.meilenstein_beleg ? { beleg: String(teil.meilenstein_beleg) } : {}) });
    await globalVerlauf(ref1, `FIAON Global: ${satz}, ${g.ziffer} des Kapital-Angebots ${d.ref}, zahlbar ${kapitalCZahlbar(Number(teil.zahlungsziel_tage))} (eingetragen von ${wer}).`)
      .catch((e: unknown) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Verlauf der Akte:`, e));
  }
  const zeilen = [
    `${name} (privat) · ${satz}.`,
    `Zahlbar ${kapitalCZahlbar(Number(teil.zahlungsziel_tage))}${b?.payment_due_date ? ` (bis ${kapitalTag(berlinToday(new Date(b.payment_due_date)))})` : ""}${b?.payment_reference ? ` · Verwendungszweck ${b.payment_reference}` : ""}${zahlungsseite ? ` · Zahlungsseite ${zahlungsseite}` : ""}.`,
    `Keine automatische Kundenmail — Rechnung und Zahlungsseite bitte persönlich an ${d.kunde.email} schicken.`,
    ...(teil.meilenstein_beleg ? [`Beleg (intern): ${String(teil.meilenstein_beleg)}`] : []),
    `Chefbüro: ${absoluteUrl(CHEF_LINK)}`,
  ];
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: z.person_id != null ? Number(z.person_id) : null, ref: null,
    titel: `Kapital-Angebot ${d.ref}: ${g.titel} ${betrag} an ${name} schicken`,
    text: zeilen.join("\n"), anBetreiber: true, dringend: true, schluessel: `global:${d.ref}:kapital-teil2`, bereich: "konten", quelle: "global",
    autorName: "FIAON Global", link: CHEF_LINK, anlageText: `${g.knopf} im Chefbüro eingetragen (${wer}).`,
  }).catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Aufgabe ${g.titel}:`, e));
  let mailSatz = "";
  if (erst) {
    try {
      const { eigeneMailSenden } = await import("./fiaon-brevo");
      const v = await eigeneMailSenden({
        an: "js@fiaon.com", name: "Justin", betreff: `${g.titel} berechnet: ${name} — ${betrag} (${d.ref})`, text: zeilen.join("\n\n"),
        knoepfe: [...(zahlungsseite ? [{ text: "Zahlungsseite öffnen", url: zahlungsseite }] : []), { text: "Im Chefbüro ansehen", url: absoluteUrl(CHEF_LINK), leise: true }],
      });
      mailSatz = v.ok ? " Mail an Justin ist raus." : ` Mail an Justin ging nicht raus (${String(v.grund || "unbekannt").slice(0, 120)}) — die Aufgabe steht.`;
    } catch (e) { mailSatz = ` Mail an Justin ging nicht raus (${e instanceof Error ? e.message : String(e)}) — die Aufgabe steht.`; }
  }
  return {
    ok: true, ref, rechnungsnummer: b?.invoice_number ?? null, betragCents: Number(teil.betrag_cents), zahlungsseite,
    meldung: `Rechnung ${b?.invoice_number ?? ref} über das ${g.titel} (${betrag} Endpreis) steht, zahlbar ${kapitalCZahlbar(Number(teil.zahlungsziel_tage))}. Keine Kundenmail — Aufgabe mit Zahlungslink liegt bei Justin.${mailSatz}`,
  };
}

/** Knopf „Finanzierung ausgezahlt“ (Fassung C): hält die Auszahlung fest — Garantie erfüllt, keine Rechnung, keine Kundenmail. */
async function kapitalCAuszahlungEintragen(id: number, ein: any, wer: string): Promise<Ergebnis<{ ref: string; rechnungsnummer: string | null; betragCents: number; zahlungsseite: string | null; meldung: string; schon?: true }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Kapital-Angebot gibt es nicht.", 404);
  const d = kapitalCDatenAus(z);
  const p = kapitalCAuszahlungPruefen({ status: String(z.status), angenommenAm: isoTag(z.angenommen_am), heute: berlinToday(), garantieErfuelltAm: isoTag(z.garantie_erfuellt_am), erstattungAusgeloest: !!z.erstattung_ausgeloest_am, fristBeginn: isoTag(z.frist_beginn) }, ein);
  const ref1 = String(z.auftrag_ref || d.ref);
  if (!p.ok) return p.schon ? { ok: true, schon: true, ref: ref1, rechnungsnummer: null, betragCents: 0, zahlungsseite: null, meldung: p.error } : nein(p.error, 409);
  const [frei] = (await sqlPool`UPDATE fiaon_global_angebote SET garantie_erfuellt_am = ${p.daten.datum}::date, updated_at = NOW() WHERE id = ${id} AND garantie_erfuellt_am IS NULL RETURNING id`) as any[];
  if (!frei) return { ok: true, schon: true, ref: ref1, rechnungsnummer: null, betragCents: 0, zahlungsseite: null, meldung: "Die Auszahlung ist schon eingetragen." };
  const satz = `Finanzierung über ${kapitalEur(d.parameter.betragCents)} ausgezahlt am ${kapitalTag(p.daten.datum)} — Garantie (Ziffer 4) erfüllt`;
  await verlaufAngebot(id, wer, satz, p.daten.beleg ? { beleg: p.daten.beleg } : {});
  if (z.auftrag_ref) await globalVerlauf(ref1, `FIAON Global: ${satz} (Kapital-Angebot ${d.ref}, eingetragen von ${wer}).`).catch((e: unknown) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Verlauf der Akte:`, e));
  return { ok: true, ref: ref1, rechnungsnummer: null, betragCents: 0, zahlungsseite: null, meldung: `${satz}. Keine Rechnung, keine Kundenmail — die Fristwarnungen enden.` };
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNG — aus kapitalNachZahlung (alle Buchungswege gehen durch onCustomerPaid)
// ═══════════════════════════════════════════════════════════════════════════
export async function kapitalCNachZahlung(ref: string, t: any, z: AngebotZeile): Promise<{ gestartet: boolean; grund?: string }> {
  const d = kapitalCDatenAus(z);
  const b = await globalBestellungLesen(ref);
  if (!b || String(b.payment_status) !== "paid") return { gestartet: false, grund: "nicht bezahlt" };
  const [erstmals] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET bezahlt_am = ${b.completed_at ?? new Date()} WHERE id = ${t.id} AND bezahlt_am IS NULL RETURNING id`) as any[];
  const ref1 = String(z.auftrag_ref || ref);
  const nr = Number(t.nr);
  const name = kapitalCName(d.kunde);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  if (nr !== 1) {
    if (!erstmals) return { gestartet: false, grund: `${String(t.titel)} schon als bezahlt vermerkt` };
    const nachGarantiefall = !!(z.erstattung_ausgeloest_am || t.entfallen_am);
    const satz = `${String(t.titel)} des Kapital-Angebots ${d.ref} bezahlt (${kapitalEur(Number(t.betrag_cents))}${b.payment_reference ? `, ${b.payment_reference}` : ""}).`
      + (nachGarantiefall ? " ACHTUNG: Der Garantiefall ist vorgemerkt — dieser Betrag ist zu erstatten." : isoTag(z.frist_ende) ? ` Die Garantiefrist (Ziffer 4) bleibt beim ${kapitalTag(isoTag(z.frist_ende))}.` : "");
    await verlaufAngebot(Number(z.id), "System", satz, { teil: nr, bestellRef: ref });
    await globalVerlauf(ref1, `FIAON Global: ${satz}`).catch((e: unknown) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Verlauf der Akte:`, e));
    if (nachGarantiefall) {
      await auftragFuerKunden({
        personId: b.person_id != null ? Number(b.person_id) : null, ref: ref1,
        titel: `Kapital-Angebot ${d.ref}: ${String(t.titel)} nach dem Garantiefall bezahlt — ${kapitalEur(Number(t.betrag_cents))} erstatten`,
        text: `${satz} Das System hat KEIN Geld bewegt.`, dringend: true, anBetreiber: true, schluessel: `global:${d.ref}:kapital-teil${nr}-nach-garantiefall`,
        bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
      }).catch((e) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Aufgabe Teil ${nr} nach Garantiefall:`, e));
    }
    return { gestartet: false, grund: `${String(t.titel)} bezahlt — keine neue Frist` };
  }
  await sqlPool`UPDATE fiaon_global_auftraege SET status = 'bezahlt', bezahlt_am = COALESCE(bezahlt_am, ${b.completed_at ?? new Date()}), updated_at = NOW() WHERE ref = ${ref1} AND status = 'offen'`;
  const akte = await globalAkteLesen(ref1);
  if (!akte) return { gestartet: false, grund: "Akte fehlt" };
  const bezahltAm = berlinToday(new Date(b.completed_at ?? new Date()));
  const angenommen = isoTag(z.angenommen_am);
  const beginn = angenommen && angenommen > bezahltAm ? angenommen : bezahltAm;
  const ende = (() => { const x = new Date(`${beginn}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + d.parameter.garantieWochen * 7); return x.toISOString().slice(0, 10); })();
  await sqlPool`UPDATE fiaon_global_angebote SET frist_beginn = ${beginn}::date, frist_ende = ${ende}::date, updated_at = NOW() WHERE id = ${z.id} AND frist_beginn IS NULL`;
  if (String(akte.status) === "gestartet") return { gestartet: false, grund: "schon gestartet" };
  const z2 = (await angebotLesen({ id: Number(z.id) }))!;
  const frist = { beginn: isoTag(z2.frist_beginn) ?? beginn, ende: isoTag(z2.frist_ende) ?? ende };
  const w = kapitalCWahlAus(z2);
  // § 312f BGB: Ohne Vertragsbestätigung auf einem dauerhaften Datenträger beginnt FIAON nicht. Runde 2: „raus“ reicht nicht — die
  // Bestätigung muss ZUGESTELLT sein (Brevo). Ging sie nie raus, noch ein automatischer Versuch; kam sie nachweislich nicht an
  // (gebounct/blockiert), KEIN neuer Versuch an dieselbe Adresse — die Start-Aufgabe sagt dann zuerst „ERST Vertragsbestätigung …“.
  const best: { ok: boolean; grund: string | null } = akte.auftrag_mail_am
    ? await kapitalCZustellStand(d.ref, new Date(akte.auftrag_mail_am)).then((st) => (st.stand === "zugestellt" ? { ok: true, grund: null } : { ok: false, grund: st.satz }))
      .catch((e) => ({ ok: false, grund: `Zustellung nicht prüfbar (${e instanceof Error ? e.message : String(e)})` }))
    : String(akte.auftrag_mail_fehler ?? "").startsWith(NICHT_ZUGESTELLT)
      ? { ok: false, grund: String(akte.auftrag_mail_fehler) }
      : await kapitalCVertragsbestaetigung(Number(z.id)).catch((e) => ({ ok: false, grund: e instanceof Error ? e.message : String(e) }));
  // E-474/E-475: die Wahl zum Fast-Track (beide beginnen sofort, sie ändert das Tempo); mit datenVomKunden der Stand des Reisepasses.
  const ft = kapitalCMitFastTrack(d.parameter, w);
  const reisepassDa = d.parameter.datenVomKunden ? await kapitalCReisepassDa(ref1) : null;
  // E-487 (Gutachten): der Tag des Reisepasses — für die Frist zählt der spätere Eingang (Zahlung oder Pass, Ziffer 2 Absatz 3).
  const reisepassAm = reisepassDa ? await kapitalCReisepassAm(ref1) : null;
  const auf = kapitalCStartAufgabe({ angebotRef: d.ref, name, parameter: d.parameter, bezahltAm, zweck: b.payment_reference ?? null, frist, llc: w?.llc.wunsch ?? null, laufzeitJahre: w?.laufzeitJahre ?? null, bestaetigung: { da: best.ok, grund: best.grund ?? null },
    ...(d.parameter.fastTrackWahl ? { fastTrack: ft } : {}), ...(reisepassDa != null ? { reisepassDa } : {}), ...(reisepassAm ? { reisepassAm } : {}) });
  let aufgabeId: number | null = null;
  try {
    const erg = await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref: ref1, titel: auf.titel, text: auf.text,
      dringend: true, anBetreiber: true, schluessel: `global:${ref1}:start`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: CHEF_LINK, anlageText: "Zahlungseingang Teil 1 — Kapital-Angebot (Fassung C) startet.",
    });
    aufgabeId = erg.id;
  } catch (e) { console.error(`[FIAON-KAPITAL-C] ${d.ref}: Aufgabe „Gründung bezahlt“:`, e); }
  if (!aufgabeId) return { gestartet: false, grund: "Aufgabe nicht angelegt" };
  await sqlPool`UPDATE fiaon_global_auftraege SET status = 'gestartet', gestartet_am = COALESCE(gestartet_am, NOW()), updated_at = NOW() WHERE ref = ${ref1} AND status IN ('offen', 'bezahlt')`;
  await import("./fiaon-global-bereich").then((m) => m.globalStartVermerken(ref1)).catch((e) => console.error(`[FIAON-KAPITAL-C] ${ref1}: Etappe 1:`, e));
  await verlaufAngebot(Number(z.id), "System", `${ft ? "Gründung und Fast-Track" : "Gründung (ohne Fast-Track)"} bezahlt (${b.payment_reference ?? ref}) — Auftrag gestartet, Garantie (Ziffer 4) bis ${kapitalTag(frist.ende)}`);
  await globalVerlauf(ref1, `FIAON Global: ${ft ? "Gründung und Fast-Track" : "Gründung"} des Kapital-Angebots ${d.ref} bezahlt, Auftrag gestartet — Garantie (Ziffer 4) bis ${kapitalTag(frist.ende)}.`).catch((e: unknown) => console.error(`[FIAON-KAPITAL-C] ${d.ref}: Verlauf der Akte:`, e));
  return { gestartet: true };
}

/** Die Fristwarnung einer Zeile der Fassung C (aus kapitalFristLauf). */
export function kapitalCFristAufgabeFuer(z: any, s: { schritt: "warnung14" | "warnung3" | "abgelaufen"; tageBis: number }): { titel: string; text: string; dringend: boolean } {
  const d = kapitalCDatenAus(z as AngebotZeile);
  return kapitalCFristAufgabe({ ...s, angebotRef: d.ref, name: kapitalCName(d.kunde) || d.ref, fristBeginn: isoTag(z.frist_beginn), fristEnde: isoTag(z.frist_ende)!, parameter: d.parameter });
}

/** „Mein Auftrag“ und Office — Teile mit Stand und Rechnung, Garantie aus Ziffer 4. Nur lesen. */
export async function kapitalCSichtZurAkte(z: AngebotZeile): Promise<Record<string, unknown>> {
  const d = kapitalCDatenAus(z);
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
  const w = kapitalCWahlAus(z);
  const sicht = kapitalCMeinAuftrag({
    parameter: d.parameter, angenommenAm: isoTag(z.angenommen_am), teile: roh,
    garantieErfuelltAm: isoTag(z.garantie_erfuellt_am), erstattungAusgeloest: !!z.erstattung_ausgeloest_am,
    gespeichert: { beginn: isoTag(z.frist_beginn), ende: isoTag(z.frist_ende) }, laufzeitJahre: w?.laufzeitJahre ?? null,
    ...(d.parameter.fastTrackWahl ? { fastTrack: kapitalCMitFastTrack(d.parameter, w) } : {}),
  });
  return {
    art: "kapital", variante: "privat", ref: d.ref, buergin: d.buergin.name, erstattungAusgeloest: !!z.erstattung_ausgeloest_am,
    garantieErfuelltAm: isoTag(z.garantie_erfuellt_am), erstattungCents: z.erstattung_cents != null ? Number(z.erstattung_cents) : null,
    startgespraech: null,
    ...sicht,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LISTE DER LEITUNG (Reiter „Individualangebote“) — dieselben Schlüssel wie Fassung B, Texte der Fassung C
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalCListenEintrag(z: AngebotZeile, ext: { heute: string; aufrufe: unknown; teile?: any[] }): Record<string, unknown> {
  const d = kapitalCDatenAus(z); const par = d.parameter;
  const status = angebotStatusAus(z, ext.heute);
  const fehlt = kapitalCPflichtFehlen(d);
  const w = kapitalCWahlAus(z);
  const teile = ext.teile ?? [];
  const t1 = teile.find((t) => Number(t.nr) === 1);
  const t2 = teile.find((t) => Number(t.nr) === 2);
  const p2 = kapitalCTeil2Pruefen({
    status: String(z.status), parameter: par, angenommenAm: isoTag(z.angenommen_am), heute: ext.heute, teil1Bezahlt: String(t1?.payment_status) === "paid",
    vorhanden: t2 ? { rechnungSteht: RECHNUNG_STEHT.includes(String(t2.payment_status ?? "")) } : null,
  }, { datum: ext.heute });
  const pa = kapitalCAuszahlungPruefen({ status: String(z.status), angenommenAm: isoTag(z.angenommen_am), heute: ext.heute, garantieErfuelltAm: isoTag(z.garantie_erfuellt_am), erstattungAusgeloest: !!z.erstattung_ausgeloest_am, fristBeginn: isoTag(z.frist_beginn) }, { datum: ext.heute });
  const name = kapitalCName(d.kunde);
  // E-474: Betrag nach der Wahl (offen und ohne fastTrackWahl: mit Fast-Track wie bisher) — die Leitung sieht die Wahl in der Zeile.
  const ftL = kapitalCMitFastTrack(par, w);
  const ftZeile = par.fastTrackWahl ? (w ? (ftL ? " · mit Fast-Track" : " · OHNE Fast-Track") : " · Fast-Track nach Wahl des Kunden") : "";
  const laufzeit = w && kapitalCLaufzeitGueltig(w.laufzeitJahre, par) ? ` · Laufzeit ${w.laufzeitJahre} J. (Rate ${kapitalCEurCent(kapitalCPlan(par, w.laufzeitJahre).monatsrateCents)})` : "";
  return {
    art: "kapital", variante: "privat",
    id: Number(z.id), ref: d.ref, status, fassung: d.fassung, personId: z.person_id ?? null,
    kunde: d.kunde, kundeName: `${name} (privat)`, parameter: par, gesamtCents: kapitalCHeuteCents(par, ftL),
    fehlt, annahmeBereit: fehlt.length === 0 && status === "offen", versandSperre: null,
    gueltigBis: d.gueltigBis, erstelltAm: new Date(z.created_at).toISOString(), erstelltVon: z.erstellt_von ?? null,
    link: status === "offen" || status === "angenommen" ? absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(d.ref, d.gueltigBis))) : null,
    vertragUrl: `/api/fiaon/admin/global/angebote/${z.id}/vertrag.pdf`,
    pruefberichtUrl: null, anlage1Url: null, pruefbericht: null, buergin: d.buergin,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null, ip: z.ip ?? null, textHash: z.text_hash ?? null,
    schalter: null,
    kapital: { llc: w?.llc ?? null, zeile: `LLC in ${par.bundesstaat} · ${kapitalEur(kapitalCHeuteCents(par, ftL))} heute + ${kapitalEur(par.erfolgCents)} bei Eintragung + ${kapitalEur(par.jahresCents)}/Jahr ab Jahr 2 (Endpreise) · Finanzierung ${kapitalEur(par.betragCents)} in USD${laufzeit}${ftZeile}${par.datenVomKunden ? (kapitalCAngabenFehlen(d) ? " · Angaben trägt der Kunde ein (noch offen)" : " · Angaben vom Kunden eingetragen") : ""} · Privatperson (Fassung C)` },
    auftragRef: z.auftrag_ref ?? null, officeLink: z.auftrag_ref ? globalOfficeAuftragPfad(String(z.auftrag_ref)) : null,
    teile: [...teile].sort((a, b) => Number(a.nr) - Number(b.nr)).map((t) => ({
      nr: Number(t.nr), titel: String(t.titel), betragCents: Number(t.betrag_cents), bestellRef: t.bestell_ref ?? null,
      verwendungszweck: t.payment_reference ?? null, rechnungsnummer: t.invoice_number ?? null, zahlungsstatus: t.payment_status ?? null,
      zahlbarBis: t.payment_due_date ? berlinToday(new Date(t.payment_due_date)) : null,
      bezahltAm: t.bezahlt_am ? new Date(t.bezahlt_am).toISOString() : (String(t.payment_status) === "paid" && t.completed_at ? new Date(t.completed_at).toISOString() : null),
      ereignisAm: isoTag(t.meilenstein_am), entfallenAm: t.entfallen_am ? new Date(t.entfallen_am).toISOString() : null,
      rechnungUrl: t.bestell_ref && RECHNUNG_STEHT.includes(String(t.payment_status ?? "")) ? `/api/fiaon/admin/global/auftraege/${encodeURIComponent(String(t.bestell_ref))}/rechnung.pdf` : null,
      zahlungsseite: t.payment_reference ? `/zahlung/${t.payment_reference}?bereich=business` : null,
    })),
    nacharbeitFehler: z.nacharbeit_fehler ?? null,
    // Der erste Knopf ist hier „Gesellschaft eingetragen“ (Teil 2 = Erfolgshonorar); einen Teil 3 gibt es nicht.
    gebuehren: { buergschaftCents: par.erfolgCents, auszahlungCents: 0, vereinbart: true, garantieWochen: par.garantieWochen },
    knopfTexte: {
      buergschaft: par.bestand
        ? { knopf: kapitalCTeil2Fuer(par).knopf, datum: kapitalCTeil2Fuer(par).datumLabel, hinweis: par.bestand.erfolgBei === "buergschaft" ? `${KAPITAL_C_TEIL2.ziffer}: Erfolgshonorar erst, wenn die bestehende Gesellschaft (${par.bestand.name}) übernommen ist UND die Bürgschaft steht — vorher nicht drücken.` : `${KAPITAL_C_TEIL2.ziffer}: Erfolgshonorar, sobald die bestehende Gesellschaft (${par.bestand.name}) übernommen und bankfertig ist — Berichtigungen eingereicht, Operating Agreement unterschrieben.`, ereignis: par.bestand.erfolgBei === "buergschaft" ? "übernommen, Bürgschaft steht" : "übernommen" }
        : { knopf: KAPITAL_C_TEIL2.knopf, datum: `${KAPITAL_C_TEIL2.datumLabel} (Bundesstaat)`, hinweis: `${KAPITAL_C_TEIL2.ziffer}: Erfolgshonorar mit der Eintragung der Gesellschaft.`, ereignis: "eingetragen" },
      auszahlung: { knopf: KAPITAL_C_AUSZAHLUNG.knopf, datum: KAPITAL_C_AUSZAHLUNG.datumLabel, hinweis: KAPITAL_C_AUSZAHLUNG.hinweis, ereignis: "ausgezahlt", ohneRechnung: true },
    },
    garantieErfuelltAm: isoTag(z.garantie_erfuellt_am),
    // E-512: Ruhetage der Garantiefrist — Gründe nach dem Wortlaut, den der Kunde angenommen hat (tempoFassung aus dem Annahmevermerk).
    ruhen: kapitalRuhenLage({ fassungC: true, ruhenErweitert: kapitalCRuhenErweitert(par), datenVomKunden: !!par.datenVomKunden, status: String(z.status),
      fristBeginn: isoTag(z.frist_beginn), fristEnde: isoTag(z.frist_ende), hemmungTage: Number(z.frist_hemmung_tage || 0),
      garantieErfuellt: !!z.garantie_erfuellt_am, erstattung: !!z.erstattung_ausgeloest_am, verlauf: json<any[]>(z.verlauf, []) }),
    knoepfe: {
      buergschaft: p2.ok ? null : p2.error, auszahlung: pa.ok ? null : pa.error,
      meilenstein: "Kapital-Angebot (Fassung C): Knöpfe „Gesellschaft eingetragen“ und „Finanzierung ausgezahlt“ im Block des Angebots.", erstattung: "Kapital-Angebot: die Garantie (Ziffer 4) klärt die Leitung.", garantie: "Kapital-Angebot: die Garantie (Ziffer 4) klärt die Leitung.", hemmung: "Kapital-Angebot: Ruhezeiten bitte im Verlauf festhalten.",
      aendern: String(z.status) === "offen" ? "Ändern per Skript (scripts/angebot-kapital-anlegen.ts)" : "Nur solange das Angebot offen ist.",
    },
    verlauf: json<any[]>(z.verlauf, []).slice(-12),
    aufrufe: ext.aufrufe ?? null,
    startgespraech: null,
    zurueckgezogenAm: z.zurueckgezogen_am ? new Date(z.zurueckgezogen_am).toISOString() : null, zurueckgezogenGrund: z.zurueckgezogen_grund ?? null,
    bestaetigungMailAm: z.bestaetigung_mail_am ? new Date(z.bestaetigung_mail_am).toISOString() : null,
  };
}
