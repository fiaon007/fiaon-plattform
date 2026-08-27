// ═══════════════════════════════════════════════════════════════════════════
// HANDYFOTO → PDF (27.08.2026)
//
// Florentine: „Kunden-Uploads werden nicht gespeichert."
//
// ── DIE URSACHE ───────────────────────────────────────────────────────────
// Der Kundenbereich verspricht „PDF, JPG oder PNG — ein Handyfoto genügt,
// wenn alles lesbar ist". Der Server nahm ausschliesslich `application/pdf`
// an und antwortete sonst mit „Only PDF files are allowed" — auf Englisch,
// in einer deutschen Oberfläche. Jedes Foto scheiterte.
//
// Von 462 zahlenden Kunden hatten 107 je etwas hochgeladen. Die meisten
// Menschen fotografieren ihren Ausweis, sie scannen ihn nicht.
//
// ── WARUM UMWANDELN UND NICHT EINFACH ABLEGEN ─────────────────────────────
// Die Spalten heissen `bank_statement_pdf`, `id_card_pdf`, `schufa_pdf`, und
// alles Nachgelagerte — Ansicht, Weitergabe, Kontoauszugs-Auswertung —
// verlässt sich darauf, dass dort ein PDF liegt. Ein JPEG in einer Spalte
// namens `_pdf` wäre eine Falle für jeden, der später daran arbeitet.
// Deshalb wird das Bild in ein einseitiges PDF gelegt, bevor es gespeichert
// wird. Danach ist alles wie bisher.
// ═══════════════════════════════════════════════════════════════════════════
import PDFDocument from "pdfkit";

/** Was pdfkit ohne Zusatzbibliothek einbetten kann. */
export const BILD_ARTEN = ["image/jpeg", "image/jpg", "image/png"] as const;

/** HEIC kommt von iPhones und kann NICHT eingebettet werden — eigener Rat. */
export const HEIC_ARTEN = ["image/heic", "image/heif"] as const;

export function istBild(mimetype: string): boolean {
  return (BILD_ARTEN as readonly string[]).includes(String(mimetype).toLowerCase());
}
export function istHeic(mimetype: string): boolean {
  return (HEIC_ARTEN as readonly string[]).includes(String(mimetype).toLowerCase());
}

/**
 * Legt ein Bild als einseitiges PDF ab — randlos auf DIN A4, das Seitenformat
 * folgt dem Bild (Hochformat bleibt Hochformat).
 *
 * Wirft, wenn pdfkit das Bild nicht lesen kann; der Aufrufer soll das dem
 * Kunden in einem Satz sagen, statt es zu verschlucken.
 */
export function bildAlsPdf(bild: Buffer, dateiname: string): Promise<Buffer> {
  return new Promise((fertig, fehler) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
      const teile: Buffer[] = [];
      doc.on("data", (d: Buffer) => teile.push(d));
      doc.on("end", () => fertig(Buffer.concat(teile)));
      doc.on("error", fehler);

      // A4 in Punkten. Das Bild wird eingepasst, nicht beschnitten: Ein
      // abgeschnittener Ausweis ist kein Ausweis.
      const A4_BREIT = 595.28, A4_HOCH = 841.89;
      // openImage steht in den Typen nicht, existiert aber seit pdfkit 0.11.
      // Es liefert Breite und Höhe, ohne das Bild zweimal zu dekodieren.
      const bilddaten = (doc as any).openImage(bild) as { width: number; height: number };
      const quer = bilddaten.width > bilddaten.height;
      const seiteB = quer ? A4_HOCH : A4_BREIT;
      const seiteH = quer ? A4_BREIT : A4_HOCH;

      doc.addPage({ size: [seiteB, seiteH], margin: 0 });
      doc.image(bild, 0, 0, { fit: [seiteB, seiteH], align: "center", valign: "center" });

      // Eine leise Fusszeile: Wer das PDF später in der Akte sieht, soll
      // wissen, dass es aus einem Foto entstanden ist.
      doc.fontSize(7).fillColor("#94a3b8").text(
        `Vom Kunden als Bilddatei eingereicht (${dateiname}) · automatisch in PDF gewandelt`,
        12, seiteH - 16, { width: seiteB - 24, align: "left" },
      );

      doc.end();
    } catch (e) {
      fehler(e);
    }
  });
}
