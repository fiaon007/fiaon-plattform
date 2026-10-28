// ═══════════════════════════════════════════════════════════════════════════
// DOKUMENTE & UNTERSCHRIFTEN JE MANDAT — Server (22.10.2026)
//
// Justin: „Mach alles komplett fertig, sodass jeder Vertrag, jedes Formular —
//          alles für den Kunden bereit ist.“ Kein Fremdanbieter, so einfach wie
//          möglich, unterschrieben wird erst NACH der Annahme des Vertrags.
//
// Fünf Dokumente je Mandat (Inhalt rein in shared/):
//   fiaon_befugnisse        Ergänzung für Kunden mit älterer Vertragsfassung — legt sich
//                           selbst an und steht unter „Für Sie zu tun“ (ergaenzungSicherstellen)
//   us_organizer            Statement of Organizer — FIAON unterschreibt (Team), dann bestätigt
//                           das Mitglied im Portal
//   us_operating_agreement  Operating Agreement — die Mitglieder unterschreiben im Portal
//   irs_ss4 / irs_8821      vorausgefüllt; von Hand (drucken, unterschreiben, Scan) — NIE digital
//
// Ablauf im Team (Chefbüro › Global › Mandat › „Dokumente & Unterschriften“, Office › Global-Akte):
//   Angaben vervollständigen → „Formular erzeugen“ (nur vollständig) → Vorschau prüfen →
//   (SoO: „FIAON unterschreibt“) → „zur Unterschrift bereitstellen“ (prüft, dass die Daten
//   seit dem Erzeugen gleich sind). Ändern sich Daten, wird neu erzeugt.
//
// Speicher (Migration 125): fiaon_global_auftraege.formular_angaben (Angaben des Teams),
// fiaon_global_dokumente.formular_daten (Schnappschuss je erzeugtem Dokument — damit die
// unterschriebene Fassung genau aus denselben Daten entsteht), unterschrift_nachweis (der
// Nachweis aller Unterschriften, SignaturAkte), fiaon_global_unterschrift_codes (Codes).
// Fassungen: das Original bleibt; jede Unterschrift legt eine neue „unterschriebene Fassung“
// an (unterschrift_von_id → Original), die vorige Zwischenfassung wird ausgeblendet
// (geloescht_am — nie hart gelöscht; ihre Prüfsumme steht im Nachweis).
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, randomBytes } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { sqlPool } from "./db-pool";
import {
  FORMULAR_ARTEN, US_DOKUMENTE_FASSUNG, formularFehlend, unterzeichnerVon, satzDokument, docIdAus, landEn,
  type FormularArt, type FormularAngaben, type FormularKontext, type Fehlend, type SatzDokument, type Mitglied,
} from "@shared/fiaon-global-us-dokumente";
import { irsBelegung, SS4_TAETIGKEITEN, type IrsFeld } from "@shared/fiaon-global-irs";
import {
  ESIGN_FASSUNG, UNTERSCHRIFT_WOERTER, digitalErlaubt, namePasst, zustimmungText, zertifikatZeilen, emailMaske,
  type SignaturAkte, type UnterschriftNachweis,
} from "@shared/fiaon-global-unterschrift";
import { ergaenzungNoetig } from "@shared/fiaon-global-befugnisse";
import { globalPflichtUnterlage } from "@shared/fiaon-global-akte";
import { stationTelefonText } from "@shared/fiaon-global-stationen";
import { globalChefMandatPfad } from "@shared/fiaon-global-wege";
import { satzPdf, anhaengen, type Signatur } from "./fiaon-global-pdf-satz";

type Erg<T> = ({ ok: true } & T) | { ok: false; status: number; error: string; fehlend?: Fehlend[] };
const nein = (status: number, error: string, fehlend?: Fehlend[]) => ({ ok: false as const, status, error, ...(fehlend ? { fehlend } : {}) });
const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const knapp = (v: unknown, max = 300) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object" && !Buffer.isBuffer(v)) return v as T;
  try { const x = JSON.parse(String(v ?? "")); return (typeof x === "string" ? JSON.parse(x) : x) ?? leer; } catch { return leer; }
}
const TITEL: Record<FormularArt, { de: string; en: string; datei: string }> = {
  fiaon_befugnisse: { de: "Ergänzung zu Ihrem Auftrag – Ihre Befugnisse für FIAON", en: "Addendum to your engagement – your authority for FIAON", datei: "FIAON_Ergaenzung_Befugnisse" },
  us_organizer: { de: "Statement of Organizer", en: "Statement of Organizer", datei: "Statement_of_Organizer" },
  us_operating_agreement: { de: "Operating Agreement", en: "Operating Agreement", datei: "Operating_Agreement" },
  irs_ss4: { de: "IRS Form SS-4 (EIN)", en: "IRS Form SS-4 (EIN)", datei: "IRS_Form_SS-4" },
  irs_8821: { de: "IRS Form 8821 (Steuerauskunft)", en: "IRS Form 8821 (tax information authorization)", datei: "IRS_Form_8821" },
};
const istIrs = (a: FormularArt): a is "irs_ss4" | "irs_8821" => a === "irs_ss4" || a === "irs_8821";
export function formularArt(roh: unknown): FormularArt | null {
  const s = String(roh ?? "").trim();
  return (FORMULAR_ARTEN as string[]).includes(s) ? (s as FormularArt) : null;
}

// ── SCHEMA (Migration 125, zur Laufzeit nachgezogen) ──────────────────────────
let bereit: Promise<void> | null = null;
export function ensureUnterschrift(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const { ensureAkteKomplett } = await import("./fiaon-global-akte-komplett");
      await ensureAkteKomplett();
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_global_auftraege ADD COLUMN IF NOT EXISTS formular_angaben JSONB`;
        await tx`ALTER TABLE fiaon_global_dokumente ADD COLUMN IF NOT EXISTS formular_daten JSONB`;
      });
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_unterschrift_codes (
          id BIGSERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL,
          dokument_id BIGINT NOT NULL,
          ansicht_id BIGINT NOT NULL,
          ansicht_sha256 TEXT NOT NULL,
          unterzeichner_nr INTEGER NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          zugang TEXT NOT NULL CHECK (zugang IN ('sitzung', 'link')),
          konto_email TEXT,
          sprache TEXT NOT NULL DEFAULT 'de' CHECK (sprache IN ('de', 'en')),
          zustimmung_fassung TEXT NOT NULL,
          zustimmung_sha256 TEXT NOT NULL,
          vorgang_hash TEXT NOT NULL UNIQUE,
          code_hash TEXT NOT NULL,
          gueltig_bis TIMESTAMPTZ NOT NULL,
          versuche INTEGER NOT NULL DEFAULT 0,
          neu_gesendet INTEGER NOT NULL DEFAULT 0,
          letzter_versand_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          eingeloest_am TIMESTAMPTZ,
          verworfen_am TIMESTAMPTZ,
          ip TEXT,
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_unterschrift_codes_dok_idx ON fiaon_global_unterschrift_codes (ref, dokument_id, created_at DESC)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ── DIE DATEN EINES MANDATS ──────────────────────────────────────────────────
function adresseEinzeilig(roh: unknown): string {
  return String(roh ?? "").split(/\r?\n/).map((x) => knapp(x)).filter(Boolean).join(", ");
}
/** Die Akte als FormularKontext. `mitItin`: nur für das SS-4 (entschlüsselt am Server, nie im Schnappschuss). */
export async function formularKontext(ref: string, o: { mitItin?: boolean } = {}): Promise<FormularKontext | null> {
  await ensureUnterschrift();
  const [g] = (await sqlPool`
    SELECT ref, email, firma, ansprechpartner, gesellschaft, gesellschaft_plus, vertrag_version, vertrag_sprache, unterschrieben_am, formular_angaben
      FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  if (!g) return null;
  const firma = json<Record<string, any>>(g.firma, {});
  const ap = json<Record<string, any>>(g.ansprechpartner, {});
  const ges = json<Record<string, any>>(g.gesellschaft, {});
  const plus = json<Record<string, any>>(g.gesellschaft_plus, {});
  const privat = String(firma.art ?? "") === "privat";
  const name = [ap.vorname, ap.nachname].map((x) => knapp(x)).filter(Boolean).join(" ") || (privat ? knapp(firma.name) : "");
  const wohn = privat
    ? [knapp(firma.strasse), [knapp(firma.plz), knapp(firma.ort)].filter(Boolean).join(" "), landEn(firma.land)].filter(Boolean).join(", ")
    : adresseEinzeilig(plus.kontaktAdresse);
  const fassung = String(g.vertrag_version ?? "");
  let itin: string | null = null;
  if (o.mitItin && plus.itinEnc) {
    try { const { decryptSecret } = await import("../routes/fiaon-agent"); itin = decryptSecret(String(plus.itinEnc)) || null; } catch (e) { console.error(`[GLOBAL-UNTERSCHRIFT] ${ref}: ITIN nicht lesbar:`, e); }
  }
  const tag = (v: unknown) => (v ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(v as any)) : null);
  return {
    ref, sprache: String(g.vertrag_sprache ?? "").toLowerCase() === "en" ? "en" : "de",
    kundeName: name, kundeAnschrift: wohn, kundeEmail: knapp(ap.email || g.email).toLowerCase(), kundeTelefon: knapp(plus.kontaktTelefon || ap.telefon),
    firmaName: privat ? "" : knapp(firma.name), weiblich: /^IA-(FIRMA|KAPITAL)-/i.test(fassung),
    vertragFassung: fassung, vertragAm: tag(g.unterschrieben_am),
    llc: {
      name: knapp(ges.name), bundesstaat: knapp(ges.bundesstaat).toUpperCase(), gegruendetAm: ges.gegruendetAm ? String(ges.gegruendetAm).slice(0, 10) : null,
      aktenzeichen: knapp(plus.aktenzeichen), ein: knapp(plus.ein), usAdresse: String(plus.usAdresse ?? "").trim(), agentAdresse: String(plus.agentAdresse ?? "").trim(),
      usTelefon: stationTelefonText(knapp(plus.usTelefon)), kontaktperson: knapp(plus.kontaktperson),
    },
    itin,
    angaben: json<FormularAngaben>(g.formular_angaben, {}),
  };
}
/** Der Schnappschuss ohne Geheimnis (ITIN) — und seine Prüfsumme (zeigt, ob sich die Daten seit dem Erzeugen geändert haben). */
function schnappschuss(k: FormularKontext): { kontext: FormularKontext; hash: string } {
  const kontext = { ...k, itin: k.itin ? "vorhanden" : null };
  return { kontext, hash: sha(JSON.stringify(kontext)) };
}

