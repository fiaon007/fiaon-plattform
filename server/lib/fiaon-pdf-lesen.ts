// ═══════════════════════════════════════════════════════════════════════════
// EIN PDF WIEDER LESEN — FÜR PRÜFSTÄNDE, NICHT FÜR DEN BETRIEB
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// AGENTS.md verlangt für PDFs: „keine Leerseiten, keine Platzhalter", Ränder per
// Pixelmessung, und den Beweis am gerenderten Ergebnis. Beim Referenz-Befund
// FIAON-COM-2026-0010 stand die Fußzeile doppelt und das Dokument hatte VIER
// Seiten für SECHS Positionen. Beides sieht man erst, wenn man das fertige
// Dokument liest — nicht die Vorlage.
//
// ── WARUM MIT BIBLIOTHEK (ZWEITER ANLAUF) ─────────────────────────────────
// Der erste Entwurf las die Inhaltsströme selbst: zlib entpacken, `Tj`/`TJ`
// abklopfen, fertig. Er lieferte für das echte Dokument NULL brauchbare Zeichen.
// Grund: Chromium bettet subsettierte Schriften mit eigener Kodierung ein — ohne
// die ToUnicode-Tabelle sind die Glyphennummern keine Buchstaben.
//
// Der Entwurf hatte eine Notbremse (`pdfTextBrauchbar`), und die hat ihn
// gerettet: Statt „0× FIAON LTD gefunden" als Befund zu melden, sagte der Lauf
// „die Messung ist unbrauchbar". Eine Messung, die still eine Null liefert, hätte
// zu dem Schluss geführt, die Fußzeile fehle — das Gegenteil des Befunds.
//
// Deshalb jetzt `pdfjs-dist` (devDependency): dieselbe Maschine, die Firefox zum
// Anzeigen benutzt, mit vollständiger CMap-Behandlung.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * pdfjs kommt als ESM-Modul mit eigenem Arbeiter. In Node wird der Arbeiter
 * abgeschaltet (`disableWorker`), sonst versucht die Bibliothek, eine
 * Worker-Datei über eine URL zu laden, die es hier nicht gibt.
 */
async function pdfjs(): Promise<any> {
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return mod;
}

async function dokument(buf: Buffer): Promise<any> {
  const { getDocument, GlobalWorkerOptions } = await pdfjs();
  // ── DER ARBEITER BRAUCHT EINEN PFAD, AUCH WENN ER NICHT LÄUFT ──────────
  // `workerSrc = ""` genügt NICHT: pdfjs meldet dann „Setting up fake worker
  // failed: No GlobalWorkerOptions.workerSrc specified". Es will einen Pfad
  // sehen, bevor es auf den eingebauten Ersatz-Arbeiter zurückfällt. Der Pfad
  // wird aus dem installierten Paket aufgelöst — nicht geraten.
  // Der Wert muss nur GESETZT sein — pdfjs fällt dann auf seinen eingebauten
  // Ersatz-Arbeiter im Hauptthread zurück. Ein auflösbarer Pfad ist nicht nötig
  // und wäre je nach Paketlayout unterschiedlich.
  (GlobalWorkerOptions as any).workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
  return await getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
    // Schriften nicht nachladen — wir wollen Text, nicht Aussehen.
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;
}

/** Anzahl der Seiten. */
export async function pdfSeiten(buf: Buffer): Promise<number> {
  const doc = await dokument(buf);
  const n = Number(doc.numPages);
  await doc.destroy?.();
  return n;
}

/**
 * Der Text jeder Seite, in Leserichtung zusammengesetzt.
 *
 * pdfjs liefert Textstücke mit Positionen. Sie werden mit Leerzeichen verbunden;
 * für unsere Fragen („kommt das Wort vor", „wie oft") genügt das. Eine echte
 * Spalten- und Zeilenrekonstruktion wäre mehr Aufwand als Nutzen.
 */
export async function pdfTextJeSeite(buf: Buffer): Promise<string[]> {
  const doc = await dokument(buf);
  const seiten: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const seite = await doc.getPage(i);
    const inhalt = await seite.getTextContent();
    const text = (inhalt.items as any[])
      .map((s) => (typeof s?.str === "string" ? s.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    seiten.push(text);
    seite.cleanup?.();
  }
  await doc.destroy?.();
  return seiten;
}

/** Der Text des ganzen Dokuments. */
export async function pdfText(buf: Buffer): Promise<string> {
  return (await pdfTextJeSeite(buf)).join("\n\n");
}

/**
 * Ist die Textausbeute brauchbar?
 *
 * Bleibt als Wand stehen, auch wenn pdfjs zuverlässig ist: Eine leere Ausbeute
 * darf NIEMALS als „das Wort kommt nicht vor" durchgehen. Ein Prüfstand, der aus
 * einer fehlgeschlagenen Messung ein Bestanden macht, ist schlimmer als keiner.
 */
export function pdfTextBrauchbar(text: string): boolean {
  if (text.trim().length < 40) return false;
  const vokale = (text.match(/[aeiouäöüAEIOU]/g) ?? []).length;
  return vokale / text.length > 0.15;
}

/**
 * Wie oft kommt ein Wort je Seite vor?
 *
 * Für „Fußzeile genau 1× je Seite" — die Prüfung braucht die Verteilung, nicht
 * die Gesamtzahl: Zweimal auf Seite 1 und keinmal auf Seite 2 ergibt in der
 * Summe denselben Wert wie einmal je Seite.
 */
export async function pdfWortJeSeite(buf: Buffer, wort: string): Promise<number[]> {
  const seiten = await pdfTextJeSeite(buf);
  // Whitespace im Suchwort tolerant behandeln: pdfjs zerlegt Zeilen an
  // beliebigen Stellen, „Company No." kann als „Company  No." ankommen.
  const muster = new RegExp(
    wort.trim().split(/\s+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*"),
    "gi",
  );
  return seiten.map((s) => (s.match(muster) ?? []).length);
}

/** Seiten, die (fast) keinen Text tragen — Leerseiten. */
export async function pdfLeereSeiten(buf: Buffer): Promise<number[]> {
  const seiten = await pdfTextJeSeite(buf);
  const leer: number[] = [];
  seiten.forEach((s, i) => { if (s.replace(/\s/g, "").length < 12) leer.push(i + 1); });
  return leer;
}
