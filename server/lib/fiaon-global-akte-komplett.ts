// ═══════════════════════════════════════════════════════════════════════════
// DIE VOLLSTÄNDIGE AKTE — Server (22.10.2026)
//
// Justin: „Denk an jedes Detail." Kundenportal, Chefbüro und Office zeigen die
// GANZE Akte eines Global-Kunden — Regeln in shared/fiaon-global-akte.ts:
//
//   Rechnungen   jede Bestellzeile derselben Person (person_id, sonst E-Mail), die
//                zur Global-Welt gehört (Paket, Angebotsteile, Zusatzdienste,
//                LLC-Gründung, Fast-Track …) — nie die Privat-Linie, nie die
//                Kooperation. PDF über den einen Renderer (rechnungAlsPdf).
//   Verträge     der Vertrag des Auftrags und jedes angenommene Angebot der Person.
//   Unterschrift die amtlichen Formulare nach der Gründung (IRS SS-4, IRS 8821) und
//                jedes Dokument, das das Team „zur Unterschrift“ stellt — mit
//                Vollständigkeit je Mandat (fiaon_global_dokumente.pflicht_key,
//                unterschrieben_am, unterschrift_nachweis JSONB für die spätere
//                E-SIGN-Scheibe). Keine eigene Vollmacht (rechtliche Prüfung 22.10.).
//   ZIP          „Alle Unterlagen herunterladen“: Kunde = seine Unterlagen, Team =
//                die ganze Akte; gestreamt (archiver), mit Inhaltsverzeichnis als
//                PDF, jeder Abruf steht intern im Verlauf.
//
// Zugriff prüfen die Routen (Token, Chefbüro, Office-Zuständigkeit); hier wird
// jede Datei zusätzlich an DIESES Mandat gebunden — eine fremde Rechnung oder ein
// fremder Vertrag ist über eine erratene Nummer nicht zu holen.
// ═══════════════════════════════════════════════════════════════════════════
import type { Response } from "express";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { sqlPool } from "./db-pool";
import {
  AKTE_ORDNER, AKTE_STATUS_TEXT, akteDateiname, akteEindeutig, globalAkteRechnungArt, globalAkteRechnungGehoertDazu, globalAkteRechnungStatus,
  globalAkteRechnungTitel, globalPflichtFuer, globalPflichtStand, globalPflichtUnterlage, begleitAkteAnker, begleitAkteDaten, type AkteSprache,
  HANDSCHRIFT_WOERTER, istBildInhalt, istPdfInhalt, unterschriftModus, type UnterschriftModus,
} from "@shared/fiaon-global-akte";
import { createHash } from "node:crypto";
import { globalChefMandatPfad } from "@shared/fiaon-global-wege";

type Fuer = "kunde" | "team";
const iso = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
const nein = (status: number, error: string) => ({ ok: false as const, status, error });
const cents = (eur: unknown) => Math.round(Number(eur ?? 0) * 100);

