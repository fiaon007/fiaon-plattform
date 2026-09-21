// ═══════════════════════════════════════════════════════════════════════════
// TEXTERKENNUNG FÜR FOTOS UND SCANS (18.09.2026, Team-Feedback Priorität 2)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// „Die KI analysiert praktisch keine Dokumente mehr zuverlässig — obwohl sie
// vorhanden und gut lesbar sind." Gemessen am 18.09.2026: 66 Läufe der
// Bonitätsanalyse und 47 der Kontoauszug-Analyse endeten mit „Die Datei
// enthält keinen lesbaren Text (Foto oder Scan)". Alle drei Leser
// (fiaon-schufa-analyse, fiaon-kontoauszug-analyse, fiaon-dokument-pruefung)
// lesen nur die TEXTSCHICHT eines PDFs. Ein Handyfoto hat keine — und der
// Upload macht aus jedem Foto ein PDF mit genau diesem Bild (fiaon-bild-zu-pdf).
// Ein gestochen scharfes Foto war damit für die Maschine eine leere Seite.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Erst die Textschicht (schnell, kostenlos, exakt). Ist sie leer oder
// unbrauchbar, liest ein Bildmodell die Seiten: Das PDF geht seitenweise als
// Datei an /v1/responses — OpenAI legt dem Modell zu jeder Seite ein Bild
// vor. Das Modell ÜBERTRÄGT nur (wörtlich, zeilengetreu); gerechnet und
// geurteilt wird wie bisher in den drei Lesern. Ein Bild (JPEG/PNG aus der
// Zeit vor der PDF-Wandlung) geht als Bild.
//
// Zwischenspeicher im Prozess (Prüfung und Analyse lesen dieselbe Datei
// direkt nacheinander) — keine Tabelle: Der erkannte Text eines Ausweises
// gehört nicht in eine zweite Ablage, die beim Löschen vergessen wird.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";

export type OcrArt = "kontoauszug" | "schufa" | "ausweis" | "allgemein";

export interface OcrErgebnis {
  /** Text je Seite, in Leserichtung, Zeilen mit \n. */
  seiten: string[];
  modell: string;
}

const MODELL = () => process.env.FIAON_OCR_MODELL || "gpt-4.1";
const SCHLUESSEL = () => process.env.OPENAI_API_KEY || "";
/** Seiten je Aufruf — klein genug, dass die Antwort nie abgeschnitten wird. */
const SEITEN_JE_AUFRUF = 4;
/** Mehr liest niemand: Eine SCHUFA-Auskunft hat selten über 40 Seiten. */
const HOECHSTENS_SEITEN = 48;
const GLEICHZEITIG = 3;
const ZEITGRENZE_MS = 120_000;

const zwischenspeicher = new Map<string, OcrErgebnis>();
function merken(schluessel: string, e: OcrErgebnis): void {
  zwischenspeicher.set(schluessel, e);
  while (zwischenspeicher.size > 40) zwischenspeicher.delete(zwischenspeicher.keys().next().value as string);
}

function anweisung(art: OcrArt, ab: number, bis: number): string {
  const wozu: Record<OcrArt, string> = {
    // 18.09.2026, erster Produktionslauf: 130 Buchungen gelesen, aber die Saldo-Kette brach an 54
    // von 56 Stellen. Ursache sind Tabellen mit getrennten Spalten „Soll | Haben": Ohne Markierung der
    // LEEREN Zelle weiß niemand mehr, in welcher Spalte ein Betrag stand. Deshalb: Kopfzeile mit, jede
    // leere Zelle als „—", und die Spaltenzahl bleibt in jeder Zeile gleich.
    kontoauszug: "Es ist vermutlich ein Kontoauszug. Übertrage die Kopfzeile jeder Buchungstabelle (z. B. „Datum | Text | Soll | Haben | Saldo“). "
      + "Danach jede Buchung auf EINER Zeile mit GENAU so vielen Spalten wie die Kopfzeile; eine leere Zelle schreibst du als „—“, damit klar bleibt, in welcher Spalte ein Betrag steht. "
      + "Mehrzeilige Buchungstexte gehören in die Textspalte derselben Zeile. Vorzeichen, Soll/Haben-Kennzeichen (S, H, -, +), Komma und Tausenderpunkt exakt wie gedruckt. "
      + "Anfangs- und Endsaldo („Alter Kontostand“, „Neuer Kontostand“) wörtlich mit ihrem Betrag.",
    schufa: "Es ist vermutlich eine Bonitätsauskunft (z. B. SCHUFA-Datenkopie): Nummerierte Einträge, Daten, Beträge und Vertragsnummern exakt wie gedruckt.",
    ausweis: "Es ist vermutlich ein Ausweisdokument (Personalausweis, Reisepass, Aufenthaltstitel): Übertrage alle Beschriftungen und Felder, auch die maschinenlesbare Zone (MRZ) Zeichen für Zeichen.",
    allgemein: "",
  };
  return [
    "Du bist eine Texterkennung (OCR). Übertrage den Text der beigefügten Seiten VOLLSTÄNDIG und WÖRTLICH, Zeile für Zeile in Leserichtung.",
    "Nichts zusammenfassen, nichts auslassen, nichts ergänzen, nichts korrigieren oder deuten. Zahlen, Beträge, Daten und IBAN exakt wie gedruckt.",
    "Tabellen: eine Tabellenzeile pro Textzeile, Spalten mit ' | ' getrennt. Unleserliche Stellen als [?].",
    wozu[art],
    `Beginne jede Seite mit einer eigenen Zeile '=== Seite N ===' (N läuft von ${ab} bis ${bis}). Gib ausschließlich den übertragenen Text aus.`,
  ].filter(Boolean).join("\n");
}