/** Braucht das Mandat die Ergänzung? Der Auftrag und alle angenommenen Angebote der Person zählen. */
export async function ergaenzungFuer(ref: string): Promise<boolean> {
  const [g] = (await sqlPool`SELECT vertrag_version, vertrag_pdf IS NOT NULL AS hat, person_id, angebot_id FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  if (!g) return false;
  const weitere = (await sqlPool`
    SELECT fassung FROM fiaon_global_angebote WHERE status = 'angenommen'
       AND (auftrag_ref = ${ref} OR id = ${g.angebot_id ?? null}::bigint OR (${g.person_id ?? null}::int IS NOT NULL AND person_id = ${g.person_id ?? null}::int))`.catch(() => [])) as any[];
  return ergaenzungNoetig({ vertragVersion: g.vertrag_version, angenommen: !!g.hat || !!g.vertrag_version, weitereFassungen: weitere.map((w) => w.fassung) });
}

// ── DOKUMENTE LESEN ──────────────────────────────────────────────────────────
interface DokZeile { id: number; art: string; pflicht_key: string; titel: string | null; dateiname: string; inhalt?: Buffer; sichtbar_fuer_kunde: boolean; unterschrift_gefordert: boolean;
  unterschrieben_am: string | null; unterschrift_von_id: number | null; unterschrift_art: string | null; formular_daten: any; unterschrift_nachweis: any; created_at: string; doc_hash: string | null }
async function originalVon(ref: string, art: FormularArt): Promise<DokZeile | null> {
  const [d] = (await sqlPool`
    SELECT id, art, pflicht_key, titel, dateiname, sichtbar_fuer_kunde, unterschrift_gefordert, unterschrieben_am, unterschrift_von_id, unterschrift_art,
           formular_daten, unterschrift_nachweis, created_at, doc_hash
      FROM fiaon_global_dokumente WHERE ref = ${ref} AND pflicht_key = ${art} AND unterschrift_von_id IS NULL AND geloescht_am IS NULL
     ORDER BY created_at DESC, id DESC LIMIT 1`) as any[];
  return d ? { ...d, id: Number(d.id) } : null;
}
async function fassungenVon(ref: string, originalId: number): Promise<{ id: number; sichtbar: boolean; unterschrieben: boolean; created_at: string; doc_hash: string }[]> {
  const z = (await sqlPool`
    SELECT id, sichtbar_fuer_kunde, unterschrieben_am, created_at, doc_hash FROM fiaon_global_dokumente
     WHERE ref = ${ref} AND unterschrift_von_id = ${originalId} AND geloescht_am IS NULL ORDER BY created_at DESC, id DESC`) as any[];
  return z.map((x) => ({ id: Number(x.id), sichtbar: !!x.sichtbar_fuer_kunde, unterschrieben: !!x.unterschrieben_am, created_at: String(x.created_at), doc_hash: String(x.doc_hash) }));
}
async function inhaltVon(ref: string, id: number): Promise<Buffer | null> {
  const [d] = (await sqlPool`SELECT inhalt FROM fiaon_global_dokumente WHERE id = ${id} AND ref = ${ref} AND geloescht_am IS NULL LIMIT 1`) as any[];
  return d?.inhalt ? Buffer.from(d.inhalt) : null;
}
/** Die Fassung, die ein Unterzeichner jetzt sieht: die jüngste unterschriebene Zwischenfassung — sonst das Original. */
async function ansichtVon(ref: string, original: DokZeile): Promise<{ id: number; sha256: string }> {
  const f = (await fassungenVon(ref, original.id))[0];
  return f ? { id: f.id, sha256: f.doc_hash } : { id: original.id, sha256: String(original.doc_hash) };
}

// ── SETZEN ───────────────────────────────────────────────────────────────────
/** Das Dokument als PDF: Satz (Ergänzung, SoO, OA) oder IRS-Formular. */
async function pdfFuer(art: FormularArt, k: FormularKontext, docId: string, o: { signaturen?: Map<number, Signatur>; am: Date }): Promise<Buffer> {
  if (istIrs(art)) {
    const { irsFuellen } = await import("./fiaon-global-irs");
    return (await irsFuellen(art, k, { am: o.am })).pdf;
  }
  const d = satzDokument(art, k, docId) as SatzDokument;
  return Buffer.from(await satzPdf(d, { signaturen: o.signaturen, erzeugtAm: o.am }));
}

/** Die Seite „Signature Certificate“ (US-Satz, eigene Seitenzählung). */
async function zertifikatPdf(akte: SignaturAkte, ref: string, am: Date): Promise<Uint8Array> {
  const z = zertifikatZeilen(akte, ref);
  const bloecke: SatzDokument["bloecke"] = [
    { art: "titel", text: "SIGNATURE CERTIFICATE" },
    { art: "untertitel", text: "Electronic signatures executed in the FIAON client portal" },
    { art: "tabelle", zeilen: z.kopf, klein: true },
  ];
  z.je.forEach((zeilen, i) => { bloecke.push({ art: "kopf", text: `SIGNATURE ${i + 1}` }); bloecke.push({ art: "tabelle", zeilen, klein: true }); });
  bloecke.push({ art: "abstand", pt: 6 });
  for (const f of z.fuss) bloecke.push({ art: "absatz", klein: true, text: f });
  return satzPdf({ stil: "us", sprache: "en", titel: "Signature Certificate", fuss: `Doc-ID: ${akte.docId} · Signature Certificate`, bloecke }, { erzeugtAm: am, stempelfeld: false });
}

/** Für ein hochgeladenes PDF ohne eigenen Satz: Originalseiten + Unterschriftsblatt. */
async function fremdMitUnterschrift(original: Buffer, titel: string, akte: SignaturAkte, k: FormularKontext | null, am: Date): Promise<Uint8Array> {
  const s = akte.signaturen[akte.signaturen.length - 1];
  const blatt = await satzPdf({
    stil: "ci", sprache: k?.sprache ?? "de", titel: k?.sprache === "en" ? "Signature page" : "Unterschriftsblatt",
    fuss: `FIAON Global · Doc-ID ${akte.docId}`,
    bloecke: [
      { art: "absatz", text: k?.sprache === "en" ? `This page forms part of “${titel}” (SHA-256 of the document as presented: ${s.dokumentSha256}).` : `Dieses Blatt gehört zu „${titel}“ (SHA-256 des vorgelegten Dokuments: ${s.dokumentSha256}).` },
      { art: "unterschrift", nr: 1, zeilen: [s.erwartet, s.rolle] },
    ],
  }, { signaturen: new Map([[1, { name: s.name, am: s.unterschriebenAm, docId: akte.docId }]]), erzeugtAm: am, stempelfeld: false });
  return anhaengen(original, blatt, titel, am);
}

/** Versiegeln, wenn ein Schlüssel da ist — sonst „ausstehend“ (nie ein Fehler für den Unterzeichner). */
async function versiegeln(pdf: Uint8Array, titel: string, am: Date): Promise<{ pdf: Buffer; siegel: NonNullable<SignaturAkte["siegel"]> }> {
  const { siegelSchluessel, pdfVersiegeln } = await import("./fiaon-global-siegel");
  const s = siegelSchluessel();
  if ("fehlt" in s) return { pdf: Buffer.from(pdf), siegel: { status: "ausstehend", grund: s.fehlt } };
  try {
    return { pdf: await pdfVersiegeln(pdf, s, { grund: `Electronically signed via FIAON — ${titel}`, am }), siegel: { status: "versiegelt", am: am.toISOString(), zertifikat: s.subjekt } };
  } catch (e) {
    console.error("[GLOBAL-UNTERSCHRIFT] Siegel fehlgeschlagen — Prüfsumme bleibt:", e);
    return { pdf: Buffer.from(pdf), siegel: { status: "ausstehend", grund: `Siegel fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` } };
  }
}

// ── TEAM: ANGABEN ────────────────────────────────────────────────────────────
const zahl = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
/** Die Angaben des Teams prüfen und speichern (überschreibt nur, was mitkommt). */
export async function formularAngabenSpeichern(ref: string, ein: Record<string, any>, agent: { id: number; name: string }): Promise<Erg<{ meldung: string; angaben: FormularAngaben }>> {
  const k = await formularKontext(ref);
  if (!k) return nein(404, "Diesen Auftrag gibt es nicht.");
  const alt = k.angaben;
  const neu: FormularAngaben = { ...alt };
  if (Array.isArray(ein.mitglieder)) {
    const m: Mitglied[] = ein.mitglieder.slice(0, 10).map((x: any) => ({ name: knapp(x?.name, 160), anschrift: knapp(x?.anschrift, 300), anteil: zahl(x?.anteil), email: knapp(x?.email, 200).toLowerCase() || null, telefon: knapp(x?.telefon, 40) || null })).filter((x: Mitglied) => x.name);
    for (const x of m) if (x.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x.email)) return nein(400, `E-Mail von ${x.name} ist ungültig.`);
    neu.mitglieder = m.length ? m : null;
  }
  if (ein.verwaltung !== undefined) neu.verwaltung = ein.verwaltung === "manager" ? "manager" : "member";
  if (ein.manager !== undefined) neu.manager = knapp(ein.manager, 160) || null;
  if (ein.organizer !== undefined) {
    const o = ein.organizer ?? {};
    neu.organizer = { name: knapp(o.name, 160) || null, beschreibung: knapp(o.beschreibung, 300) || null, vertreter: knapp(o.vertreter, 120) || null, titel: knapp(o.titel, 80) || null, istFiaon: o.istFiaon !== false };
  }
  for (const f of ["county", "zweck", "einlage", "nachfolger"] as const) if (ein[f] !== undefined) (neu as any)[f] = knapp(ein[f], f === "county" ? 80 : 600) || null;
  if (ein.ss4 && typeof ein.ss4 === "object") {
    const s = ein.ss4;
    if (s.taetigkeit && !SS4_TAETIGKEITEN.some((t) => t.key === s.taetigkeit)) return nein(400, "Diese Haupttätigkeit (SS-4 Zeile 16) gibt es nicht.");
    neu.ss4 = { ...(alt.ss4 ?? {}), ...Object.fromEntries(["geschaeftsart", "taetigkeit", "taetigkeitText", "leistungen", "designeeName", "designeeAdresse", "designeeTelefon", "designeeFax"]
      .filter((key) => s[key] !== undefined).map((key) => [key, knapp(s[key], 200) || null])) };
  }
  if (ein.irs8821 && typeof ein.irs8821 === "object") {
    const s = ein.irs8821;
    neu.irs8821 = { ...(alt.irs8821 ?? {}), ...(s.aktiv !== undefined ? { aktiv: s.aktiv !== false } : {}),
      ...Object.fromEntries(["name", "adresse", "caf", "ptin", "telefon", "fax", "steuerart", "formular", "jahre", "sachverhalt"].filter((key) => s[key] !== undefined).map((key) => [key, knapp(s[key], 300) || null])) };
  }
  // Wortregel E-422: der Name des Registered-Agent-Anbieters steht in keinem Kundendokument.
  const { globalWortPruefen } = await import("@shared/fiaon-global-wortregeln");
  const wort = globalWortPruefen(JSON.stringify(neu)).find((f) => f.quelle === "global" && /Registered-Agent|bis zu|Bankname/i.test(f.hinweis));
  if (wort) return nein(400, `Bitte anders formulieren: „${wort.treffer}“ — ${wort.hinweis}.`);
  await sqlPool`UPDATE fiaon_global_auftraege SET formular_angaben = ${sqlPool.json(neu as any)}, updated_at = NOW() WHERE ref = ${ref}`;
  const { verlaufSchreiben } = await import("./fiaon-global-bereich");
  await verlaufSchreiben(ref, { art: "formular_angaben", text: `Angaben für die Dokumente zur Unterschrift geändert (${agent.name}).`, sichtbar: false, agentId: agent.id || null });
  return { ok: true, meldung: "Angaben gespeichert. Erzeugte Dokumente mit alten Daten bitte neu erzeugen.", angaben: neu };
}

// ── TEAM: ÜBERSICHT ──────────────────────────────────────────────────────────
export type FormularStand = "nicht_noetig" | "unvollstaendig" | "bereit_zum_erzeugen" | "erzeugt" | "fiaon_unterschrieben" | "wartet" | "teilweise" | "unterschrieben" | "veraltet";
export interface FormularZeile {
  art: FormularArt; titel: string; modus: "digital" | "handschriftlich"; noetig: boolean; grund: string | null; stand: FormularStand;
  fehlend: Fehlend[]; hinweise: string[]; dokumentId: number | null; ansichtId: number | null; endfassungId: number | null;
  docId: string | null; erzeugtAm: string | null; signaturen: { name: string; rolle: string; am: string; art: string }[];
  offen: string[]; siegel: SignaturAkte["siegel"] | null; belegung?: IrsFeld[]; organizerIstFiaon?: boolean; datenGeaendert: boolean;
}
export async function formulareUebersicht(ref: string): Promise<{ zeilen: FormularZeile[]; angaben: FormularAngaben; kontext: Omit<FormularKontext, "itin" | "angaben"> } | null> {
  const k = await formularKontext(ref);
  if (!k) return null;
  const ergaenzung = await ergaenzungFuer(ref);
  const gegruendet = !!k.llc.gegruendetAm;
  const zeilen: FormularZeile[] = [];
  for (const art of FORMULAR_ARTEN) {
    const p = globalPflichtUnterlage(art);
    const modus = p?.modus ?? (istIrs(art) ? "handschriftlich" : "digital");
    let noetig = true; let grund: string | null = null;
    if (art === "fiaon_befugnisse" && !ergaenzung) { noetig = false; grund = "Der angenommene Vertrag enthält die Ziffer „Befugnisse von FIAON“ schon."; }
    if (art !== "fiaon_befugnisse" && !gegruendet) { noetig = false; grund = "Erst nach der Gründung (Gründungstag eintragen)."; }
    if (art === "irs_8821" && k.angaben.irs8821?.aktiv === false) { noetig = false; grund = "Für dieses Mandat abgeschaltet."; }
    const o = await originalVon(ref, art);
    if (o) noetig = true;
    const fehlend = istIrs(art) ? irsBelegung(art, { ...k, itin: null }, { fax: process.env.FIAON_GLOBAL_FAX ?? null }).fehlend : formularFehlend(art, k);
    const irs = istIrs(art) ? irsBelegung(art, { ...k, itin: null }, { fax: process.env.FIAON_GLOBAL_FAX ?? null }) : null;
    const fd = o ? json<any>(o.formular_daten, {}) : null;
    const akte = o ? json<SignaturAkte | null>(o.unterschrift_nachweis, null) : null;
    const sigs = akte?.art === "digital" ? akte.signaturen : [];
    const unterzeichner = unterzeichnerVon(art, k);
    const offen = istIrs(art) ? [] : unterzeichner.filter((u) => !sigs.some((s) => s.nr === u.nr)).map((u) => `${u.name} (${u.rolle})`);
    const fass = o ? await fassungenVon(ref, o.id) : [];
    const end = fass.find((f) => f.unterschrieben) ?? null;
    let stand: FormularStand;
    if (!noetig) stand = "nicht_noetig";
    else if (!o) stand = fehlend.length ? "unvollstaendig" : "bereit_zum_erzeugen";
    else if (o.unterschrieben_am) stand = "unterschrieben";
    else if (o.unterschrift_gefordert && o.sichtbar_fuer_kunde) stand = sigs.some((s) => s.art === "kunde") ? "teilweise" : "wartet";
    else if (sigs.some((s) => s.art === "fiaon")) stand = "fiaon_unterschrieben";
    else stand = "erzeugt";
    const geaendert = !!fd?.datenHash && !o?.unterschrieben_am && fd.datenHash !== schnappschuss(k).hash;
    zeilen.push({
      art, titel: TITEL[art].de, modus, noetig, grund, stand: geaendert && (stand === "erzeugt" || stand === "fiaon_unterschrieben" || stand === "wartet") ? "veraltet" : stand,
      fehlend, hinweise: irs?.hinweise ?? [], dokumentId: o?.id ?? null, ansichtId: o ? (fass[0]?.id ?? o.id) : null, endfassungId: end?.id ?? null,
      docId: fd?.docId ?? null, erzeugtAm: fd?.erzeugtAm ?? null,
      signaturen: sigs.map((s) => ({ name: s.name, rolle: s.rolle, am: s.unterschriebenAm, art: s.art })), offen, siegel: akte?.siegel ?? null,
      ...(irs ? { belegung: irs.felder } : {}), ...(art === "us_organizer" ? { organizerIstFiaon: k.angaben.organizer?.istFiaon !== false } : {}),
      datenGeaendert: geaendert,
    });
  }
  const { itin: _i, angaben, ...rest } = k;
  return { zeilen, angaben, kontext: rest };
}

/** Vorschau als PDF — auch unvollständig (Lücken bleiben sichtbar); nichts wird abgelegt. */
export async function formularVorschau(ref: string, artRoh: unknown): Promise<Erg<{ pdf: Buffer; dateiname: string }>> {
  const art = formularArt(artRoh);
  if (!art) return nein(404, "Dieses Dokument gibt es nicht.");
  const k = await formularKontext(ref, { mitItin: art === "irs_ss4" });
  if (!k) return nein(404, "Diesen Auftrag gibt es nicht.");
  try {
    const pdf = await pdfFuer(art, k, "FG-VORSCHAU", { am: new Date() });
    return { ok: true, pdf, dateiname: `${TITEL[art].datei}_Vorschau.pdf` };
  } catch (e) {
    console.error(`[GLOBAL-UNTERSCHRIFT] ${ref}: Vorschau ${art}:`, e);
    return nein(500, `Die Vorschau ließ sich nicht setzen: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── TEAM: ERZEUGEN ───────────────────────────────────────────────────────────
/** Erzeugt das Dokument aus den aktuellen Daten und legt es INTERN ab. Nur vollständig. Ersetzt eine noch nicht unterschriebene Fassung. */
export async function formularErzeugen(ref: string, artRoh: unknown, agent: { id: number; name: string }, o: { automatisch?: boolean } = {}): Promise<Erg<{ meldung: string; id: number }>> {
  const art = formularArt(artRoh);
  if (!art) return nein(404, "Dieses Dokument gibt es nicht.");
  const k = await formularKontext(ref, { mitItin: art === "irs_ss4" });
  if (!k) return nein(404, "Diesen Auftrag gibt es nicht.");
  const fehlend = istIrs(art) ? irsBelegung(art, k, { fax: process.env.FIAON_GLOBAL_FAX ?? null }).fehlend : formularFehlend(art, k);
  if (fehlend.length) return nein(409, `Noch nicht vollständig — es fehlt: ${fehlend.map((f) => f.text).join(" · ")}`, fehlend);
  const alt = await originalVon(ref, art);
  if (alt?.unterschrieben_am) return nein(409, "Dieses Dokument ist schon unterschrieben. Eine neue Fassung legt die Leitung nur bewusst an (altes Dokument im Tresor entfernen, dann neu erzeugen).");
  const altAkte = alt ? json<SignaturAkte | null>(alt.unterschrift_nachweis, null) : null;
  if (altAkte?.signaturen?.some((s) => s.art === "kunde")) return nein(409, "Der Kunde hat hier schon unterschrieben — eine neue Fassung bitte erst nach Rücksprache (altes Dokument im Tresor entfernen).");
  const am = new Date();
  const docId = docIdAus(randomBytes(4).toString("hex"));
  const pdf = await pdfFuer(art, k, docId, { am });
  const p = globalPflichtUnterlage(art)!;
  const { dokumentSpeichern, verlaufSchreiben } = await import("./fiaon-global-bereich");
  const titel = TITEL[art][k.sprache];
  const d = await dokumentSpeichern({ ref, von: "fiaon", art: p.art, dateiname: `${TITEL[art].datei}_${ref}.pdf`, mime: "application/pdf", inhalt: pdf, sichtbar: false, agentId: agent.id || null });
  const snap = schnappschuss(k);
  const daten = { art, docId, fassung: US_DOKUMENTE_FASSUNG, kontext: snap.kontext, datenHash: snap.hash, erzeugtAm: am.toISOString(), erzeugtVon: agent.name, unterzeichner: unterzeichnerVon(art, k) };
  await sqlPool`
    UPDATE fiaon_global_dokumente SET titel = ${titel}, pflicht_key = ${art}, unterschrift_art = ${p.modus}, formular_daten = ${sqlPool.json(daten as any)},
           unterschrift_gefordert = FALSE, sichtbar_fuer_kunde = FALSE
     WHERE id = ${d.id} AND ref = ${ref}`;
  if (alt && alt.id !== d.id) {
    // Die alte, noch nicht unterschriebene Fassung (und ihre Zwischenfassungen) ausblenden — nie hart löschen.
    await sqlPool`UPDATE fiaon_global_dokumente SET geloescht_am = NOW() WHERE ref = ${ref} AND (id = ${alt.id} OR unterschrift_von_id = ${alt.id}) AND geloescht_am IS NULL`;
  }
  await verlaufSchreiben(ref, { art: "formular", text: `${titel} ${alt ? "neu " : ""}erzeugt (Doc-ID ${docId}${o.automatisch ? ", automatisch" : `, ${agent.name}`}).`, sichtbar: false, agentId: agent.id || null });
  return { ok: true, id: d.id, meldung: alt ? "Neu erzeugt — die alte Fassung ist ausgeblendet. Bitte prüfen und zur Unterschrift bereitstellen." : "Erzeugt und intern abgelegt. Bitte prüfen und zur Unterschrift bereitstellen." };
}

// ── TEAM: FIAON UNTERSCHREIBT (Statement of Organizer) ───────────────────────
export async function formularFiaonUnterschreibt(ref: string, artRoh: unknown, agent: { id: number; name: string }, a: { ip: string; userAgent: string; bestaetigt: boolean }): Promise<Erg<{ meldung: string }>> {
  const art = formularArt(artRoh);
  if (art !== "us_organizer") return nein(400, "FIAON unterschreibt hier nur das Statement of Organizer.");
  if (!a.bestaetigt) return nein(400, "Bitte bestätigen, dass FIAON das Statement als Organizer unterschreibt.");
  const k = await formularKontext(ref);
  if (!k) return nein(404, "Diesen Auftrag gibt es nicht.");
  if (k.angaben.organizer?.istFiaon === false) return nein(409, "Organizer ist nicht FIAON — das Statement unterschreibt der Organizer selbst (von Hand, Scan in den Tresor).");
  const o = await originalVon(ref, art);
  if (!o) return nein(409, "Bitte zuerst das Statement of Organizer erzeugen.");
  const fd = json<any>(o.formular_daten, {});
  if (fd.datenHash !== schnappschuss(k).hash) return nein(409, "Die Daten haben sich seit dem Erzeugen geändert — bitte zuerst neu erzeugen.");
  const akte0 = json<SignaturAkte | null>(o.unterschrift_nachweis, null);
  if (akte0?.signaturen?.some((s) => s.art === "fiaon")) return nein(409, "FIAON hat schon unterschrieben.");
  const u = (fd.unterzeichner as any[]).find((x) => x.art === "fiaon");
  const ansicht = await ansichtVon(ref, o);
  const nachweis: UnterschriftNachweis = {
    nr: Number(u.nr), art: "fiaon", rolle: String(u.rolle), name: String(u.name), erwartet: String(u.name), methode: "team_sitzung", zugang: "team",
    kontoEmail: null, codeEmail: null, codeGesendetAm: null, codeBestaetigtAm: null, unterschriebenAm: new Date().toISOString(),
    ip: a.ip || null, userAgent: a.userAgent || null, dokumentSha256: ansicht.sha256, dokumentId: ansicht.id, zustimmung: null, mitarbeiter: agent.name,
  };
  const erg = await fassungSetzen(ref, o, art, fd, nachweis);
  const { verlaufSchreiben } = await import("./fiaon-global-bereich");
  await verlaufSchreiben(ref, { art: "unterschrift", text: `FIAON hat das Statement of Organizer als Organizer digital unterschrieben (${agent.name}).`, sichtbar: false, agentId: agent.id || null });
  return { ok: true, meldung: erg.vollstaendig ? "Unterschrieben." : "FIAON hat unterschrieben. Jetzt zur Unterschrift für das Mitglied bereitstellen." };
}

// ── TEAM: ZUR UNTERSCHRIFT BEREITSTELLEN ─────────────────────────────────────
export async function formularFreigeben(ref: string, artRoh: unknown, agent: { id: number; name: string }, o: { mitteilen?: boolean; automatisch?: boolean } = {}): Promise<Erg<{ meldung: string }>> {
  const art = formularArt(artRoh);
  if (!art) return nein(404, "Dieses Dokument gibt es nicht.");
  const k = await formularKontext(ref, { mitItin: art === "irs_ss4" });
  if (!k) return nein(404, "Diesen Auftrag gibt es nicht.");
  const d = await originalVon(ref, art);
  if (!d) return nein(409, "Bitte das Dokument zuerst erzeugen.");
  if (d.unterschrieben_am) return nein(409, "Schon unterschrieben.");
  const fehlend = istIrs(art) ? irsBelegung(art, k, { fax: process.env.FIAON_GLOBAL_FAX ?? null }).fehlend : formularFehlend(art, k);
  if (fehlend.length) return nein(409, `Noch nicht vollständig — es fehlt: ${fehlend.map((f) => f.text).join(" · ")}`, fehlend);
  const fd = json<any>(d.formular_daten, {});
  if (fd.datenHash && fd.datenHash !== schnappschuss(k).hash) return nein(409, "Die Daten haben sich seit dem Erzeugen geändert — bitte zuerst neu erzeugen, damit der Kunde die aktuelle Fassung bekommt.");
  if (art === "us_organizer" && k.angaben.organizer?.istFiaon !== false) {
    const akte = json<SignaturAkte | null>(d.unterschrift_nachweis, null);
    if (!akte?.signaturen?.some((s) => s.art === "fiaon")) return nein(409, "Erst unterschreibt FIAON als Organizer („FIAON unterschreibt“), dann das Mitglied.");
  }
  // Mitglieder ab dem zweiten brauchen eine eigene Adresse für den Code (formularFehlend prüft das bereits).
  const [z] = (await sqlPool`
    UPDATE fiaon_global_dokumente SET sichtbar_fuer_kunde = TRUE, unterschrift_gefordert = TRUE
     WHERE id = ${d.id} AND ref = ${ref} AND unterschrieben_am IS NULL RETURNING id`) as any[];
  if (!z) return nein(409, "Das Dokument hat sich gerade geändert — bitte neu laden.");
  // Die Zwischenfassung (z. B. mit der Unterschrift von FIAON) sieht der Kunde im Dialog; im Tresor steht das Original.
  const { verlaufSchreiben, lageLesen, bereichMail } = await import("./fiaon-global-bereich");
  const titel = TITEL[art][k.sprache];
  await verlaufSchreiben(ref, { art: "unterschrift_angefordert", text: k.sprache === "en" ? `Ready for your signature: ${titel}.` : `Zur Unterschrift bereitgestellt: ${titel}.`, sichtbar: true, agentId: agent.id || null });
  let mailSatz = "";
  if (o.mitteilen) {
    const l = await lageLesen(ref);
    const { escapeHtml } = await import("./fiaon-html-pdf");
    const mail = l ? await bereichMail("global_dokument", l, { dokument_art: escapeHtml(`${titel} (${k.sprache === "en" ? "for signature" : "zur Unterschrift"})`), dokument_name: escapeHtml(titel) }, agent.name) : { ok: false, grund: "Akte nicht lesbar" };
    mailSatz = mail.ok ? " Der Kunde ist per Mail informiert." : ` Die Mail ging NICHT raus (${mail.grund}).`;
  }
  return { ok: true, meldung: `Bereitgestellt — der Kunde sieht es unter „Für Sie zu tun“.${mailSatz}` };
}

// ── DIE ERGÄNZUNG LEGT SICH SELBST AN ────────────────────────────────────────
/**
 * Für Kunden mit älterer Vertragsfassung: Ergänzung erzeugen und bereitstellen — einmal, wiederholbar ohne Doppel.
 * Gerufen beim Laden des Portals und der Team-Übersicht. Fehlen Angaben, bleibt sie beim Team als „unvollständig“.
 */
export async function ergaenzungSicherstellen(ref: string): Promise<void> {
  try {
    await ensureUnterschrift();
    if (!(await ergaenzungFuer(ref))) return;
    const [st] = (await sqlPool`SELECT status FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
    if (!st || String(st.status) === "storniert") return;
    await sqlPool.begin(async (tx: any) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`global-befugnisse:${ref}`}))`;
      const [da] = (await tx`SELECT id FROM fiaon_global_dokumente WHERE ref = ${ref} AND pflicht_key = 'fiaon_befugnisse' AND geloescht_am IS NULL LIMIT 1`) as any[];
      if (da) return;
      const system = { id: 0, name: "System (Ergänzung Befugnisse)" };
      const e = await formularErzeugen(ref, "fiaon_befugnisse", system, { automatisch: true });
      if (e.ok) await formularFreigeben(ref, "fiaon_befugnisse", system, { automatisch: true });
    });
  } catch (e) { console.error(`[GLOBAL-UNTERSCHRIFT] ${ref}: Ergänzung nicht angelegt:`, e); }
}

// ── DIE FASSUNG MIT UNTERSCHRIFTEN ───────────────────────────────────────────
/** Neue unterschriebene Fassung setzen, ablegen, Nachweis ans Original. Gibt zurück, ob jetzt alle unterschrieben haben. */
async function fassungSetzen(ref: string, original: DokZeile, art: FormularArt | null, fd: any, neu: UnterschriftNachweis): Promise<{ vollstaendig: boolean; id: number; akte: SignaturAkte }> {
  const alt = json<SignaturAkte | null>(original.unterschrift_nachweis, null);
  const k: FormularKontext | null = fd?.kontext ?? null;
  const titel = String(original.titel || original.dateiname);
  const docId = String(fd?.docId || docIdAus(createHash("sha256").update(`${ref}:${original.id}`).digest("hex")));
  const signaturen = [...(alt?.art === "digital" ? alt.signaturen : []), neu];
  const unterzeichner: { nr: number; art: string }[] = fd?.unterzeichner ?? [{ nr: 1, art: "kunde" }];
  const vollstaendig = unterzeichner.every((u) => signaturen.some((s) => s.nr === u.nr));
  const am = new Date(neu.unterschriebenAm);
  const akte: SignaturAkte = { art: "digital", docId, formular: art, fassung: fd?.fassung ?? null, titel, signaturen, vollstaendig };
  // Inhalt: neu gesetzt mit allen Unterschriften (eigene Dokumente) — oder Original + Unterschriftsblatt (hochgeladene PDFs).
  let inhalt: Uint8Array;
  if (art && k && !istIrs(art)) {
    const sig = new Map<number, Signatur>(signaturen.map((s) => [s.nr, { name: s.name, am: s.unterschriebenAm, docId }]));
    inhalt = await pdfFuer(art, k, docId, { signaturen: sig, am });
  } else {
    const roh = await inhaltVon(ref, original.id);
    if (!roh) throw new Error("Original nicht lesbar");
    inhalt = await fremdMitUnterschrift(roh, titel, akte, k, am);
  }
  akte.sha256Inhalt = sha(inhalt);
  const mitZertifikat = await anhaengen(inhalt, await zertifikatPdf(akte, ref, am), titel, am);
  const v = await versiegeln(mitZertifikat, titel, am);
  akte.siegel = v.siegel;
  akte.sha256Datei = sha(v.pdf);
  const { dokumentSpeichern } = await import("./fiaon-global-bereich");
  const sprache = k?.sprache ?? "de";
  const basis = String(original.dateiname).replace(/\.pdf$/i, "");
  const kunde = neu.art === "kunde";
  const d = await dokumentSpeichern({ ref, von: kunde ? "kunde" : "fiaon", art: String(original.art || globalPflichtUnterlage(art)?.art || "sonstiges"), dateiname: `${basis}_${vollstaendig ? (sprache === "en" ? "signed" : "unterschrieben") : (sprache === "en" ? "signed_part" : "teilweise_unterschrieben")}.pdf`, mime: "application/pdf", inhalt: v.pdf, sichtbar: vollstaendig, agentId: null });
  akte.endfassungId = d.id;
  // Vorige Zwischenfassungen ausblenden (ihre Prüfsumme steht in den Signaturen).
  await sqlPool`UPDATE fiaon_global_dokumente SET geloescht_am = NOW() WHERE ref = ${ref} AND unterschrift_von_id = ${original.id} AND id <> ${d.id} AND geloescht_am IS NULL`;
  await sqlPool`
    UPDATE fiaon_global_dokumente SET titel = ${`${titel} — ${vollstaendig ? (sprache === "en" ? "signed" : "unterschrieben") : (sprache === "en" ? "partly signed" : "teilweise unterschrieben")}`},
           unterschrift_von_id = ${original.id}, unterschrift_art = 'digital', unterschrift_name = ${neu.name}, unterschrift_nachweis = ${sqlPool.json(akte as any)},
           unterschrieben_am = ${vollstaendig ? am : null}, kunde_gelesen_am = ${kunde ? am : null}, pflicht_key = NULL
     WHERE id = ${d.id} AND ref = ${ref}`;
  await sqlPool`
    UPDATE fiaon_global_dokumente SET unterschrift_nachweis = ${sqlPool.json(akte as any)}, unterschrift_name = ${neu.name}, unterschrift_ip = ${(neu.ip ?? "").slice(0, 64) || null},
           unterschrieben_am = CASE WHEN ${vollstaendig} THEN ${am} ELSE unterschrieben_am END
     WHERE id = ${original.id} AND ref = ${ref}`;
  return { vollstaendig, id: d.id, akte };
}

// ── KUNDE: STARTEN (Zustimmung + Name → Code) ────────────────────────────────
export interface ZutrittInfo { weg: "sitzung" | "token" | "vorschau"; kontoEmail: string | null }
async function kundenDokument(ref: string, idRoh: unknown): Promise<DokZeile | null> {
  const id = Number(idRoh);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [d] = (await sqlPool`
    SELECT id, art, pflicht_key, titel, dateiname, sichtbar_fuer_kunde, unterschrift_gefordert, unterschrieben_am, unterschrift_von_id, unterschrift_art,
           formular_daten, unterschrift_nachweis, created_at, doc_hash, mime
      FROM fiaon_global_dokumente WHERE id = ${id} AND ref = ${ref} AND geloescht_am IS NULL LIMIT 1`) as any[];
  return d && String(d.mime) === "application/pdf" ? { ...d, id: Number(d.id) } : null;
}
/** Wer noch unterschreiben muss (Kunden-Unterzeichner ohne Unterschrift). Hochgeladene PDFs: der Kunde der Akte. */
async function offeneKunden(ref: string, d: DokZeile): Promise<{ nr: number; name: string; rolle: string; email: string | null }[]> {
  const fd = json<any>(d.formular_daten, null);
  const akte = json<SignaturAkte | null>(d.unterschrift_nachweis, null);
  const sigs = akte?.art === "digital" ? akte.signaturen : [];
  if (fd?.unterzeichner) return (fd.unterzeichner as any[]).filter((u) => u.art === "kunde" && !sigs.some((s) => s.nr === u.nr)).map((u) => ({ nr: Number(u.nr), name: String(u.name), rolle: String(u.rolle), email: u.email ? String(u.email) : null }));
  const k = await formularKontext(ref);
  return sigs.length ? [] : [{ nr: 1, name: k?.kundeName ?? "", rolle: k?.sprache === "en" ? "Client" : "Auftraggeber", email: k?.kundeEmail || null }];
}

const codeTabelleSpalten = async () => ensureUnterschrift();
export async function unterschriftStarten(ref: string, idRoh: unknown, ein: { zustimmung?: unknown; name?: unknown; sprache?: unknown }, z: ZutrittInfo, a: { ip: string; userAgent: string }):
  Promise<Erg<{ vorgang: string; maske: string }>> {
  await codeTabelleSpalten();
  const k = await formularKontext(ref);
  if (!k) return nein(404, "Diesen Auftrag gibt es nicht.");
  const s = k.sprache; const W = UNTERSCHRIFT_WOERTER[s];
  if (z.weg === "vorschau") return nein(409, W.vorschau);
  const d = await kundenDokument(ref, idRoh);
  if (!d || !d.unterschrift_gefordert || !d.sichtbar_fuer_kunde || d.unterschrift_von_id) return nein(404, W.wartetNicht);
  // DIE WAND: IRS-Formulare nie digital — gleich, was die Seite schickt.
  if (!digitalErlaubt(d.pflicht_key) || d.unterschrift_art === "handschriftlich") return nein(409, W.nieDigital);
  if (d.unterschrieben_am) return nein(409, W.schonUnterschrieben);
  if (ein.zustimmung !== true) return nein(400, W.zustimmungFehlt);
  // Die Roboter-Wand des Hauses (AGENTS.md, 06.08.2026): eine Unterschrift von der Maschine selbst oder mit automatisierter
  // Browserkennung ist kein Nachweis — sie entsteht gar nicht erst.
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(a.ip, a.userAgent).roboter) return nein(403, W.wartetNicht);
  const offen = await offeneKunden(ref, d);
  const wer = offen.find((u) => namePasst(ein.name, u.name));
  if (!wer) return nein(400, W.nameFalsch(offen.map((u) => u.name).join(s === "en" ? " or " : " oder ") || k.kundeName));
  // Wohin der Code geht: das angemeldete Konto — sonst die Adresse des Unterzeichners bzw. des Mandats.
  const erster = wer.nr === Math.min(...offen.map((u) => u.nr)) || !wer.email;
  const email = (z.weg === "sitzung" && z.kontoEmail && erster ? z.kontoEmail : (wer.email || k.kundeEmail || "")).trim().toLowerCase();
  if (!email) return nein(409, W.keineAdresse);
  const ansicht = await ansichtVon(ref, d);
  const R = await import("./fiaon-global-konto-regeln");
  const vorgang = R.kontoVorgangErzeugen(); const code = R.kontoCodeErzeugen();
  await sqlPool`UPDATE fiaon_global_unterschrift_codes SET verworfen_am = NOW() WHERE ref = ${ref} AND dokument_id = ${d.id} AND eingeloest_am IS NULL AND verworfen_am IS NULL`;
  await sqlPool`
    INSERT INTO fiaon_global_unterschrift_codes (ref, dokument_id, ansicht_id, ansicht_sha256, unterzeichner_nr, name, email, zugang, konto_email, sprache,
      zustimmung_fassung, zustimmung_sha256, vorgang_hash, code_hash, gueltig_bis, ip, user_agent)
    VALUES (${ref}, ${d.id}, ${ansicht.id}, ${ansicht.sha256}, ${wer.nr}, ${knapp(ein.name, 160)}, ${email}, ${z.weg === "sitzung" ? "sitzung" : "link"}, ${z.kontoEmail ?? null}, ${s},
      ${ESIGN_FASSUNG}, ${sha(zustimmungText(s))}, ${R.kontoVorgangHash(vorgang)}, ${R.kontoCodeHash(vorgang, code)}, ${R.kontoCodeGueltigBis()}, ${a.ip || null}, ${a.userAgent.slice(0, 300) || null})`;
  const mail = await codeMail(ref, k, email, wer.name, code, String(d.titel || d.dateiname));
  if (!mail.ok) return nein(502, W.mailFehler);
  return { ok: true, vorgang, maske: emailMaske(email) };
}