// ── SCHEMA: pflicht_key + unterschrift_nachweis am Dokument (Migration 124) ──
let bereit: Promise<void> | null = null;
export function ensureAkteKomplett(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const { ensureGlobalMandat } = await import("./fiaon-global-mandat");
      await ensureGlobalMandat();
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_global_dokumente ADD COLUMN IF NOT EXISTS pflicht_key TEXT, ADD COLUMN IF NOT EXISTS unterschrift_nachweis JSONB, ADD COLUMN IF NOT EXISTS unterschrift_art TEXT`;
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

interface Mandat { ref: string; personId: number | null; email: string | null; sprache: AkteSprache; fassung: string | null; name: string; gesellschaft: string; vertrag: boolean; gegruendet: boolean; angebotId: number | null }
async function mandatLesen(ref: string): Promise<Mandat | null> {
  await ensureAkteKomplett();
  const [g] = (await sqlPool`
    SELECT g.ref, g.person_id, g.email, g.vertrag_sprache, g.ansprechpartner, g.gesellschaft, g.firma_name, (g.vertrag_pdf IS NOT NULL) AS hat_vertrag, a.fassung, g.angebot_id
      FROM fiaon_global_auftraege g LEFT JOIN fiaon_global_angebote a ON a.id = g.angebot_id
     WHERE g.ref = ${ref} LIMIT 1`) as any[];
  if (!g) return null;
  const ap = typeof g.ansprechpartner === "object" && g.ansprechpartner ? g.ansprechpartner : {};
  const ges = typeof g.gesellschaft === "object" && g.gesellschaft ? g.gesellschaft : {};
  return {
    ref: String(g.ref), personId: g.person_id != null ? Number(g.person_id) : null, email: g.email ? String(g.email).trim().toLowerCase() : null,
    sprache: String(g.vertrag_sprache ?? "").toLowerCase() === "en" ? "en" : "de", fassung: g.fassung ? String(g.fassung) : null,
    name: [ap.vorname, ap.nachname].filter(Boolean).join(" ").trim() || String(ap.name ?? g.firma_name ?? "").trim(),
    gesellschaft: String(ges.name ?? g.firma_name ?? "").trim(), vertrag: !!g.hat_vertrag, gegruendet: !!ges.gegruendetAm,
    angebotId: g.angebot_id != null ? Number(g.angebot_id) : null,
  };
}

// ── 1 RECHNUNGEN ─────────────────────────────────────────────────────────────
interface RechnungZeile { bestellRef: string; nummer: string | null; datum: string | null; betragCents: number; status: string; art: string; titel: string; zahlungsReferenz: string | null; zahlungOffen: boolean }
async function rechnungenRoh(m: Mandat): Promise<RechnungZeile[]> {
  if (!m.personId && !m.email) return [];
  const zeilen = (await sqlPool`
    SELECT ref, pack_key, pack_name, invoice_number, invoice_date, created_at, amount_due, payment_status, payment_reference, cancelled_at, refunded_at
      FROM fiaon_applications
     WHERE merged_into IS NULL AND archived_at IS NULL
       AND (${m.personId}::int IS NOT NULL AND person_id = ${m.personId}::int
            OR ${m.email}::text IS NOT NULL AND lower(trim(email)) = ${m.email}::text)
       -- Nur Rechnungen MIT Nummer: rechnungAlsPdf vergibt sonst beim ersten Abruf eine neue Nummer (Lücken, Nummern für Stornos).
       AND invoice_number IS NOT NULL
     ORDER BY COALESCE(invoice_date, created_at) DESC, ref DESC`) as any[];
  return zeilen.filter((z) => globalAkteRechnungGehoertDazu(z.pack_key)).map((z) => {
    const status = globalAkteRechnungStatus(z.payment_status, z.cancelled_at, z.refunded_at);
    return {
      bestellRef: String(z.ref), nummer: z.invoice_number ? String(z.invoice_number) : null,
      datum: iso(z.invoice_date ?? z.created_at), betragCents: cents(z.amount_due), status, art: globalAkteRechnungArt(z.pack_key),
      titel: globalAkteRechnungTitel(z.pack_key, z.pack_name, m.sprache), zahlungsReferenz: z.payment_reference ? String(z.payment_reference) : null,
      zahlungOffen: status === "offen" && !!z.payment_reference && ["pending_payment", "claimed_paid", "pending"].includes(String(z.payment_status)),
    };
  });
}
/** Die Rechnungen für eine Anzeige. `pdfUrl` baut der Aufrufer (Token- bzw. Sitzungsweg). */
export async function globalAkteRechnungen(ref: string, pdfUrl: (bestellRef: string) => string): Promise<Record<string, unknown>[]> {
  const m = await mandatLesen(ref);
  if (!m) return [];
  return (await rechnungenRoh(m)).map((r) => ({
    bestellRef: r.bestellRef, nummer: r.nummer, datum: r.datum, betragCents: r.betragCents, status: r.status, art: r.art, titel: r.titel,
    statusText: AKTE_STATUS_TEXT[r.status as keyof typeof AKTE_STATUS_TEXT][m.sprache],
    pdfUrl: r.zahlungsReferenz ? pdfUrl(r.bestellRef) : null,
    zahlungsseite: r.zahlungOffen ? `/zahlung/${encodeURIComponent(String(r.zahlungsReferenz))}?bereich=business` : null,
  }));
}
/** Das PDF einer Rechnung — nur, wenn sie zu DIESEM Mandat gehört (dieselbe Prüfung wie die Liste). */
export async function globalAkteRechnungPdf(ref: string, bestellRef: string): Promise<{ pdf: Buffer; dateiname: string } | null> {
  const m = await mandatLesen(ref);
  if (!m) return null;
  const r = (await rechnungenRoh(m)).find((x) => x.bestellRef === bestellRef);
  if (!r?.zahlungsReferenz || !r.nummer) return null;
  const { rechnungAlsPdf } = await import("./fiaon-rechnung-pdf");
  const pdf = await rechnungAlsPdf(r.zahlungsReferenz);
  return pdf ? { pdf: pdf.pdf, dateiname: pdf.dateiname } : null;
}

// ── 2 VERTRÄGE ───────────────────────────────────────────────────────────────
const VERTRAG_NAME: [RegExp, string][] = [[/^IA-FIRMA/, "Firmenvereinbarung"], [/^IA-BEGLEIT/, "Begleitvertrag"], [/^IA-KAPITAL/, "Kapital-Vereinbarung"], [/^IA-KOOP/, "Kooperationsvertrag"]];
async function angeboteRoh(m: Mandat): Promise<{ id: number; angebotRef: string; fassung: string; angenommenAm: string | null }[]> {
  const zeilen = (await sqlPool`
    SELECT id, angebot_ref, fassung, angenommen_am FROM fiaon_global_angebote
     WHERE status = 'angenommen' AND vertrag_pdf IS NOT NULL
       AND (auftrag_ref = ${m.ref} OR (${m.personId}::int IS NOT NULL AND person_id = ${m.personId}::int))
     ORDER BY angenommen_am ASC NULLS LAST, id ASC`) as any[];
  // Kooperationsverträge gehören zum Geschäftspartner, nicht zur Kundenakte (E-423).
  // Das Angebot der Akte selbst steht schon als „Ihr Auftrag (Vertrag)“ da (dasselbe PDF) — nicht doppelt.
  return zeilen.filter((z) => !/^IA-KOOP/i.test(String(z.fassung ?? "")) && !(m.vertrag && m.angebotId === Number(z.id))).map((z) => ({ id: Number(z.id), angebotRef: String(z.angebot_ref), fassung: String(z.fassung ?? ""), angenommenAm: iso(z.angenommen_am) }));
}
export async function globalAkteVertraege(ref: string, url: (art: "auftrag" | number) => string): Promise<Record<string, unknown>[]> {
  const m = await mandatLesen(ref);
  if (!m) return [];
  const liste: Record<string, unknown>[] = [];
  if (m.vertrag) liste.push({ key: "auftrag", titel: m.sprache === "en" ? "Your order (contract)" : "Ihr Auftrag (Vertrag)", unter: m.ref, url: url("auftrag") });
  for (const a of await angeboteRoh(m)) {
    const name = VERTRAG_NAME.find(([re]) => re.test(a.fassung.toUpperCase()))?.[1] ?? (m.sprache === "en" ? "Individual agreement" : "Individualvereinbarung");
    liste.push({ key: `angebot-${a.id}`, titel: name, unter: [a.angebotRef, a.angenommenAm ? new Date(a.angenommenAm).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : ""].filter(Boolean).join(" · "), url: url(a.id) });
  }
  return liste;
}
export async function globalAkteVertragPdf(ref: string, art: "auftrag" | number): Promise<{ pdf: Buffer; dateiname: string } | null> {
  const m = await mandatLesen(ref);
  if (!m) return null;
  if (art === "auftrag") {
    const { globalVertragPdfLesen } = await import("./fiaon-global-auftrag");
    const pdf = await globalVertragPdfLesen(ref);
    return pdf ? { pdf, dateiname: `FIAON_Global_Vertrag_${ref}.pdf` } : null;
  }
  const a = (await angeboteRoh(m)).find((x) => x.id === art);
  if (!a) return null;
  const [z] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${a.id} LIMIT 1`) as any[];
  if (!z?.vertrag_pdf) return null;
  const name = VERTRAG_NAME.find(([re]) => re.test(a.fassung.toUpperCase()))?.[1] ?? "Vereinbarung";
  return { pdf: Buffer.from(z.vertrag_pdf), dateiname: `FIAON_Global_${name}_${a.angebotRef}.pdf` };
}

