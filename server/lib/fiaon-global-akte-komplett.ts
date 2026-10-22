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
  globalAkteRechnungTitel, globalPflichtFuer, globalPflichtStand, globalPflichtUnterlage, type AkteSprache,
} from "@shared/fiaon-global-akte";

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
        await tx`ALTER TABLE fiaon_global_dokumente ADD COLUMN IF NOT EXISTS pflicht_key TEXT, ADD COLUMN IF NOT EXISTS unterschrift_nachweis JSONB`;
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

interface Mandat { ref: string; personId: number | null; email: string | null; sprache: AkteSprache; fassung: string | null; name: string; gesellschaft: string; vertrag: boolean; gegruendet: boolean }
async function mandatLesen(ref: string): Promise<Mandat | null> {
  await ensureAkteKomplett();
  const [g] = (await sqlPool`
    SELECT g.ref, g.person_id, g.email, g.vertrag_sprache, g.ansprechpartner, g.gesellschaft, g.firma_name, (g.vertrag_pdf IS NOT NULL) AS hat_vertrag, a.fassung
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
  return zeilen.filter((z) => !/^IA-KOOP/i.test(String(z.fassung ?? ""))).map((z) => ({ id: Number(z.id), angebotRef: String(z.angebot_ref), fassung: String(z.fassung ?? ""), angenommenAm: iso(z.angenommen_am) }));
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
    SELECT id, pflicht_key, titel, dateiname, unterschrift_gefordert, unterschrieben_am, sichtbar_fuer_kunde, unterschrift_von_id
      FROM fiaon_global_dokumente WHERE ref = ${ref} AND geloescht_am IS NULL AND (pflicht_key IS NOT NULL OR unterschrift_gefordert)`) as any[];
  const liste = globalPflichtFuer(m.fassung, { gegruendet: m.gegruendet, bereit: doks.map((d) => String(d.pflicht_key ?? "")).filter(Boolean) });
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
      return { key: e.key, titel: p ? p.titel[m.sprache] : (e.titel || (m.sprache === "en" ? "Document" : "Dokument")), text: p ? p.text[m.sprache] : "", art: p?.art ?? null, formular: !!p, stand: e.stand, dokumentId: e.dokumentId };
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
  await sqlPool`UPDATE fiaon_global_dokumente SET pflicht_key = ${p?.key ?? null} WHERE id = ${dokumentId} AND ref = ${ref}`;
  return { ok: true };
}

/**
 * Ein abgelegtes PDF zur Unterschrift stellen (Office-Weg; das Chefbüro kann das beim Hochladen selbst) und optional einer
 * Pflichtunterlage zuordnen — z. B. das Formular SS-4 an der Station EIN. Der Kunde sieht es unter „Für Sie zu tun“.
 */
export async function globalDokumentZurUnterschrift(ref: string, dokumentId: number, pflichtKeyRoh: unknown, agent: { id: number; name: string }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  await ensureAkteKomplett();
  const p = pflichtKeyRoh ? globalPflichtUnterlage(pflichtKeyRoh) : null;
  if (pflichtKeyRoh && !p) return nein(400, "Dieses Formular gibt es nicht.");
  const [d] = (await sqlPool`
    UPDATE fiaon_global_dokumente SET unterschrift_gefordert = TRUE, sichtbar_fuer_kunde = TRUE, pflicht_key = COALESCE(${p?.key ?? null}, pflicht_key)
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
    SELECT id, art, titel, dateiname, sichtbar_fuer_kunde, von, pflicht_key, unterschrift_gefordert, unterschrift_von_id, unterschrieben_am FROM fiaon_global_dokumente
     WHERE ref = ${ref} AND geloescht_am IS NULL ORDER BY created_at ASC, id ASC`) as any[];
  const { globalDokumentLesen } = await import("./fiaon-global-bereich");
  for (const d of doks) {
    if (fuer === "kunde" && !d.sichtbar_fuer_kunde && d.von !== "kunde") continue;
    const vollmacht = d.art === "vollmacht" || !!d.pflicht_key || !!d.unterschrift_gefordert || d.unterschrift_von_id != null;
    liste.push({
      ordner: vollmacht ? AKTE_ORDNER.vollmachten : AKTE_ORDNER.tresor, name: String(d.dateiname), titel: String(d.titel || d.dateiname),
      laden: async () => (await globalDokumentLesen(ref, d.id, fuer === "kunde" ? "kunde" : "office"))?.inhalt ?? null,
    });
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