function istPdf(b: Buffer): boolean { return b.subarray(0, 4).toString("latin1") === "%PDF"; }
function bildMime(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e) return "image/png";
  return null;
}

/** Text aus der Antwort von /v1/responses — der letzte Nachrichtenblock zählt. */
function antwortText(roh: any): string {
  const teile: any[] = Array.isArray(roh?.output) ? roh.output : [];
  const bloecke = teile
    .filter((t) => t?.type === "message")
    .map((t) => (Array.isArray(t.content) ? t.content : [])
      .filter((c: any) => c?.type === "output_text" && typeof c.text === "string")
      .map((c: any) => c.text).join(""))
    .filter((s: string) => s.trim().length > 0);
  return bloecke.length ? bloecke[bloecke.length - 1] : (typeof roh?.output_text === "string" ? roh.output_text : "");
}

async function aufruf(inhalt: any, text: string): Promise<{ text: string; usage: any }> {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), ZEITGRENZE_MS);
  const start = Date.now();
  const modell = MODELL();
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${SCHLUESSEL()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modell,
        temperature: 0,
        max_output_tokens: 16000,
        input: [{ role: "user", content: [inhalt, { type: "input_text", text }] }],
      }),
      signal: abbruch.signal,
    });
    const roh: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`OCR HTTP ${res.status}: ${JSON.stringify(roh?.error ?? roh).slice(0, 240)}`);
    const usage = { prompt_tokens: roh?.usage?.input_tokens ?? 0, completion_tokens: roh?.usage?.output_tokens ?? 0 };
    nutzung(modell, usage, Date.now() - start, true);
    return { text: antwortText(roh), usage };
  } catch (e: any) {
    nutzung(modell, null, Date.now() - start, false, String(e?.message || e));
    throw e;
  } finally {
    clearTimeout(uhr);
  }
}

function nutzung(modell: string, usage: any, dauerMs: number, ok: boolean, fehler?: string): void {
  import("./fiaon-postmeister-schema")
    .then(({ nutzungMerken }) => nutzungMerken({ dienst: "ocr", modell, usage, dauerMs, ok, fehler: fehler ?? null }))
    .catch(() => {});
}

/** Zerlegt die Antwort an den Seitenmarken; ohne Marken ist alles EINE Seite. */
function seitenAus(text: string, erwartet: number): string[] {
  const teile = text.split(/^\s*=== Seite \d+ ===\s*$/m).map((t) => t.trim());
  const seiten = teile[0] === "" ? teile.slice(1) : teile;
  if (seiten.length === 0) return [text.trim()];
  // Mehr Marken als Seiten: zusammenlegen statt Seiten zu erfinden.
  if (seiten.length > erwartet && erwartet > 0) return [...seiten.slice(0, erwartet - 1), seiten.slice(erwartet - 1).join("\n")];
  return seiten;
}

async function reihe<T, E>(liste: T[], n: number, f: (x: T, i: number) => Promise<E>): Promise<E[]> {
  const aus: E[] = new Array(liste.length);
  let naechste = 0;
  await Promise.all(Array.from({ length: Math.min(n, liste.length) }, async () => {
    while (naechste < liste.length) { const i = naechste++; aus[i] = await f(liste[i], i); }
  }));
  return aus;
}

