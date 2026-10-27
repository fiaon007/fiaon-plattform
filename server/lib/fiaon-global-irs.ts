// ═══════════════════════════════════════════════════════════════════════════
// IRS SS-4 / 8821 FÜLLEN — pdf-lib auf dem amtlichen Formular (22.10.2026)
//
// Welche Felder woher: shared/fiaon-global-irs.ts (rein). Hier nur: Datei lesen,
// Felder setzen, Darstellung erzeugen, Formular „flach“ machen (der Kunde druckt es
// aus — nichts soll sich beim Drucken verschieben oder leeren). Unterschrift und Datum
// bleiben leer (von Hand). Die Dateien: server/assets/irs/ (README dort).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, PDFCheckBox, PDFTextField, StandardFonts } from "pdf-lib";
import { IRS_FORMULARE, irsBelegung, type IrsBelegung } from "@shared/fiaon-global-irs";
import type { FormularKontext } from "@shared/fiaon-global-us-dokumente";
import { metadaten } from "./fiaon-global-pdf-satz";

export function irsVorlage(art: "irs_ss4" | "irs_8821"): Buffer {
  return readFileSync(path.resolve(process.cwd(), "server", "assets", "irs", IRS_FORMULARE[art].datei));
}

/** Die Feldnamen der Vorlage — der Prüfstand hält die Zuordnung dagegen. */
export async function irsFeldnamen(art: "irs_ss4" | "irs_8821"): Promise<Set<string>> {
  const pdf = await PDFDocument.load(irsVorlage(art));
  return new Set(pdf.getForm().getFields().map((f) => f.getName()));
}

/** Füllt das Formular. `flach`: Felder in die Seite einbrennen (Vorgabe ja). */
export async function irsFuellen(art: "irs_ss4" | "irs_8821", k: FormularKontext, o: { flach?: boolean; am?: Date } = {}): Promise<{ pdf: Buffer; belegung: IrsBelegung }> {
  const belegung = irsBelegung(art, k, { fax: process.env.FIAON_GLOBAL_FAX ?? null });
  const pdf = await PDFDocument.load(irsVorlage(art));
  const form = pdf.getForm();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  for (const f of belegung.felder) {
    const feld = form.getFieldMaybe(f.feld);
    if (!feld) throw new Error(`${art}: Feld ${f.feld} gibt es in der Vorlage nicht (neue Revision?).`);
    if (feld instanceof PDFCheckBox) { if (f.wert === true) feld.check(); else feld.uncheck(); continue; }
    if (feld instanceof PDFTextField) {
      const text = String(f.wert);
      const max = feld.getMaxLength();
      feld.setText(max ? text.slice(0, max) : text);
      // Lange Werte (Name und Anschrift) kleiner, damit nichts abgeschnitten wird.
      if (text.includes("\n")) feld.enableMultiline();
      // Schwarz statt der Vorgabefarbe der Vorlage — das Formular wird ausgedruckt und gefaxt.
      feld.acroField.setDefaultAppearance(`/Helv ${text.length > 60 || text.includes("\n") ? 7 : 9} Tf 0 g`);
    }
  }
  form.updateFieldAppearances(helv);
  if (o.flach !== false) form.flatten();
  metadaten(pdf, art === "irs_ss4" ? "IRS Form SS-4 (prefilled by FIAON)" : "IRS Form 8821 (prefilled by FIAON)", o.am ?? new Date());
  return { pdf: Buffer.from(await pdf.save({ useObjectStreams: false })), belegung };
}
