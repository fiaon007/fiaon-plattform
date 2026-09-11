// ═══════════════════════════════════════════════════════════════════════════
// MEHRERE DATEIEN → EINE PDF (E-177, 11.09.2026)
//
// Die Akte hat EINE Spalte je Unterlage (bank_statement_pdf, id_card_pdf,
// schufa_pdf), und überall im Haus heißt „Kontoauszug da“ genau eine Datei.
// Verlangt sind aber drei Monate, und viele Banken liefern je Monat eine
// eigene Datei. Statt das Haus umzubauen, werden mehrere Dateien vor dem
// Speichern zu EINER PDF gebunden: PDF-Seiten werden übernommen, ein Foto
// bekommt eine eigene Seite. Reihenfolge = Reihenfolge der Auswahl.
//
// Das Betreuerportal tat das seit dem 25.08.2026 direkt in fiaon-telefonie.ts.
// Der Kundenbereich nahm je Feld nur eine Datei, und jeder Upload überschrieb
// den vorigen: Dogan Cengiz (FIAON-MT70UE7U-CK6B) lud am 10.09.2026 um 10:20
// den August und um 10:21 den Juni hoch — in der Akte liegt nur der Juni.
// Beide Wege binden jetzt hier. Zwei Kopien derselben Regel wären die nächste
// 059-Kopie.
//
// ── VERSCHLÜSSELTE BANK-PDFs WERDEN NICHT GEBUNDEN ─────────────────────────
// Die alte Bindung lud mit `ignoreEncryption: true`. Probe gegen die 136
// jüngsten Kontoauszüge der Datenbank (11.09.2026): 6 sind von der Bank
// verschlüsselt. pdf-lib kann nicht entschlüsseln — es kopiert die
// verschlüsselten Inhaltsströme in eine unverschlüsselte Datei. Bei fünf
// Proben: dreimal ein Absturz, zweimal eine Datei mit allen Seiten und ohne
// ein einziges Zeichen (32 Seiten, 45.844 Zeichen → 64 Seiten, 0 Zeichen).
// Der zweite Fall ist der gefährliche, weil er wie ein Erfolg aussieht.
//
// Deshalb: Eine EINZELNE Datei geht wie bisher unverändert durch, auch
// verschlüsselt. Mit anderen gebunden wird eine verschlüsselte Datei nie; der
// Aufrufer bekommt einen BindeFehler mit dem Dateinamen und sagt dem Menschen
// mit bindeSatz(), was er tun kann.
// ═══════════════════════════════════════════════════════════════════════════

export type DateiArt = "pdf" | "jpg" | "png";

/**
 * Die Art am Inhalt erkannt — nicht am Namen und nicht am mitgeschickten Typ.
 * „%PDF“ darf nach der Norm irgendwo in den ersten 1024 Bytes stehen.
 */
export function dateiArt(b: Buffer): DateiArt | null {
  if (!b?.length) return null;
  if (b.subarray(0, 1024).includes("%PDF", 0, "latin1")) return "pdf";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  return null;
}

export type BindeGrund = "verschluesselt" | "unlesbar" | "leer";

/** Das Binden ist an einer bestimmten Datei gescheitert — nichts wurde gespeichert. */
export class BindeFehler extends Error {
  readonly grund: BindeGrund;
  readonly datei: string;
  constructor(grund: BindeGrund, datei: string) {
    super(`PDF-Bindung: ${grund}${datei ? ` (${datei})` : ""}`);
    this.name = "BindeFehler";
    this.grund = grund;
    this.datei = datei;
  }
}

/**
 * Der Satz für den Menschen, der hochgeladen hat: „sie“ im Kundenbereich,
 * „du“ im Office. Beide Fassungen stehen hier, damit sie nicht auseinanderlaufen.
 */