// ── 3 DOKUMENTE ZUR UNTERSCHRIFT ─────────────────────────────────────────────
/** Der Stand je Formular und je Dokument „zur Unterschrift“. Der Kunde sieht nur, was ihn betrifft (Formulare erst nach der Gründung). */
export async function globalPflichtSicht(ref: string, fuer: Fuer): Promise<Record<string, unknown> | null> {
  const m = await mandatLesen(ref);
  if (!m) return null;
  const doks = (await sqlPool`
    SELECT id, pflicht_key, titel, dateiname, unterschrift_gefordert, unterschrieben_am, sichtbar_fuer_kunde, unterschrift_von_id, unterschrift_art
      FROM fiaon_global_dokumente WHERE ref = ${ref} AND geloescht_am IS NULL AND (pflicht_key IS NOT NULL OR unterschrift_gefordert)`) as any[];
  const modusVon = new Map(doks.map((d) => [Number(d.id), unterschriftModus(d.pflicht_key, d.unterschrift_art)]));
  // 22.10.2026: die Ergänzung „Befugnisse von FIAON“ nur für ältere Vertragsfassungen; das 8821 im Mandat abschaltbar.
  const U = await import("./fiaon-global-unterschrift");
  const [fa] = (await sqlPool`SELECT formular_angaben FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  const aus = fa?.formular_angaben?.irs8821?.aktiv === false ? ["irs_8821"] : [];
  const liste = globalPflichtFuer(m.fassung, { gegruendet: m.gegruendet, bereit: doks.map((d) => String(d.pflicht_key ?? "")).filter(Boolean), ergaenzung: await U.ergaenzungFuer(ref).catch(() => false), aus });
  const stand = globalPflichtStand(liste, doks
    .filter((d) => fuer === "team" || d.sichtbar_fuer_kunde)
    .map((d) => ({
      id: Number(d.id), pflichtKey: d.pflicht_key ? String(d.pflicht_key) : null, unterschriftGefordert: !!d.unterschrift_gefordert,
      unterschrieben: !!d.unterschrieben_am, sichtbar: !!d.sichtbar_fuer_kunde, vonId: d.unterschrift_von_id != null ? Number(d.unterschrift_von_id) : null,
      titel: d.titel ? String(d.titel) : String(d.dateiname ?? ""),
    })));
  return {
    vollstaendig: stand.vollstaendig, offen: stand.offen, ...(fuer === "team" ? { gegruendet: m.gegruendet } : {}),
    eintraege: stand.eintraege.map((e) => {
      const p = globalPflichtUnterlage(e.key);
      return { key: e.key, titel: p ? p.titel[m.sprache] : (e.titel || (m.sprache === "en" ? "Document" : "Dokument")), text: p ? p.text[m.sprache] : "", art: p?.art ?? null, formular: !!p, stand: e.stand, dokumentId: e.dokumentId,
        modus: p ? p.modus : (e.dokumentId != null ? modusVon.get(e.dokumentId) ?? "digital" : "digital") };
    }),
  };
}

function sicher(font: PDFFont, s: string): string {
  // WinAnsi kennt nicht jedes Zeichen — was es nicht kennt, wird ersetzt statt abzustürzen.
  return Array.from(s.replace(/[→]/g, "->")).map((c) => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
}
/** Ein hochgeladenes Dokument einem Formular zuordnen (z. B. das ausgefüllte IRS-Formular 8821). */
export async function globalPflichtZuordnen(ref: string, dokumentId: number, keyRoh: unknown): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  await ensureAkteKomplett();
  const p = keyRoh ? globalPflichtUnterlage(keyRoh) : null;
  if (keyRoh && !p) return nein(400, "Dieses Formular gibt es nicht.");
  await sqlPool`UPDATE fiaon_global_dokumente SET pflicht_key = ${p?.key ?? null}, unterschrift_art = COALESCE(${p?.modus ?? null}, unterschrift_art) WHERE id = ${dokumentId} AND ref = ${ref}`;
  return { ok: true };
}

/**
 * Ein abgelegtes PDF zur Unterschrift stellen (Office-Weg; das Chefbüro kann das beim Hochladen selbst) und optional einer
 * Pflichtunterlage zuordnen — z. B. das Formular SS-4 an der Station EIN. Der Kunde sieht es unter „Für Sie zu tun“.
 */
export async function globalDokumentZurUnterschrift(ref: string, dokumentId: number, pflichtKeyRoh: unknown, agent: { id: number; name: string }, modusRoh?: unknown): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  await ensureAkteKomplett();
  const p = pflichtKeyRoh ? globalPflichtUnterlage(pflichtKeyRoh) : null;
  if (pflichtKeyRoh && !p) return nein(400, "Dieses Formular gibt es nicht.");
  const [d] = (await sqlPool`
    UPDATE fiaon_global_dokumente SET unterschrift_gefordert = TRUE, sichtbar_fuer_kunde = TRUE, pflicht_key = COALESCE(${p?.key ?? null}, pflicht_key),
           unterschrift_art = ${p ? p.modus : (String(modusRoh ?? "") === "handschriftlich" ? "handschriftlich" : "digital")}
     WHERE id = ${dokumentId} AND ref = ${ref} AND geloescht_am IS NULL AND mime = 'application/pdf' RETURNING titel, art, dateiname`) as any[];
  if (!d) return nein(400, "Eine Unterschrift lässt sich nur für ein PDF anfordern.");
  const m = await mandatLesen(ref);
  const { verlaufSchreiben } = await import("./fiaon-global-bereich");
  const titel = p ? p.titel[m?.sprache ?? "de"] : String(d.titel || d.dateiname);
  await verlaufSchreiben(ref, { art: "unterschrift_angefordert", text: m?.sprache === "en" ? `Ready for your signature: ${titel}.` : `Zur Unterschrift bereitgestellt: ${titel}.`, sichtbar: true, agentId: agent.id || null });
  return { ok: true };
}

// ── 4 DAS ZIP ────────────────────────────────────────────────────────────────
interface Eintrag { ordner: string; name: string; titel: string; laden: () => Promise<Buffer | null> }
async function eintraegeSammeln(ref: string, fuer: Fuer): Promise<Eintrag[]> {
  const m = await mandatLesen(ref);
  if (!m) return [];
  const liste: Eintrag[] = [];
  // Verträge
  if (m.vertrag) liste.push({ ordner: AKTE_ORDNER.vertraege, name: `Vertrag_${ref}.pdf`, titel: "Vertrag des Auftrags", laden: async () => (await globalAkteVertragPdf(ref, "auftrag"))?.pdf ?? null });
  for (const a of await angeboteRoh(m)) {
    liste.push({ ordner: AKTE_ORDNER.vertraege, name: `Vereinbarung_${a.angebotRef}.pdf`, titel: `Vereinbarung ${a.angebotRef}`, laden: async () => (await globalAkteVertragPdf(ref, a.id))?.pdf ?? null });
  }
  // Rechnungen
  for (const r of await rechnungenRoh(m)) {
    if (!r.zahlungsReferenz) continue;
    liste.push({ ordner: AKTE_ORDNER.rechnungen, name: `${r.nummer ?? r.bestellRef}_${r.titel}.pdf`, titel: `${r.nummer ?? r.bestellRef} · ${r.titel} · ${AKTE_STATUS_TEXT[r.status as keyof typeof AKTE_STATUS_TEXT].de}`, laden: async () => (await globalAkteRechnungPdf(ref, r.bestellRef))?.pdf ?? null });
  }
  // Tresor (Kunde: was er sieht; Team: alles), Vollmachten in eigenem Ordner
  const doks = (await sqlPool`
    SELECT id, art, titel, dateiname, sichtbar_fuer_kunde, von, pflicht_key, unterschrift_gefordert, unterschrift_von_id, unterschrieben_am, unterschrift_nachweis FROM fiaon_global_dokumente
     WHERE ref = ${ref} AND geloescht_am IS NULL ORDER BY created_at ASC, id ASC`) as any[];
  const { globalDokumentLesen } = await import("./fiaon-global-bereich");
  for (const d of doks) {
    if (fuer === "kunde" && !d.sichtbar_fuer_kunde && d.von !== "kunde") continue;
    const vollmacht = d.art === "vollmacht" || !!d.pflicht_key || !!d.unterschrift_gefordert || d.unterschrift_von_id != null;
    liste.push({
      ordner: vollmacht ? AKTE_ORDNER.vollmachten : AKTE_ORDNER.tresor, name: String(d.dateiname), titel: String(d.titel || d.dateiname),
      laden: async () => (await globalDokumentLesen(ref, d.id, fuer === "kunde" ? "kunde" : "office"))?.inhalt ?? null,
    });
    // 22.10.2026: zu jeder digital unterschriebenen Endfassung der Nachweis als Datei (das Zertifikat steht zusätzlich als
    // letzte Seite im PDF) — für das Team: Prüfsummen, Code-Zeitpunkte, IP, Gerät, Zustimmungsfassung.
    const akte = d.unterschrift_nachweis && typeof d.unterschrift_nachweis === "object" ? d.unterschrift_nachweis : null;
    if (fuer === "team" && d.unterschrift_von_id != null && akte?.art === "digital" && Number(akte.endfassungId) === Number(d.id)) {
      liste.push({ ordner: AKTE_ORDNER.vollmachten, name: `Nachweis_${String(akte.docId || d.id)}.json`, titel: `Nachweis der Unterschrift ${String(akte.docId || "")}`,
        laden: async () => Buffer.from(JSON.stringify(akte, null, 2), "utf8") });
    }
  }
  // Nachweise aus dem Angebot
  const { unterlagenFuerAuftrag, unterlageDateiFuerAuftrag } = await import("./fiaon-global-angebot-unterlagen");
  for (const u of await unterlagenFuerAuftrag(ref).catch(() => [])) {
    const endung = /pdf/.test(String(u.mime)) ? ".pdf" : /png/.test(String(u.mime)) ? ".png" : /heic/.test(String(u.mime)) ? ".heic" : ".jpg";
    liste.push({ ordner: AKTE_ORDNER.nachweise, name: `${u.titel}${endung}`, titel: String(u.titel), laden: async () => (await unterlageDateiFuerAuftrag(ref, Number(u.id)))?.daten ?? null });
  }
  return liste;
}

async function inhaltsverzeichnis(ref: string, fuer: Fuer, zeilen: { ordner: string; datei: string; titel: string }[], fehlend: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica); const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.07, 0.157, 0.29); const leise = rgb(0.42, 0.46, 0.53);
  let s = pdf.addPage([595.28, 841.89]); let y = 780;
  s.drawText("FIAON Global", { x: 56, y, size: 11, font: fett, color: navy }); y -= 36;
  s.drawText(sicher(fett, fuer === "kunde" ? "Ihre Unterlagen" : "Akte komplett"), { x: 56, y, size: 24, font: fett, color: navy }); y -= 20;
  const wann = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "short" }).format(new Date());
  s.drawText(sicher(font, `${ref} · Stand ${wann} · ${zeilen.length} Dateien`), { x: 56, y, size: 9.5, font, color: leise }); y -= 30;
  let ordner = "";
  for (const z of zeilen) {
    if (y < 70) { s = pdf.addPage([595.28, 841.89]); y = 790; }
    if (z.ordner !== ordner) { ordner = z.ordner; y -= 6; s.drawText(sicher(fett, ordner), { x: 56, y, size: 11, font: fett, color: navy }); y -= 18; }
    s.drawText(sicher(font, z.titel.slice(0, 90)), { x: 66, y, size: 9.5, font, color: rgb(0.1, 0.13, 0.2) }); y -= 12;
    s.drawText(sicher(font, z.datei.slice(0, 100)), { x: 66, y, size: 8, font, color: leise }); y -= 16;
  }
  if (fehlend.length) {
    if (y < 120) { s = pdf.addPage([595.28, 841.89]); y = 790; }
    y -= 10; s.drawText(sicher(fett, "Nicht lesbar (bitte beim Team nachfragen)"), { x: 56, y, size: 10, font: fett, color: rgb(0.71, 0.14, 0.09) }); y -= 16;
    for (const f of fehlend) { s.drawText(sicher(font, f.slice(0, 100)), { x: 66, y, size: 9, font, color: leise }); y -= 13; }
  }
  return Buffer.from(await pdf.save());
}

/**
 * „Alle Unterlagen herunterladen“: ein ZIP, gestreamt. Jede Datei wird einzeln geladen und sofort angehängt (nie die
 * ganze Akte im Speicher). Eine Datei, die sich nicht lesen lässt, bricht das ZIP nicht ab — sie steht im Verzeichnis.
 * `wer` steht intern im Verlauf (Kunde: „im Portal“). Antwortet selbst; der Aufrufer prüft vorher den Zugriff.
 */
export async function globalAkteZip(ref: string, fuer: Fuer, res: Response, wer: { name: string; agentId: number | null; vorschau?: boolean }): Promise<void> {
  const eintraege = await eintraegeSammeln(ref, fuer);
  if (!eintraege.length) { res.status(404).json({ ok: false, error: "Für diesen Auftrag liegen noch keine Unterlagen vor." }); return; }
  // archiver 8 (ESM): die Klasse ZipArchive — wie in fiaon-antrag.ts und fiaon-social.ts.
  const { ZipArchive } = await import("archiver");
  const zip = new ZipArchive({ zlib: { level: 6 } });
  const datum = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const dateiname = `FIAON_Global_${akteDateiname(ref)}_${fuer === "kunde" ? "Unterlagen" : "Akte"}_${datum}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${dateiname}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  zip.on("warning", (e: unknown) => console.error(`[GLOBAL-AKTE] ${ref}: ZIP-Warnung:`, e));
  zip.on("error", (e: unknown) => { console.error(`[GLOBAL-AKTE] ${ref}: ZIP abgebrochen:`, e); res.destroy(e as Error); });
  zip.pipe(res);
  const namen = new Map<string, Set<string>>();
  const verzeichnis: { ordner: string; datei: string; titel: string }[] = [];
  const fehlend: string[] = [];
  for (const e of eintraege) {
    let inhalt: Buffer | null = null;
    try { inhalt = await e.laden(); } catch (err) { console.error(`[GLOBAL-AKTE] ${ref}: ${e.name} nicht lesbar:`, err); }
    if (!inhalt) { fehlend.push(`${e.ordner} / ${e.titel}`); continue; }
    const set = namen.get(e.ordner) ?? new Set<string>(); namen.set(e.ordner, set);
    const datei = akteEindeutig(set, akteDateiname(e.name));
    zip.append(inhalt, { name: `${e.ordner}/${datei}` });
    verzeichnis.push({ ordner: e.ordner, datei, titel: e.titel });
  }
  zip.append(await inhaltsverzeichnis(ref, fuer, verzeichnis, fehlend), { name: "00 Inhaltsverzeichnis.pdf" });
  await zip.finalize();
  if (!wer.vorschau) {
    const { verlaufSchreiben } = await import("./fiaon-global-bereich");
    await verlaufSchreiben(ref, { art: "akte_zip", text: `${fuer === "kunde" ? "Kunde hat im Portal alle Unterlagen" : `Akte komplett (${wer.name})`} als ZIP heruntergeladen — ${verzeichnis.length} Dateien${fehlend.length ? `, ${fehlend.length} nicht lesbar` : ""}.`, sichtbar: false, agentId: wer.agentId });
  }
}

// ── 5 GLOBAL-AKTE FÜR EIN ANGENOMMENES BEGLEIT-ANGEBOT (Chef-Knopf, wiederholbar) ──
function jsonLesen(v: unknown): Record<string, any> {
  if (v && typeof v === "object" && !Buffer.isBuffer(v)) return v as Record<string, any>;
  try { const x = JSON.parse(String(v ?? "")); return (typeof x === "string" ? JSON.parse(x) : x) ?? {}; } catch { return {}; }
}
export async function globalBegleitAkteAnlegen(angebotId: number, agent: { id: number; name: string }): Promise<{ ok: true; ref: string; schon: boolean; meldung: string } | { ok: false; status: number; error: string }> {
  await ensureAkteKomplett();
  const [a] = (await sqlPool`
    SELECT id, angebot_ref, fassung, status, person_id, kunde, parameter, schalter, vertrag_pdf, text_hash, angenommen_am, ip, user_agent
      FROM fiaon_global_angebote WHERE id = ${angebotId} LIMIT 1`) as any[];
  if (!a) return nein(404, "Dieses Angebot gibt es nicht.");
  if (!/^IA-BEGLEIT-/i.test(String(a.fassung ?? ""))) return nein(400, "Nur für Begleitverträge — die anderen Angebote legen ihre Akte bei der Annahme selbst an.");
  if (String(a.status) !== "angenommen") return nein(409, "Das Angebot ist noch nicht angenommen.");
  const [da] = (await sqlPool`SELECT ref FROM fiaon_global_auftraege WHERE angebot_id = ${angebotId} LIMIT 1`) as any[];
  if (da) {
    // E-451 (28.10.2026): Der Knopf ist wiederholbar — er holt auch die Verknüpfung Angebot → Akte nach (falls sie fehlt).
    await begleitAngebotVerknuepfen(angebotId).catch((e) => console.error(`[GLOBAL-AKTE] Begleit ${a.angebot_ref}: Verknüpfung:`, e));
    return { ok: true, ref: String(da.ref), schon: true, meldung: `Die Global-Akte gibt es schon (${da.ref}).` };
  }
  const daten = begleitAkteDaten({ fassung: String(a.fassung), kunde: jsonLesen(a.kunde), parameter: jsonLesen(a.parameter), schalter: jsonLesen(a.schalter) });
  const personId = a.person_id != null ? Number(a.person_id) : null;
  const kandidaten = (await sqlPool`
    SELECT ref, pack_key, created_at, payment_status, cancelled_at, merged_into, archived_at FROM fiaon_applications
     WHERE (${personId}::int IS NOT NULL AND person_id = ${personId}::int) OR (${daten.email || null}::text IS NOT NULL AND lower(trim(email)) = ${daten.email || null}::text)`) as any[];
  const anker = begleitAkteAnker(kandidaten.map((z) => ({
    ref: String(z.ref), packKey: String(z.pack_key ?? ""), createdAt: new Date(z.created_at).toISOString(), paymentStatus: String(z.payment_status ?? ""),
    cancelled: !!z.cancelled_at, merged: !!z.merged_into, archived: !!z.archived_at,
  })));
  if (!anker) return nein(409, "Für diesen Kunden gibt es noch keine Rechnung zum Begleitvertrag (Unterlagen-Paket, LLC-Gründung oder Fast-Track). Die Akte hängt an einer solchen Rechnung — bitte zuerst die Rechnung anlegen.");
  const [besetzt] = (await sqlPool`SELECT ref, angebot_id FROM fiaon_global_auftraege WHERE ref = ${anker} LIMIT 1`) as any[];
  if (besetzt) return nein(409, `Die Rechnung ${anker} trägt schon eine Global-Akte (Angebot ${besetzt.angebot_id ?? "—"}). Bitte im Chefbüro prüfen.`);
  const { ANGEBOT_PAKET_KEY } = await import("./fiaon-global-angebot");
  const sch = jsonLesen(a.schalter);
  const bestaetigungen = { annahme: "Auftrag zahlungspflichtig erteilen", begleitvertrag: true, am: a.angenommen_am ? new Date(a.angenommen_am).toISOString() : null,
    sofortBeginn: sch.sofortBeginn === true, jahresbetreuungGewaehlt: sch.jahresbetreuung === true, aktePerKnopf: { von: agent.name, am: new Date().toISOString() } };
  // Status „gestartet“: Der Begleitvertrag läuft (Justin führt den Kunden persönlich) — keine Zahlungserinnerung des
  // Global-Wegs an einer Einzelrechnung, keine Startmail. Jahresbetreuung bleibt aus (ihre Rechnung stellt die Leitung von Hand).
  // Zuständig: wer die Akte anlegt (beim Begleitvertrag führt die Leitung den Kunden persönlich); sonst die Vorgabe „Neue an …“.
  const { globalEinstellungen } = await import("./fiaon-global-auftrag");
  const zustaendigVorgabe = agent.id ? agent.id : (await globalEinstellungen().catch(() => null))?.zustaendigAgentId ?? null;
  await sqlPool`
    INSERT INTO fiaon_global_auftraege
      (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_pdf, vertrag_version, vertrag_sprache, unterschrieben_am, ip, user_agent,
       quelle, status, doc_hash, firma_name, email, rechnung_ust_modus, angebot_id, person_id, gesellschaft, zustaendig_agent_id, gestartet_am)
    VALUES
      (${anker}, ${ANGEBOT_PAKET_KEY}, ${daten.land}, ${sqlPool.json(daten.firma as any)}, ${sqlPool.json(daten.ansprechpartner as any)}, ${sqlPool.json(bestaetigungen as any)},
       ${a.vertrag_pdf ?? null}, ${String(a.fassung)}, 'de', ${a.angenommen_am ?? null}, ${a.ip ?? null}, ${a.user_agent ?? null},
       'individualangebot', 'gestartet', ${a.text_hash ?? null}, ${daten.name || null}, ${daten.email || null}, 'none', ${angebotId}, ${personId},
       ${daten.gesellschaft ? sqlPool.json(daten.gesellschaft as any) : null}, ${zustaendigVorgabe}, NOW())
    ON CONFLICT (ref) DO NOTHING`;
  const [neu] = (await sqlPool`SELECT ref, angebot_id FROM fiaon_global_auftraege WHERE ref = ${anker} LIMIT 1`) as any[];
  if (!neu || Number(neu.angebot_id) !== angebotId) return nein(409, "Die Akte ließ sich nicht anlegen — die Rechnung wurde gerade anders vergeben. Bitte neu laden.");
  const { verlaufSchreiben } = await import("./fiaon-global-bereich");
  await verlaufSchreiben(anker, { art: "akte", text: `Global-Akte zum Begleitvertrag ${a.angebot_ref} angelegt (${agent.name}); Anker: Rechnung ${anker}.`, sichtbar: false, agentId: agent.id || null });
  // E-451 (28.10.2026): Angebot ↔ Akte verknüpfen (auftrag_ref) — sonst fehlen Begleitvertrag-Block und Angebotsunterlagen in
  // Portal und Chefbüro (sie suchen das Angebot über auftrag_ref). Ist die Bestellung schon bezahlt, gleich den Verlauf mitnehmen.
  await begleitAngebotVerknuepfen(angebotId).catch((e) => console.error(`[GLOBAL-AKTE] Begleit ${a.angebot_ref}: Verknüpfung:`, e));
  await begleitZahlungStartAbgleich(anker).catch((e) => console.error(`[GLOBAL-AKTE] Begleit ${a.angebot_ref}: Zahlung/Start:`, e));
  console.log(`[GLOBAL-AKTE] Begleit ${a.angebot_ref}: Akte ${anker} angelegt (${agent.name})`);
  // Der geprüfte Name aus der Gründungsrechnung gleich mitnehmen (sonst erst mit dem nächsten Lauf).
  await begleitNamenAbgleich().catch((e) => console.error(`[GLOBAL-AKTE] Begleit ${a.angebot_ref}: Namensabgleich:`, e));
  return { ok: true, ref: anker, schon: false, meldung: `Global-Akte ${anker} angelegt. Das neue Portal schaltet der Inhaber im Mandat frei.` };
}

// ── 5b DER GEPRÜFTE NAME EINES BEGLEITVERTRAGS (22.10.2026, erster Begleitvertrag) ─────
// Die Akte trägt bei der Anlage den Wunschnamen aus der Annahme mit dem Vermerk „vorgemerkt“ (geprueft: false, E-399). Geprüft
// wird er im Register, bevor die Leitung die Gründungsrechnung stellt — deren Titel trägt dann den geprüften Namen (beim
// vergebenen Wunschnamen den Ausweichnamen, Ziffer 3). Dieser Abgleich übernimmt ihn: Name in die Akte, Vermerk weg, Station
// „Name geprüft“ erledigt (Tag der ersten solchen Rechnung) — über den Weg des Stationen-Editors, mit Verlauf. Keine Mail.
// Nur Akten mit dem Vermerk und ohne erledigte Station; einmal geprüft, fasst der Lauf die Akte nie wieder an.
export async function begleitNamenAbgleich(): Promise<{ geprueft: number; gesetzt: string[]; fehler: number }> {
  const erg = { geprueft: 0, gesetzt: [] as string[], fehler: 0 };
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_auftraege') AS a, to_regclass('public.fiaon_global_schritte') AS s`) as any[];
  if (!t?.a || !t?.s) return erg;
  const { BEGLEIT_NAMENS_RECHNUNGEN, begleitLlcAusRechnung } = await import("./fiaon-global-angebot-begleit");
  const akten = (await sqlPool`
    SELECT a.ref, a.person_id, a.gesellschaft->>'name' AS name
      FROM fiaon_global_auftraege a
     WHERE (a.bestaetigungen->>'begleitvertrag') = 'true' AND a.status <> 'storniert'
       AND a.gesellschaft->>'geprueft' = 'false' AND a.person_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_global_schritte s WHERE s.ref = a.ref AND s.schluessel = 'name' AND s.status IN ('erledigt', 'entfaellt'))`) as any[];
  for (const a of akten) {
    erg.geprueft++;
    const rechnungen = (await sqlPool`
      SELECT pack_name, created_at FROM fiaon_applications
       WHERE person_id = ${Number(a.person_id)} AND pack_key = ANY(${[...BEGLEIT_NAMENS_RECHNUNGEN]}) AND merged_into IS NULL AND invoice_number IS NOT NULL
       ORDER BY created_at ASC`) as any[];
    const mitName = rechnungen.map((r) => ({ name: begleitLlcAusRechnung(r.pack_name), am: r.created_at })).filter((r) => r.name);
    if (!mitName.length) continue;
    // Der jüngste Titel gilt (wurde der Name nach einer Rechnung noch gewechselt, trägt ihn die neuere); das Datum der Prüfung ist die erste.
    const name = mitName[mitName.length - 1].name!;
    const { berlinDatum } = await import("./fiaon-time");
    const datum = berlinDatum(new Date(mitName[0].am));
    const { globalStationSpeichern } = await import("./fiaon-global-mandat");
    const r = await globalStationSpeichern(String(a.ref), {
      schluessel: "name", status: "erledigt", datum,
      ...(name !== String(a.name ?? "") ? { werte: { name } } : {}),
    }, { id: 0, name: "Abgleich Gründungsrechnung" }).catch((e) => ({ ok: false as const, status: 500, error: String(e?.message ?? e) }));
    if (r.ok) { erg.gesetzt.push(`${a.ref}: ${name}`); console.log(`[GLOBAL-AKTE] ${a.ref}: geprüfter Name aus der Gründungsrechnung — ${name} (${datum})`); }
    else { erg.fehler++; console.error(`[GLOBAL-AKTE] ${a.ref}: Namensabgleich gescheitert — ${r.error}`); }
  }
  return erg;
}

// ── 5c DIE LÖSCHUNG EINER FRÜHEREN GESELLSCHAFT IM FAHRPLAN (27.10.2026) ──────
// Justin: „Sollte das mit der Löschung nicht automatisch dort mit eingetragen werden? Das muss ja alles 100 % synchron laufen.“
// Ist eine Löschungsrechnung (llc_loeschung) der Person bezahlt, legt dieser Abgleich die Station „Frühere Gesellschaft gelöscht“
// in ihrer Global-Akte an (in Arbeit), mit der Gesellschaft aus dem Bestellnamen („… (Name, Bundesstaat)“). Danach pflegt das
// Team sie wie jede Station (erledigt, sobald gelöscht). Einmal angelegt, fasst der Lauf sie nie wieder an. Keine Mail.
export async function vorgesellschaftAbgleich(): Promise<{ geprueft: number; gesetzt: string[]; fehler: number }> {
  const erg = { geprueft: 0, gesetzt: [] as string[], fehler: 0 };
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_schritte') AS s`) as any[];
  if (!t?.s) return erg;
  const faelle = (await sqlPool`
    SELECT DISTINCT ON (g.ref) g.ref, a.pack_name, a.paid_at, a.completed_at
      FROM fiaon_global_auftraege g
      JOIN fiaon_applications a ON a.person_id = g.person_id AND a.pack_key = 'llc_loeschung' AND a.payment_status = 'paid' AND a.merged_into IS NULL
     WHERE g.status <> 'storniert' AND g.person_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_global_schritte s WHERE s.ref = g.ref AND s.schluessel = 'vorgesellschaft')
     ORDER BY g.ref, a.created_at DESC`) as any[];
  const { globalStationSpeichern } = await import("./fiaon-global-mandat");
  for (const f of faelle) {
    erg.geprueft++;
    const klammer = String(f.pack_name ?? "").match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? "";
    const r = await globalStationSpeichern(String(f.ref), {
      schluessel: "vorgesellschaft", status: "in_arbeit", ...(klammer ? { werte: { vorGesellschaft: klammer.replace(/,\s*/g, " · ") } } : {}),
    }, { id: 0, name: "Abgleich Löschungsrechnung" }).catch((e) => ({ ok: false as const, status: 500, error: String(e?.message ?? e) }));
    if (r.ok) { erg.gesetzt.push(String(f.ref)); console.log(`[GLOBAL-AKTE] ${f.ref}: Station „Frühere Gesellschaft gelöscht“ angelegt (${klammer || "ohne Namen"})`); }
    else { erg.fehler++; console.error(`[GLOBAL-AKTE] ${f.ref}: Löschung nicht in den Fahrplan — ${r.error}`); }
  }
  return erg;
}

// ── 5d BEGLEITVERTRAG: ANGEBOT ↔ AKTE, ZAHLUNG UND START (E-451, 28.10.2026) ─────────────
// (1) Verknüpfung. Die Begleit-Akte hing bisher nur über fiaon_global_auftraege.angebot_id am Angebot; auftrag_ref am Angebot
//     blieb leer. Portal und Chefbüro suchen das Angebot aber über auftrag_ref (angebotSichtZurAkte, angebotIdFuerAuftrag,
//     Konto-Zugriff) — Begleitvertrag-Block und Angebotsunterlagen fehlten. Jetzt setzt die Anlage auftrag_ref; für den
//     Bestand holt der Abgleich es nach — NUR, wenn es eindeutig ist (genau eine Akte trägt dieses Angebot, kein anderes
//     Angebot trägt diese Akte). Warum das jetzt sicher ist: Die Läufe, die an auftrag_ref hängen, fassen den Begleitvertrag
//     nicht an — Stundenlauf/Nachholen (fassung NOT LIKE 'IA-BEGLEIT-%'), Bestätigungsmail (bestaetigungSenden: begleit →
//     nichts), Startgespräch (angebotStartgespraechBuchen: Begleitvertrag → nicht_bereit, E-451), Frist/Teil 2 (keine Frist,
//     keine Teile). Keine Mail.
export async function begleitAngebotVerknuepfen(angebotId: number | null = null): Promise<{ verknuepft: string[] }> {
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebote') AS o, to_regclass('public.fiaon_global_auftraege') AS a`) as any[];
  if (!t?.o || !t?.a) return { verknuepft: [] };
  const zeilen = (await sqlPool`
    UPDATE fiaon_global_angebote a SET auftrag_ref = g.ref, updated_at = NOW()
      FROM fiaon_global_auftraege g
     WHERE g.angebot_id = a.id AND a.auftrag_ref IS NULL AND a.fassung LIKE 'IA-BEGLEIT-%'
       AND (${angebotId}::bigint IS NULL OR a.id = ${angebotId}::bigint)
       AND (SELECT COUNT(*) FROM fiaon_global_auftraege g2 WHERE g2.angebot_id = a.id) = 1
       AND NOT EXISTS (SELECT 1 FROM fiaon_global_angebote x WHERE x.auftrag_ref = g.ref)
    RETURNING a.angebot_ref, g.ref`) as any[];
  if (zeilen.length) {
    const { verlaufSchreiben } = await import("./fiaon-global-bereich");
    for (const z of zeilen) {
      await verlaufSchreiben(String(z.ref), { art: "akte", sichtbar: false, text: `Begleitvertrag ${z.angebot_ref} mit dieser Akte verknüpft — Vertrag und Angebotsunterlagen stehen jetzt in Portal und Chefbüro.` });
      console.log(`[GLOBAL-AKTE] ${z.ref}: Begleitvertrag ${z.angebot_ref} verknüpft (auftrag_ref).`);
    }
  }
  return { verknuepft: zeilen.map((z) => `${z.ref} ← ${z.angebot_ref}`) };
}

// (2) Zahlung und Start. Die Rechnungen des Begleitvertrags sind Einzelkäufe (llc_paket, llc_gruendung*, llc_fasttrack — Art
//     „privat“, kein Global-Paket): onCustomerPaid ruft globalNachZahlung für sie nicht, also setzte niemand bezahlt_am — die
//     Zeile „Zahlung eingegangen.“ fehlte im Verlauf (verlaufBauen leitet sie aus bezahlt_am ab), obwohl Portal und Chefbüro
//     „bezahlt“ zeigten (payment_status der Anker-Rechnung). Akten vor dem Nachtrag ec3b0516 (22.10., 23:30) tragen auch kein
//     gestartet_am — die Zeile „Ihr Auftrag ist gestartet.“ fehlte. Jetzt: bezahlt_am = Tag der Anker-Rechnung aus derselben
//     Quelle wie Chefbüro und Umsatz (COALESCE(paid_at, completed_at)); gestartet_am = Anlage der Akte (so setzt es die Anlage
//     heute auch: gestartet_am = NOW()). Nur leere Felder, nie überschreiben — wiederholbar. Gerufen beim Bestätigen einer
//     Zahlung (onCustomerPaid, nur diese Bestellung) und im halbstündlichen Abgleich (Bestand und Netz). Keine Mail; die Zeilen
//     sind die abgeleiteten des Verlaufs, es wird keine zweite geschrieben.
export async function begleitZahlungStartAbgleich(ref: string | null = null): Promise<{ bezahlt: string[]; gestartet: string[] }> {
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_auftraege') AS a`) as any[];
  if (!t?.a) return { bezahlt: [], gestartet: [] };
  const bezahlt = (await sqlPool`
    UPDATE fiaon_global_auftraege g SET bezahlt_am = COALESCE(b.paid_at, b.completed_at), updated_at = NOW()
      FROM fiaon_applications b
     WHERE b.ref = g.ref AND (g.bestaetigungen->>'begleitvertrag') = 'true' AND g.bezahlt_am IS NULL
       AND b.payment_status = 'paid' AND COALESCE(b.paid_at, b.completed_at) IS NOT NULL
       AND (${ref}::text IS NULL OR g.ref = ${ref}::text)
    RETURNING g.ref`) as any[];
  const gestartet = (await sqlPool`
    UPDATE fiaon_global_auftraege g SET gestartet_am = g.created_at, updated_at = NOW()
     WHERE (g.bestaetigungen->>'begleitvertrag') = 'true' AND g.gestartet_am IS NULL AND g.status IN ('gestartet', 'abgeschlossen')
       AND (${ref}::text IS NULL OR g.ref = ${ref}::text)
    RETURNING g.ref`) as any[];
  for (const z of bezahlt) console.log(`[GLOBAL-AKTE] ${z.ref}: Begleitvertrag — Zahlungseingang in die Akte übernommen.`);
  for (const z of gestartet) console.log(`[GLOBAL-AKTE] ${z.ref}: Begleitvertrag — Start (Anlage der Akte) in die Akte übernommen.`);
  return { bezahlt: bezahlt.map((z) => String(z.ref)), gestartet: gestartet.map((z) => String(z.ref)) };
}

/** Der halbstündliche Abgleich der Global-Akten (Lauf global_begleit_name): geprüfter Name, Löschung einer früheren Gesellschaft,
 *  und seit E-451 die Verknüpfung Begleitvertrag ↔ Akte sowie Zahlung/Start der Begleit-Akten. Ein Fehler in einem Teil hält die anderen nicht an. */
export async function globalAkteAbgleich(): Promise<{
  name: Awaited<ReturnType<typeof begleitNamenAbgleich>>; loeschung: Awaited<ReturnType<typeof vorgesellschaftAbgleich>>;
  verknuepfung: { verknuepft: string[] } | { fehler: string }; zahlungStart: { bezahlt: string[]; gestartet: string[] } | { fehler: string };
}> {
  const verknuepfung = await begleitAngebotVerknuepfen().catch((e) => { console.error("[GLOBAL-AKTE] Abgleich Verknüpfung:", e); return { fehler: String(e?.message ?? e) }; });
  const zahlungStart = await begleitZahlungStartAbgleich().catch((e) => { console.error("[GLOBAL-AKTE] Abgleich Zahlung/Start:", e); return { fehler: String(e?.message ?? e) }; });
  return { name: await begleitNamenAbgleich(), loeschung: await vorgesellschaftAbgleich(), verknuepfung, zahlungStart };
}

// ── 6 VON HAND UNTERSCHRIEBEN: DER SCAN ALS PDF (22.10.2026) ─────────────────
// Unser Registered-Agent-Partner verlangt für das IRS-Formular SS-4 (Kunden ohne SSN/ITIN) eine Unterschrift mit Tinte.
// Der Kunde druckt, unterschreibt und datiert von Hand, scannt als PDF und lädt hoch — oder das Team lädt den Scan in
// seinem Namen hoch. Angenommen wird NUR ein PDF (Kopf %PDF-, nicht die Endung); ein Foto bekommt einen freundlichen Satz.
// Der Scan wird die unterschriebene Fassung (unterschrift_von_id → Original), das Original gilt als unterschrieben, der
// Nachweis steht in unterschrift_nachweis. Verlauf für den Kunden, Aufgabe ans Team (SS-4: an den Registered Agent zurück).
export async function globalScanHochladen(ref: string, idRoh: unknown, datei: { buffer: Buffer; originalname: string } | null,
  wer: { kunde: { ip: string; userAgent: string } } | { team: { id: number; name: string } }): Promise<{ ok: true; meldung: string; id: number } | { ok: false; status: number; error: string }> {
  await ensureAkteKomplett();
  const { lageLesen, dokumentSpeichern, verlaufSchreiben } = await import("./fiaon-global-bereich");
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  const s = l.sprache === "en" ? "en" : "de"; const W = HANDSCHRIFT_WOERTER[s];
  const id = Number(idRoh);
  const [d] = Number.isInteger(id) && id > 0 ? ((await sqlPool`
    SELECT id, art, titel, dateiname, unterschrift_gefordert, unterschrieben_am, sichtbar_fuer_kunde, pflicht_key, unterschrift_art
      FROM fiaon_global_dokumente WHERE id = ${id} AND ref = ${ref} AND geloescht_am IS NULL LIMIT 1`) as any[]) : [];
  if (!d || !d.unterschrift_gefordert || !d.sichtbar_fuer_kunde) return nein(404, s === "en" ? "This document is not waiting for your signature." : "Dieses Dokument wartet nicht auf Ihre Unterschrift.");
  if (unterschriftModus(d.pflicht_key, d.unterschrift_art) !== "handschriftlich") return nein(409, W.nichtHandschrift);
  if (d.unterschrieben_am) return nein(409, W.schonUnterschrieben);
  if (!datei?.buffer?.length) return nein(400, W.nurPdf);
  if (datei.buffer.length > 15 * 1024 * 1024) return nein(400, W.zuGross);
  // Ein Foto (JPEG, PNG, HEIC) oder sonst etwas, das kein PDF ist: derselbe freundliche Satz — „als PDF scannen“.
  if (!istPdfInhalt(datei.buffer.subarray(0, 8))) {
    if (istBildInhalt(datei.buffer.subarray(0, 16))) console.log(`[GLOBAL-AKTE] ${ref}: Foto statt PDF-Scan abgelehnt (Dokument ${id}).`);
    return nein(400, W.nurPdf);
  }
  const p = globalPflichtUnterlage(d.pflicht_key);
  const titel = p ? p.titel[s] : String(d.titel || d.dateiname);
  const kunde = "kunde" in wer;
  const basis = String(d.dateiname).replace(/\.pdf$/i, "");
  const neu = await dokumentSpeichern({ ref, von: kunde ? "kunde" : "fiaon", art: String(d.art), dateiname: `${basis}_${s === "en" ? "signed" : "unterschrieben"}.pdf`, mime: "application/pdf", inhalt: datei.buffer, sichtbar: true, agentId: kunde ? null : (wer as any).team.id || null });
  const nachweis = {
    art: "handschriftlich_scan", hochgeladen_von: kunde ? "kunde" : "team", ...(kunde ? { ip: (wer as any).kunde.ip, user_agent: (wer as any).kunde.userAgent } : { mitarbeiter: (wer as any).team.name }),
    sha256: createHash("sha256").update(datei.buffer).digest("hex"), am: new Date().toISOString(), original_id: id, dateiname_hochgeladen: String(datei.originalname || "").slice(0, 160),
  };
  await sqlPool`UPDATE fiaon_global_dokumente SET titel = ${`${titel} — ${s === "en" ? "signed (scan)" : "unterschrieben (Scan)"}`}, unterschrift_von_id = ${id}, unterschrieben_am = NOW(),
                       unterschrift_art = 'handschriftlich', kunde_gelesen_am = NOW(), unterschrift_nachweis = ${sqlPool.json(nachweis as any)} WHERE id = ${neu.id} AND ref = ${ref}`;
  const [gesetzt] = (await sqlPool`UPDATE fiaon_global_dokumente SET unterschrieben_am = NOW(), unterschrift_nachweis = ${sqlPool.json(nachweis as any)}
                       WHERE id = ${id} AND ref = ${ref} AND unterschrieben_am IS NULL RETURNING id`) as any[];
  if (!gesetzt) return nein(409, W.schonUnterschrieben);
  await verlaufSchreiben(ref, { art: "unterschrift", text: kunde ? W.verlauf(titel) : W.verlaufTeam(titel), sichtbar: true, von: kunde ? "kunde" : "fiaon", agentId: kunde ? null : (wer as any).team.id || null });
  // Die Aufgabe ans Team: beim SS-4 der Weg zurück an das Ablageteam unseres Registered-Agent-Partners.
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const { globalAufgabenZiel } = await import("./fiaon-global-auftrag");
    const ss4 = d.pflicht_key === "irs_ss4";
    await auftragFuerKunden({
      personId: l.b?.person_id != null ? Number(l.b.person_id) : null, ref,
      titel: ss4 ? `SS-4 unterschrieben – an den Registered Agent (Ablageteam) per E-Mail zurücksenden — ${l.akte.firma_name || ref}` : `${p ? p.titel.de : "Dokument"} unterschrieben zurück — ${l.akte.firma_name || ref}`,
      text: `${kunde ? "Der Kunde hat" : "Im Namen des Kunden wurde"} „${p ? p.titel.de : String(d.titel || d.dateiname)}“ von Hand unterschrieben als PDF hochgeladen. Der Scan liegt im Tresor (Akte komplett).${ss4 ? " Bitte das unterschriebene SS-4 per E-Mail an das Ablageteam des Registered Agent zurückschicken; danach Station EIN auf „Eingereicht (Fax)“ setzen." : " Bitte prüfen."}`,
      schluessel: `global:${ref}:scan:${id}`, bereich: "konten", quelle: "global", autorName: "FIAON Global", dringend: ss4,
      // E-443 (28.10.2026): EIN Helfer für den Weg ins Chefbüro — wie Upload und Nachricht (shared/fiaon-global-wege.ts).
      link: globalChefMandatPfad(ref),
      // E-451 (28.10.2026): EINE Regel für das Ziel — die Zuständigkeit der Akte (globalAufgabenZiel).
      ...(await globalAufgabenZiel(l.akte.zustaendig_agent_id)),
      anlageText: "Unterschriebener Scan im Portal hochgeladen.",
    });
  } catch (e) { console.error(`[GLOBAL-AKTE] ${ref}: Aufgabe zum Scan nicht angelegt:`, e); }
  // E-443 (28.10.2026, Gutachten): Hat das Team den Scan selbst hochgeladen, ist er gesehen — die Aufgabe schließt sich
  // sofort (außer SS-4: dort folgt der Weg zum Registered Agent von Hand).
  if (!kunde) {
    try {
      const { globalKundenAufgabenErledigen } = await import("./fiaon-global-mandat");
      await globalKundenAufgabenErledigen(ref, (wer as any).team.name || "Team");
    } catch (e) { console.error(`[GLOBAL-AKTE] ${ref}: Scan-Aufgabe nicht erledigt:`, e); }
  }
  return { ok: true, id: neu.id, meldung: kunde ? W.fertigText : d.pflicht_key === "irs_ss4" ? "Scan als unterschriebene Fassung abgelegt — die Aufgabe „an den Registered Agent“ ist angelegt." : "Scan als unterschriebene Fassung abgelegt." };
}