async function codeMail(ref: string, k: FormularKontext, email: string, name: string, code: string, titel: string, opts: { neu?: boolean } = {}): Promise<{ ok: boolean; grund: string | null }> {
  const { kontoMailSenden } = await import("./fiaon-global-konto");
  const { escapeHtml } = await import("./fiaon-html-pdf");
  const teile = name.split(/\s+/);
  const pseudo: any = { id: 0, email, name, anrede: null, nachname: teile[teile.length - 1], firma: k.firmaName || null, sprache: k.sprache };
  // „Code neu senden“ geht über beide Wege (Brevo und Google Workspace), sonst entscheidet die Adresse (E-441).
  const erg = await kontoMailSenden("global_unterschrift_code", pseudo, { login_code: code, dokument_titel: escapeHtml(titel) },
    { ausgeloestVon: `Kunde (Unterschrift ${ref}${opts.neu ? ", neuer Code" : ""})`, ...(opts.neu ? { weg: "beide" as const } : {}) });
  return erg;
}

export async function unterschriftCodeNeu(ref: string, idRoh: unknown, ein: { vorgang?: unknown }): Promise<Erg<{ meldung: string }>> {
  await codeTabelleSpalten();
  const k = await formularKontext(ref);
  if (!k) return nein(404, "Diesen Auftrag gibt es nicht.");
  const W = UNTERSCHRIFT_WOERTER[k.sprache];
  const R = await import("./fiaon-global-konto-regeln");
  const vorgang = String(ein.vorgang ?? "");
  if (!R.KONTO_VORGANG_MUSTER.test(vorgang)) return nein(400, W.codeVerbraucht);
  const [z] = (await sqlPool`SELECT * FROM fiaon_global_unterschrift_codes WHERE vorgang_hash = ${R.kontoVorgangHash(vorgang)} AND ref = ${ref} AND dokument_id = ${Number(idRoh)} LIMIT 1`) as any[];
  if (!z || z.eingeloest_am || z.verworfen_am) return nein(400, W.codeVerbraucht);
  const u = R.kontoCodeNeuUrteil(z.letzter_versand_am, Number(z.neu_gesendet || 0));
  if (u.genug) return nein(429, W.codeNeuGenug);
  if (!u.erlaubt) return nein(429, W.codeNeuWarten(u.warten));
  const code = R.kontoCodeErzeugen();
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_unterschrift_codes SET code_hash = ${R.kontoCodeHash(vorgang, code)}, gueltig_bis = ${R.kontoCodeGueltigBis()}, versuche = 0,
           neu_gesendet = neu_gesendet + 1, letzter_versand_am = NOW()
     WHERE id = ${z.id} AND eingeloest_am IS NULL AND neu_gesendet = ${Number(z.neu_gesendet || 0)} RETURNING id`) as any[];
  if (!frei) return nein(429, W.codeNeuWarten(60));
  const [d] = (await sqlPool`SELECT titel, dateiname FROM fiaon_global_dokumente WHERE id = ${Number(z.dokument_id)} LIMIT 1`) as any[];
  const mail = await codeMail(ref, k, String(z.email), String(z.name), code, String(d?.titel || d?.dateiname || ""), { neu: true });
  return mail.ok ? { ok: true, meldung: W.codeNeuOk } : nein(502, W.mailFehler);
}

// ── KUNDE: ABSCHLIESSEN (Code → Unterschrift) ────────────────────────────────
export async function unterschriftAbschliessen(ref: string, idRoh: unknown, ein: { vorgang?: unknown; code?: unknown }, z: ZutrittInfo, a: { ip: string; userAgent: string }):
  Promise<Erg<{ meldung: string; id: number; vollstaendig: boolean }>> {
  await codeTabelleSpalten();
  const k = await formularKontext(ref);
  if (!k) return nein(404, "Diesen Auftrag gibt es nicht.");
  const s = k.sprache; const W = UNTERSCHRIFT_WOERTER[s];
  if (z.weg === "vorschau") return nein(409, W.vorschau);
  const d = await kundenDokument(ref, idRoh);
  if (!d || !d.unterschrift_gefordert || !d.sichtbar_fuer_kunde || d.unterschrift_von_id) return nein(404, W.wartetNicht);
  if (!digitalErlaubt(d.pflicht_key) || d.unterschrift_art === "handschriftlich") return nein(409, W.nieDigital);
  if (d.unterschrieben_am) return nein(409, W.schonUnterschrieben);
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(a.ip, a.userAgent).roboter) return nein(403, W.wartetNicht);
  const R = await import("./fiaon-global-konto-regeln");
  const vorgang = String(ein.vorgang ?? "");
  if (!R.KONTO_VORGANG_MUSTER.test(vorgang)) return nein(400, W.codeVerbraucht);
  const [c] = (await sqlPool`SELECT * FROM fiaon_global_unterschrift_codes WHERE vorgang_hash = ${R.kontoVorgangHash(vorgang)} AND ref = ${ref} AND dokument_id = ${d.id} LIMIT 1`) as any[];
  if (!c) return nein(400, W.codeVerbraucht);
  const urteil = R.kontoCodeUrteil(c, vorgang, R.kontoCodeEingabe(ein.code));
  if (urteil.urteil === "verbraucht") return nein(400, W.codeVerbraucht);
  if (urteil.urteil === "abgelaufen") return nein(400, W.codeAbgelaufen);
  if (urteil.urteil !== "ok") {
    await sqlPool`UPDATE fiaon_global_unterschrift_codes SET versuche = versuche + 1, verworfen_am = CASE WHEN ${urteil.rest} <= 0 THEN NOW() ELSE verworfen_am END WHERE id = ${c.id} AND eingeloest_am IS NULL`;
    return nein(400, W.codeFalsch(urteil.rest));
  }
  const [frei] = (await sqlPool`UPDATE fiaon_global_unterschrift_codes SET eingeloest_am = NOW() WHERE id = ${c.id} AND eingeloest_am IS NULL AND verworfen_am IS NULL RETURNING eingeloest_am`) as any[];
  if (!frei) return nein(400, W.codeVerbraucht);
  // Hat sich die Fassung seit dem Code geändert (z. B. ein anderes Mitglied hat inzwischen unterschrieben)? Dann neu starten.
  const ansicht = await ansichtVon(ref, d);
  if (ansicht.id !== Number(c.ansicht_id) || ansicht.sha256 !== String(c.ansicht_sha256)) return nein(409, W.codeVerbraucht);
  const offen = await offeneKunden(ref, d);
  const wer = offen.find((u) => u.nr === Number(c.unterzeichner_nr));
  if (!wer) return nein(409, W.schonUnterschrieben);
  const nachweis: UnterschriftNachweis = {
    nr: wer.nr, art: "kunde", rolle: wer.rolle, name: String(c.name), erwartet: wer.name, methode: "email_code", zugang: c.zugang === "sitzung" ? "sitzung" : "link",
    kontoEmail: c.konto_email ? String(c.konto_email) : null, codeEmail: String(c.email),
    codeGesendetAm: new Date(c.letzter_versand_am).toISOString(), codeBestaetigtAm: new Date(frei.eingeloest_am).toISOString(), unterschriebenAm: new Date().toISOString(),
    ip: a.ip || null, userAgent: a.userAgent || null, dokumentSha256: ansicht.sha256, dokumentId: ansicht.id,
    zustimmung: { fassung: String(c.zustimmung_fassung), textSha256: String(c.zustimmung_sha256), sprache: c.sprache === "en" ? "en" : "de" },
  };
  const fd = json<any>(d.formular_daten, null);
  const art = formularArt(d.pflicht_key);
  let erg: { vollstaendig: boolean; id: number; akte: SignaturAkte };
  try { erg = await fassungSetzen(ref, d, art, fd, nachweis); }
  catch (e) {
    console.error(`[GLOBAL-UNTERSCHRIFT] ${ref}: Fassung ${d.id} nicht gesetzt:`, e);
    // Der Code ist verbraucht, die Unterschrift nicht gespeichert — der Kunde startet neu, nichts halb Gespeichertes bleibt.
    return nein(500, s === "en" ? "Your signature could not be saved just now. Please start again in a moment." : "Ihre Unterschrift konnte gerade nicht gespeichert werden. Bitte starten Sie gleich noch einmal.");
  }
  const titel = String(d.titel || d.dateiname);
  const { verlaufSchreiben, lageLesen } = await import("./fiaon-global-bereich");
  await verlaufSchreiben(ref, { art: "unterschrift", text: erg.vollstaendig ? W.verlauf(titel) : W.teilweise(titel, nachweis.name), sichtbar: true, von: "kunde" });
  // Aufgabe ans Team: unterschrieben — prüfen und weiterverwenden (Bank, Tresor, Station).
  try {
    const l = await lageLesen(ref);
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const { globalAufgabenZiel } = await import("./fiaon-global-auftrag");
    await auftragFuerKunden({
      personId: l?.b?.person_id != null ? Number(l.b.person_id) : null, ref,
      titel: `${erg.vollstaendig ? "Digital unterschrieben" : "Teilweise unterschrieben"}: ${art ? TITEL[art].de : titel} — ${l?.akte?.firma_name || ref}`,
      text: `${nachweis.name} hat im Portal digital unterschrieben (Code an ${nachweis.codeEmail}). ${erg.vollstaendig ? "Alle Unterschriften liegen vor — die unterschriebene Fassung mit Zertifikat liegt im Tresor." : "Es fehlen noch weitere Unterschriften."} Siegel: ${erg.akte.siegel?.status === "versiegelt" ? "versiegelt" : `ausstehend (${erg.akte.siegel?.grund ?? "—"})`}.`,
      schluessel: `global:${ref}:signatur:${d.id}:${nachweis.nr}`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      // E-443 (28.10.2026): EIN Helfer für den Weg ins Chefbüro — wie Upload und Nachricht (shared/fiaon-global-wege.ts).
      link: globalChefMandatPfad(ref),
      // E-451 (28.10.2026): EINE Regel für das Ziel — die Zuständigkeit der Akte (globalAufgabenZiel).
      ...(await globalAufgabenZiel(l?.akte?.zustaendig_agent_id)),
      anlageText: "Digitale Unterschrift im Portal.",
    });
  } catch (e) { console.error(`[GLOBAL-UNTERSCHRIFT] ${ref}: Aufgabe nicht angelegt:`, e); }
  // Operating Agreement vollständig → Station „Operating Agreement unterschrieben“ erledigt.
  if (erg.vollstaendig && art === "us_operating_agreement") {
    await sqlPool`
      INSERT INTO fiaon_global_schritte (ref, schluessel, status, datum, geaendert_von, updated_at)
      VALUES (${ref}, 'operating_agreement', 'erledigt', ${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date())}, 'Portal (digitale Unterschrift)', NOW())
      ON CONFLICT (ref, schluessel) DO UPDATE SET status = 'erledigt', datum = COALESCE(fiaon_global_schritte.datum, EXCLUDED.datum), geaendert_von = EXCLUDED.geaendert_von, updated_at = NOW()`
      .then(() => verlaufSchreiben(ref, { art: "schritt", text: s === "en" ? "Done: operating agreement signed." : "Erledigt: Operating Agreement unterschrieben.", sichtbar: true }))
      .catch((e) => console.error(`[GLOBAL-UNTERSCHRIFT] ${ref}: Station OA:`, e));
  }
  return { ok: true, id: erg.id, vollstaendig: erg.vollstaendig, meldung: W.fertigText };
}

// ── KUNDE: WAS DIE SEITE ZUM UNTERSCHREIBEN BRAUCHT ──────────────────────────
/** Je wartendem digitalem Dokument: die Fassung zum Ansehen und die Namen, die noch unterschreiben. */
export async function unterschriftKundenSicht(ref: string): Promise<Record<string, { ansichtId: number; namen: string[] }>> {
  await ensureUnterschrift();
  const doks = (await sqlPool`
    SELECT id, art, pflicht_key, titel, dateiname, sichtbar_fuer_kunde, unterschrift_gefordert, unterschrieben_am, unterschrift_von_id, unterschrift_art,
           formular_daten, unterschrift_nachweis, created_at, doc_hash
      FROM fiaon_global_dokumente WHERE ref = ${ref} AND geloescht_am IS NULL AND unterschrift_gefordert AND sichtbar_fuer_kunde AND unterschrieben_am IS NULL AND unterschrift_von_id IS NULL`) as any[];
  const out: Record<string, { ansichtId: number; namen: string[] }> = {};
  for (const d0 of doks) {
    const d = { ...d0, id: Number(d0.id) } as DokZeile;
    if (!digitalErlaubt(d.pflicht_key) || d.unterschrift_art === "handschriftlich") continue;
    out[String(d.id)] = { ansichtId: (await ansichtVon(ref, d)).id, namen: (await offeneKunden(ref, d)).map((u) => u.name) };
  }
  return out;
}
/** Die Fassung zum Ansehen (inkl. Zwischenfassung mit der Unterschrift von FIAON) — nur zu einem wartenden Dokument. */
export async function unterschriftAnsicht(ref: string, idRoh: unknown): Promise<{ inhalt: Buffer; dateiname: string } | null> {
  const d = await kundenDokument(ref, idRoh);
  if (!d || !d.sichtbar_fuer_kunde || d.unterschrift_von_id) return null;
  const a = await ansichtVon(ref, d);
  const inhalt = await inhaltVon(ref, a.id);
  return inhalt ? { inhalt, dateiname: String(d.dateiname) } : null;
}

// ── TEAM: PRÜFEN ─────────────────────────────────────────────────────────────
export async function unterschriftPruefen(ref: string, idRoh: unknown): Promise<Erg<{ pruefung: Record<string, unknown> }>> {
  await ensureUnterschrift();
  const id = Number(idRoh);
  const [d] = Number.isInteger(id) && id > 0 ? ((await sqlPool`
    SELECT id, inhalt, doc_hash, titel, unterschrift_nachweis, unterschrift_von_id FROM fiaon_global_dokumente WHERE id = ${id} AND ref = ${ref} LIMIT 1`) as any[]) : [];
  if (!d) return nein(404, "Dieses Dokument gibt es nicht.");
  const akte = json<SignaturAkte | null>(d.unterschrift_nachweis, null);
  if (!akte || akte.art !== "digital") return nein(409, "Zu diesem Dokument gibt es keinen digitalen Unterschriftsnachweis.");
  // Geprüft wird immer die Endfassung (auch wenn das Original angefragt wird).
  const endId = akte.endfassungId ?? id;
  const [e] = (await sqlPool`SELECT inhalt FROM fiaon_global_dokumente WHERE id = ${endId} AND ref = ${ref} LIMIT 1`) as any[];
  if (!e?.inhalt) return nein(404, "Die unterschriebene Fassung ist nicht lesbar.");
  const datei = Buffer.from(e.inhalt);
  const neuHash = sha(datei);
  const { pdfSiegelPruefen } = await import("./fiaon-global-siegel");
  const siegel = pdfSiegelPruefen(datei);
  let seiten = 0; try { seiten = (await PDFDocument.load(datei, { ignoreEncryption: true })).getPageCount(); } catch { /* Seitenzahl ist nur Beiwerk */ }
  return {
    ok: true,
    pruefung: {
      dokumentId: endId, titel: akte.titel, docId: akte.docId, seiten,
      sha256Gespeichert: akte.sha256Datei ?? null, sha256Jetzt: neuHash, unveraendert: !!akte.sha256Datei && akte.sha256Datei === neuHash,
      siegel: { ...siegel, status: akte.siegel?.status ?? null, zertifikat: akte.siegel?.zertifikat ?? null, grundAusstehend: akte.siegel?.grund ?? null },
      signaturen: akte.signaturen.map((s) => ({ name: s.name, rolle: s.rolle, art: s.art, methode: s.methode, codeEmail: s.codeEmail, am: s.unterschriebenAm, ip: s.ip, dokumentSha256: s.dokumentSha256 })),
      vollstaendig: !!akte.vollstaendig,
    },
  };
}
