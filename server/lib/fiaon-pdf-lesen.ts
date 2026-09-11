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

/**
 * Text UND Zeilen jeder Seite aus einem einzigen Lesedurchgang.
 *
 * ── WOZU ZEILEN (11.09.2026, E-179) ─────────────────────────────────────
 * `pdfTextJeSeite` verbindet alle Textstücke einer Seite zu EINER Zeichenkette.
 * Für die Zeitraum-Erkennung beim Kontoauszug reicht das nicht: Ob ein Datum
 * ein Buchungstag ist oder das Druckdatum, verrät erst die Zeile, in der es
 * steht — Buchungen haben einen Betrag daneben, „Erstellt am 10.09.2026" nicht.
 *
 * Die Zeilen werden über die senkrechte Lage der Textstücke gebildet, nicht
 * über die Reihenfolge im Inhaltsstrom: Viele Banken schreiben erst die ganze
 * Datumsspalte und dann die Betragsspalte. `seiten` ist Zeichen für Zeichen
 * dasselbe, was `pdfTextJeSeite` liefert.
 */
export async function pdfTextUndZeilen(buf: Buffer): Promise<{ seiten: string[]; zeilen: string[][] }> {
  const doc = await dokument(buf);
  const seiten: string[] = [];
  const zeilen: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const seite = await doc.getPage(i);
    const items = (await seite.getTextContent()).items as any[];
    seiten.push(items
      .map((s) => (typeof s?.str === "string" ? s.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim());
    zeilen.push(zeilenAus(items));
    seite.cleanup?.();
  }
  await doc.destroy?.();
  return { seiten, zeilen };
}

function zeilenAus(items: any[]): string[] {
  const teile = items
    .filter((s) => typeof s?.str === "string" && s.str.trim() && Array.isArray(s.transform))
    .map((s) => ({
      x: Number(s.transform[4]), y: Number(s.transform[5]), t: String(s.str),
      h: Math.abs(Number(s.transform[3])) || Number(s.height) || 8,
      // Hochkant gesetzter Randtext (Formularnummern am Seitenrand) gehört zu
      // keiner Zeile — sonst landet er mitten in einer Buchung.
      quer: Math.abs(Number(s.transform[1])) > Math.abs(Number(s.transform[0])),
    }));
  const liegend = teile.filter((t) => !t.quer).sort((a, b) => b.y - a.y || a.x - b.x);
  const gruppen: { y: number; h: number; t: { x: number; t: string }[] }[] = [];
  for (const p of liegend) {
    const g = gruppen[gruppen.length - 1];
    if (g && Math.abs(g.y - p.y) <= Math.max(1.5, 0.5 * Math.min(g.h, p.h))) g.t.push(p);
    else gruppen.push({ y: p.y, h: p.h, t: [p] });
  }
  // Manche Bank-PDFs trennen Wörter mit Steuerzeichen statt Leerzeichen —
  // gemessen: „Kontoauszug<U+0001>vom<U+0001>31.01.2026<U+0001>bis…" (Praxistest
  // E-179, 55-Seiten-Auszug). Für `\s` ist das kein Zwischenraum; „vom … bis …"
  // wäre keine Spanne. In den Zeilen wird es Leerraum, im Text bleibt alles, wie es war.
  const glatt = (s: string) => s.replace(/[\u0000-\u001f\u007f\u200b]/g, " ").replace(/\s+/g, " ").trim();
  return [
    ...gruppen.map((g) => glatt(g.t.sort((a, b) => a.x - b.x).map((q) => q.t).join(" "))),
    ...teile.filter((t) => t.quer).map((t) => glatt(t.t)),
  ].filter(Boolean);
}

/**
 * Die ZEILEN jeder Seite — aus den Koordinaten der Textstücke rekonstruiert.
 *
 * ── WARUM ES DIESE FUNKTION BRAUCHT (11.09.2026, E-178) ───────────────────
 * `pdfTextJeSeite` klebt alle Textstücke einer Seite mit Leerzeichen zu EINER
 * Zeile zusammen. Für „kommt das Wort vor" reicht das. Für einen Kontoauszug
 * nicht: Dort ist eine Buchung eine ZEILE — Datum, Empfänger, Betrag, Saldo —
 * und wenn die Zeile weg ist, muss ein Modell raten, welcher Betrag zu welchem
 * Datum gehört. Gemessen an drei echten Auszügen (Sparkasse-Format mit
 * nachgestelltem Minus, ein Format mit Datum ohne Jahr, ING-Übersicht): Aus
 * dem verklebten Text sind die Buchungen nicht mehr sicher zu trennen.
 *
 * pdfjs liefert zu jedem Stück die Position (transform[4] = x, [5] = y).
 * Stücke mit gleichem y (± 2,5 pt) sind eine Zeile; innerhalb der Zeile nach x
 * sortiert. Ein größerer Abstand zwischen zwei Stücken (> 6 pt) ist eine
 * Spaltengrenze und wird als „ | " geschrieben — das Modell sieht dann Spalten,
 * nicht Wortsalat.
 */
export async function pdfZeilenJeSeite(buf: Buffer): Promise<string[][]> {
  const doc = await dokument(buf);
  const seiten: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const seite = await doc.getPage(i);
    const inhalt = await seite.getTextContent();
    const stuecke = (inhalt.items as any[])
      .filter((s) => typeof s?.str === "string" && s.str.trim() && Array.isArray(s.transform))
      .map((s) => ({ x: Number(s.transform[4]), y: Number(s.transform[5]), w: Number(s.width || 0), s: String(s.str) }));
    const zeilen: { y: number; teile: { x: number; w: number; s: string }[] }[] = [];
    for (const t of stuecke) {
      let z = zeilen.find((r) => Math.abs(r.y - t.y) <= 2.5);
      if (!z) { z = { y: t.y, teile: [] }; zeilen.push(z); }
      z.teile.push(t);
    }
    zeilen.sort((a, b) => b.y - a.y);
    seiten.push(zeilen.map((z) => {
      const teile = z.teile.sort((a, b) => a.x - b.x);
      let aus = "";
      let ende = -Infinity;
      for (const t of teile) {
        const luecke = t.x - ende;
        if (aus) aus += luecke > 6 ? " | " : " ";
        aus += t.s.trim();
        ende = t.x + t.w;
      }
      return aus.replace(/\s+/g, " ").trim();
    }).filter(Boolean));
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