/**
 * Liest ein Foto- oder Scan-Dokument. `null`, wenn kein Schlüssel gesetzt ist
 * oder das Format unbekannt ist — der Aufrufer bleibt dann bei „unlesbar".
 * Fehler des Dienstes werfen (der Aufrufer kennt seine Fehlerspalte).
 */
export async function ocrLesen(buf: Buffer, art: OcrArt = "allgemein", opt: { seiten?: number[] } = {}): Promise<OcrErgebnis | null> {
  if (!SCHLUESSEL() || !buf?.length) return null;
  // 21.09.2026 (E-207): nur bestimmte Seiten (0-basiert) — die Fotoseiten eines gemischten
  // PDFs. Das Ergebnis enthält dann genau diese Seiten, in dieser Reihenfolge.
  const auswahl = Array.isArray(opt.seiten) && opt.seiten.length
    ? Array.from(new Set(opt.seiten)).filter((n) => Number.isInteger(n) && n >= 0).sort((a, b) => a - b)
    : null;
  const schluessel = createHash("sha256").update(buf).digest("hex") + ":" + art + (auswahl ? `:${auswahl.join(",")}` : "");
  const alt = zwischenspeicher.get(schluessel);
  if (alt) return alt;

  const mime = bildMime(buf);
  if (mime) {
    const { text } = await aufruf(
      { type: "input_image", image_url: `data:${mime};base64,${buf.toString("base64")}`, detail: "high" },
      anweisung(art, 1, 1),
    );
    const e = { seiten: seitenAus(text, 1), modell: MODELL() };
    merken(schluessel, e);
    return e;
  }
  if (!istPdf(buf)) return null;

  // Seitenweise in Päckchen: Die Antwort bleibt kurz genug, und eine lange
  // Auskunft wird parallel gelesen. Lässt sich das PDF nicht zerlegen
  // (beschädigt, verschlüsselt), geht es als Ganzes.
  let paeckchen: { daten: Buffer; ab: number; bis: number }[] = [];
  try {
    const quelle = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
    const gesamt = quelle.getPageCount();
    const liste = (auswahl ? auswahl.filter((i) => i < gesamt) : Array.from({ length: gesamt }, (_, i) => i)).slice(0, HOECHSTENS_SEITEN);
    for (let i = 0; i < liste.length; i += SEITEN_JE_AUFRUF) {
      const gruppe = liste.slice(i, i + SEITEN_JE_AUFRUF);
      if (!auswahl && i === 0 && gruppe.length === gesamt) { paeckchen.push({ daten: buf, ab: 1, bis: gruppe.length }); break; }
      const teil = await PDFDocument.create();
      const kopien = await teil.copyPages(quelle, gruppe);
      kopien.forEach((s) => teil.addPage(s));
      paeckchen.push({ daten: Buffer.from(await teil.save()), ab: i + 1, bis: i + gruppe.length });
    }
  } catch {
    // Einzelne Seiten lassen sich aus einem kaputten PDF nicht schneiden — dann gar nicht.
    if (auswahl) return null;
    paeckchen = [{ daten: buf, ab: 1, bis: 1 }];
  }
  if (paeckchen.length === 0) return null;

  const teile = await reihe(paeckchen, GLEICHZEITIG, async (p) => {
    const { text } = await aufruf(
      { type: "input_file", filename: `seiten-${p.ab}-${p.bis}.pdf`, file_data: `data:application/pdf;base64,${p.daten.toString("base64")}` },
      anweisung(art, p.ab, p.bis),
    );
    return seitenAus(text, p.bis - p.ab + 1);
  });
  const e = { seiten: teile.flat(), modell: MODELL() };
  merken(schluessel, e);
  return e;
}

/**
 * Die Textschicht OHNE unseren eigenen Vermerk. fiaon-bild-zu-pdf schreibt auf
 * jedes aus einem Foto gewandelte PDF eine Fußzeile („Vom Kunden als Bilddatei
 * eingereicht …"). Für die Frage „hat das Dokument Text?" zählte sie bisher
 * mit: 80 Zeichen, genug Vokale — „brauchbar". Die Prüfung las dann nur diese
 * Zeile und meldete beim Ausweis „NICHT erkannt".
 */
export function ohneFotoVermerk(text: string): string {
  return String(text || "").replace(/Vom Kunden als Bilddatei eingereicht \([^)]*\) · automatisch in PDF gewandelt/g, "").trim();
}

/** Die Zeilen je Seite, wie sie pdfTextUndZeilen liefert. */
export function ocrZeilen(e: OcrErgebnis): string[][] {
  return e.seiten.map((s) => s.split("\n").map((z) => z.replace(/\s+$/, "")).filter((z) => z.trim().length > 0));
}
