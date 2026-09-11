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
 * ── WOZU ZEILEN (11.09.2026, E-179 und E-178) ────────────────────────────
 * `pdfTextJeSeite` verbindet alle Textstücke einer Seite zu EINER Zeichenkette.
 * Für „kommt das Wort vor" reicht das. Für zwei Fragen nicht:
 *   · Zeitraum eines Kontoauszugs (E-179, fiaon-dokument-pruefung.ts): Ob ein
 *     Datum ein Buchungstag ist oder das Druckdatum, verrät erst die Zeile —
 *     Buchungen haben einen Betrag daneben, „Erstellt am 10.09.2026" nicht.
 *   · Buchung für Buchung lesen (E-178, fiaon-kontoauszug-analyse.ts): Eine
 *     Buchung ist eine ZEILE — Datum, Empfänger, Betrag, Saldo. Ohne Zeile muss
 *     ein Modell raten, welcher Betrag zu welchem Datum gehört (an drei echten
 *     Auszügen gemessen: aus dem verklebten Text nicht sicher zu trennen).
 *
 * ── EIN LESER STATT ZWEI (E-180) ─────────────────────────────────────────
 * Beide Fragen bekamen am 11.09. aus zwei Sitzungen je einen eigenen Leser in
 * dieser Datei (`pdfTextUndZeilen` mit Schrifthöhen-Toleranz, `pdfZeilenJeSeite`
 * mit festen 2,5 pt und Spaltentrenner). Am BAWAG-Auszug gemessen, was der feste
 * Wert falsch machte: Kopf- und Detailzeilen, die eine Zeile sind, wurden
 * zerschnitten, und die hochkant gesetzte Formularnummer am Seitenrand
 * („D04MMK…", auf jeder Seite) stand zwölfmal MITTEN in Buchungszeilen.
 * Seither gibt es EINEN Leser:
 *
 *   · Zeilen entstehen über die senkrechte Lage der Textstücke, nicht über die
 *     Reihenfolge im Inhaltsstrom: Viele Banken schreiben erst die ganze
 *     Datumsspalte und dann die Betragsspalte. Zwei Stücke liegen in einer
 *     Zeile, wenn ihre Grundlinien näher beieinander liegen als die halbe
 *     kleinere Schrifthöhe (mindestens 1,5 pt).
 *   · Hochkant gesetzter Randtext gehört zu keiner Zeile — er kommt als eigene
 *     Zeilen ans Ende der Seite.
 *   · Steuerzeichen werden Leerraum: Eine Bank trennt Wörter mit U+0001
 *     („Kontoauszug<U+0001>vom<U+0001>31.01.2026<U+0001>bis…", 55-Seiten-Auszug,
 *     Praxistest E-179). Für einen Leerraum-Test ist das kein Zwischenraum;
 *     „vom … bis …" wäre keine Spanne.
 *   · `spalten: true` (Kontoauszug-Analyse): Ein Abstand von mehr als 6 pt
 *     zwischen dem Ende eines Stücks und dem Anfang des nächsten ist eine
 *     Spaltengrenze und wird als „ | " geschrieben — das Modell sieht Spalten,
 *     nicht Wortsalat. Ohne den Schalter trennt ein Leerzeichen.
 *
 * `seiten` ist Zeichen für Zeichen dasselbe, was `pdfTextJeSeite` liefert; die
 * Glättung gilt nur für die Zeilen.
 */
export async function pdfTextUndZeilen(buf: Buffer, opt: { spalten?: boolean } = {}): Promise<{ seiten: string[]; zeilen: string[][] }> {
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
    zeilen.push(zeilenAus(items, opt.spalten === true));
    seite.cleanup?.();
  }
  await doc.destroy?.();
  return { seiten, zeilen };
}

/** Steuerzeichen und Mehrfach-Leerraum werden ein Leerzeichen — nur in den Zeilen, nie im Text. */
const glatt = (s: string): string => s.replace(/[\u0000-\u001f\u007f\u200b]/g, " ").replace(/\s+/g, " ").trim();

/** Ab dieser Lücke (pt) zwischen zwei Stücken beginnt bei `spalten: true` eine neue Spalte. */
const SPALTEN_LUECKE = 6;

type Stueck = { x: number; y: number; w: number; h: number; t: string; quer: boolean };

function zeilenAus(items: any[], spalten: boolean): string[] {
  const teile: Stueck[] = items
    .filter((s) => typeof s?.str === "string" && Array.isArray(s.transform))
    .map((s) => ({
      x: Number(s.transform[4]), y: Number(s.transform[5]), w: Number(s.width) || 0,
      h: Math.abs(Number(s.transform[3])) || Number(s.height) || 8,
      t: glatt(String(s.str)),
      // Hochkant gesetzter Randtext (Formularnummern am Seitenrand) gehört zu
      // keiner Zeile — sonst landet er mitten in einer Buchung.
      quer: Math.abs(Number(s.transform[1])) > Math.abs(Number(s.transform[0])),
    }))
    // Erst glätten, dann sieben: Ein Stück aus lauter Steuerzeichen darf keine
    // Zeile aufmachen, in die dann echte Stücke einsortiert werden.
    .filter((p) => p.t);
  const liegend = teile.filter((p) => !p.quer).sort((a, b) => b.y - a.y || a.x - b.x);
  const gruppen: { y: number; h: number; t: Stueck[] }[] = [];
  for (const p of liegend) {
    const g = gruppen[gruppen.length - 1];
    if (g && Math.abs(g.y - p.y) <= Math.max(1.5, 0.5 * Math.min(g.h, p.h))) g.t.push(p);
    else gruppen.push({ y: p.y, h: p.h, t: [p] });
  }
  const zeile = (stuecke: Stueck[]): string => {
    let aus = "";
    let ende = -Infinity;
    for (const p of stuecke.sort((a, b) => a.x - b.x)) {
      if (aus) aus += spalten && p.x - ende > SPALTEN_LUECKE ? " | " : " ";
      aus += p.t;
      ende = p.x + p.w;
    }
    return aus;
  };
  return [...gruppen.map((g) => zeile(g.t)), ...teile.filter((p) => p.quer).map((p) => p.t)].filter(Boolean);
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
