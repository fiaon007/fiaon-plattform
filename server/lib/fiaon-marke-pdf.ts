/**
 * Die FIAON-Marke in pdfkit-Dokumenten (E-286): als Vektorpfad, nicht als Schrift —
 * Rechnungen, Urkunden und der pdfkit-Rückfall der Dokument-PDFs zeigen dieselbe Wortmarke wie die Website.
 */
import type PDFKit from "pdfkit";
import { MARKE_BOX, MARKE_PFAD, MARKE_NAVY, type MarkeVariante } from "@shared/fiaon-marke";

/** Zeichnet die Marke mit linker oberer Ecke (x, y) und Höhe `hoehe` (pt). Liefert die Breite in pt. */
export function markeInsPdf(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  hoehe: number,
  farbe: string = MARKE_NAVY,
  variante: MarkeVariante = "fiaon",
): number {
  const m = MARKE_BOX[variante];
  const s = hoehe / m.h;
  doc.save();
  doc.translate(x - m.x * s, y - m.y * s).scale(s);
  doc.path(MARKE_PFAD[variante]).fill(farbe);
  doc.restore();
  return m.b * s;
}

/** Breite der Marke bei gegebener Höhe (pt) — zum Zentrieren. */
export function markeBreite(hoehe: number, variante: MarkeVariante = "fiaon"): number {
  const m = MARKE_BOX[variante];
  return (m.b * hoehe) / m.h;
}