export function bindeSatz(f: BindeFehler, anrede: "sie" | "du"): string {
  const name = f.datei ? `„${f.datei}“` : "Eine der Dateien";
  if (anrede === "sie") {
    if (f.grund === "verschluesselt") {
      return `Die Datei ${name} ist von Ihrer Bank geschützt und lässt sich nicht mit anderen Dateien zu einem Dokument zusammenfügen. `
        + `Zwei Wege: Öffnen Sie die Datei und sichern Sie sie über „Drucken → Als PDF sichern“ neu — die neue Datei können Sie zusammen mit den anderen hochladen. `
        + `Oder laden Sie in Ihrem Online-Banking einen Auszug über den ganzen Zeitraum als eine Datei herunter.`;
    }
    if (f.grund === "unlesbar") {
      return `Die Datei ${name} konnten wir nicht öffnen. Bitte speichern Sie sie noch einmal aus Ihrem Online-Banking oder wählen Sie stattdessen ein Foto der Seiten.`;
    }
    return "Die gewählten Dateien enthalten keine Seiten. Bitte prüfen Sie Ihre Auswahl.";
  }
  if (f.grund === "verschluesselt") {
    return `${name} ist von der Bank verschlüsselt und lässt sich nicht mit anderen Dateien binden — es kämen leere Seiten heraus. `
      + `Öffne die Datei, sichere sie über „Drucken → Als PDF sichern“ neu und lade die neue Datei zusammen mit den anderen hoch.`;
  }
  if (f.grund === "unlesbar") {
    return `${name} lässt sich nicht lesen. Bitte neu als PDF speichern oder als Foto hochladen.`;
  }
  return "Die gewählten Dateien enthalten keine Seiten.";
}

/**
 * Bindet mehrere Dateien (PDF, JPG, PNG) in der gegebenen Reihenfolge zu EINER
 * PDF. Eine einzelne Datei kommt unverändert zurück — kein Umschreiben, wo
 * nichts zu tun ist.
 *
 * @throws BindeFehler, wenn eine Datei verschlüsselt oder nicht lesbar ist
 *         oder am Ende Seiten fehlen. Dann ist nichts gebunden worden.
 */
export async function zuEinerPdf(teile: { buffer: Buffer; name: string }[]): Promise<Buffer> {
  const echte = teile.filter((t) => t.buffer?.length);
  if (echte.length === 0) throw new BindeFehler("leer", "");
  if (echte.length === 1) return echte[0].buffer;

  const { PDFDocument } = await import("pdf-lib");
  const ziel = await PDFDocument.create();
  let erwartet = 0;

  for (const t of echte) {
    const art = dateiArt(t.buffer);
    if (!art) throw new BindeFehler("unlesbar", t.name);

    if (art === "pdf") {
      let quelle: Awaited<ReturnType<typeof PDFDocument.load>>;
      try {
        // ignoreEncryption NUR, um die Verschlüsselung sehen zu können: Ohne
        // das Flag wirft pdf-lib, und man wüsste nicht, ob die Datei kaputt
        // oder geschützt ist. Gebunden wird eine geschützte Datei danach nicht.
        quelle = await PDFDocument.load(t.buffer, { ignoreEncryption: true, updateMetadata: false });
      } catch {
        throw new BindeFehler("unlesbar", t.name);
      }
      if (quelle.isEncrypted) throw new BindeFehler("verschluesselt", t.name);
      try {
        const seiten = await ziel.copyPages(quelle, quelle.getPageIndices());
        for (const s of seiten) ziel.addPage(s);
      } catch {
        throw new BindeFehler("unlesbar", t.name);
      }
      erwartet += quelle.getPageCount();
    } else {
      try {
        const bild = art === "jpg" ? await ziel.embedJpg(t.buffer) : await ziel.embedPng(t.buffer);
        const seite = ziel.addPage([bild.width, bild.height]);
        seite.drawImage(bild, { x: 0, y: 0, width: bild.width, height: bild.height });
      } catch {
        throw new BindeFehler("unlesbar", t.name);
      }
      erwartet += 1;
    }
  }

  // Wand: Jede Seite, die hineinging, muss auch herauskommen.
  if (erwartet === 0 || ziel.getPageCount() !== erwartet) throw new BindeFehler("leer", "");
  return Buffer.from(await ziel.save());
}
